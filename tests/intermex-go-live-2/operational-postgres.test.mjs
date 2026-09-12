import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
import pg from "pg";

test(
  "operational boundaries: concurrent checkout, lifecycle, refunds, queue fencing and invoice authorization",
  { skip: process.env.GO_LIVE_2_POSTGRES !== "1" },
  async (t) => {
    assert.ok(
      ["127.0.0.1", "localhost"].includes(process.env.PGHOST),
      "disposable loopback database required",
    );
    const a = new pg.Client(),
      b = new pg.Client();
    await a.connect();
    await b.connect();
    const q = async (sql, args = []) => (await a.query(sql, args)).rows;
    const buyer = id(),
      other = id(),
      admin = id(),
      product = id(),
      variant = id(),
      generation = id();
    try {
      await q("insert into auth.users(id) values($1),($2),($3)", [buyer, other, admin]);
      await q("insert into public.user_roles(user_id,role) values($1,'admin')", [admin]);
      await q("insert into public.products(id,slug,status) values($1,$2,'active')", [
        product,
        `test-${product}`,
      ]);
      await q(
        "insert into public.product_translations(product_id,lang,name) values($1,'en','Offline fixture')",
        [product],
      );
      await q(
        "insert into public.product_variants(id,product_id,sku,format_label,price_aed,stock,is_active,is_default) values($1,$2,$3,'unit',42,100,true,true)",
        [variant, product, variant],
      );
      await q(
        "insert into public.inventory(variant_id,quantity_on_hand,quantity_reserved) values($1,100,0)",
        [variant],
      );
      await q(
        "insert into commerce_private.provider_runtime_gates(provider,mode,generation,enabled,eligible_after,validated_at,valid_until,evidence_ref) values('stripe','test',$1,true,now()-interval '1 minute',now()-interval '2 minutes',now()+interval '1 hour','offline'),('zoho','test',$2,true,now()-interval '1 minute',now()-interval '2 minutes',now()+interval '1 hour','offline') on conflict(provider) do update set mode=excluded.mode,generation=excluded.generation,enabled=true,eligible_after=excluded.eligible_after,validated_at=excluded.validated_at,valid_until=excluded.valid_until",
        [id(), generation],
      );
      const createSql =
        'select public.cm_create_card_order_v2($1,$2,$3,\'{"emirate":"DU"}\',0,0,\'{"terms":true,"privacy":true,"returns":true}\',\'test\') result';
      const args = [buyer, id(), JSON.stringify([{ variant_id: variant, qty: 1 }])];
      let order, payment;
      await t.test(
        "duplicate concurrent initiation decrements stock once and binds one attempt",
        async () => {
          const results = await Promise.all([a.query(createSql, args), b.query(createSql, args)]);
          order = results[0].rows[0].result.order_id;
          assert.equal(order, results[1].rows[0].result.order_id);
          assert.equal(
            Number(
              (await q("select stock from public.product_variants where id=$1", [variant]))[0]
                .stock,
            ),
            99,
          );
          const attempts = await Promise.all([
            a.query("select public.cm_pay_create_stripe_attempt_v2($1,'test') result", [order]),
            b.query("select public.cm_pay_create_stripe_attempt_v2($1,'test') result", [order]),
          ]);
          payment = attempts[0].rows[0].result.payment_id;
          assert.equal(payment, attempts[1].rows[0].result.payment_id);
          await assert.rejects(
            q(createSql, [buyer, args[1], JSON.stringify([{ variant_id: variant, qty: 2 }])]),
            /IDEMPOTENCY_CONFLICT/,
          );
          await assert.rejects(
            q(createSql, [buyer, id(), JSON.stringify([{ variant_id: variant, qty: 101 }])]),
            /INSUFFICIENT_STOCK/,
          );
          assert.equal(
            Number(
              (await q("select stock from public.product_variants where id=$1", [variant]))[0]
                .stock,
            ),
            99,
          );
        },
      );
      const event = async (
        p,
        o,
        type,
        {
          eventId = `evt_${id()}`,
          session = `cs_${p}`,
          intent = `pi_${p}`,
          refund = null,
          amount = 42,
          currency = "aed",
          mode = "test",
          status = "paid",
        } = {},
      ) =>
        (
          await q(
            "select public.cm_pay_process_stripe_webhook_v2($1,$2,$3,$4,$5,$6,$7,null,$8,$9,$10,$11) result",
            [
              eventId,
              type,
              type === "charge.refunded" ? `ch_${p}` : session,
              p,
              o,
              currency,
              amount,
              status,
              intent,
              refund,
              mode,
            ],
          )
        )[0].result;
      let second;
      await t.test(
        "failed then successful attempt confirms once; duplicate and reordered failure cannot regress",
        async () => {
          await event(payment, order, "checkout.session.async_payment_failed");
          second = (
            await q("select public.cm_pay_create_stripe_attempt_v2($1,'test') result", [order])
          )[0].result.payment_id;
          await q("select public.cm_pay_bind_stripe_session_v2($1,$2,null,'test')", [
            second,
            `cs_${second}`,
          ]);
          const eid = `evt_${id()}`;
          await event(second, order, "checkout.session.completed", { eventId: eid });
          assert.equal(
            (await event(second, order, "checkout.session.completed", { eventId: eid })).duplicate,
            true,
          );
          await event(payment, order, "checkout.session.expired");
          const o = (
            await q(
              "select status,payment_status,stripe_paid_attempt_id from public.orders where id=$1",
              [order],
            )
          )[0];
          assert.deepEqual(o, {
            status: "confirmed",
            payment_status: "paid",
            stripe_paid_attempt_id: second,
          });
          assert.equal(
            (
              await q(
                "select metadata->>'stripe_payment_intent_id' intent from public.payments where id=$1",
                [second],
              )
            )[0].intent,
            `pi_${second}`,
          );
          assert.equal(
            Number(
              (
                await q(
                  "select count(*) from commerce_private.accounting_integration_jobs where order_id=$1",
                  [order],
                )
              )[0].count,
            ),
            1,
          );
          await assert.rejects(
            event(second, order, "checkout.session.completed", { mode: "live" }),
            /MODE_INVALID/,
          );
          await assert.rejects(
            event(second, order, "charge.refunded", { refund: 43 }),
            /REFUND_INVALID/,
          );
          await assert.rejects(
            event(second, order, "charge.refunded", { refund: 1, currency: "usd" }),
            /INPUT_INVALID/,
          );
        },
      );
      await t.test(
        "partial, cumulative, duplicate, older and full refund remain monotonic",
        async () => {
          const eid = `evt_${id()}`;
          await event(second, order, "charge.refunded", { refund: 10, eventId: eid });
          await event(second, order, "charge.refunded", { refund: 10, eventId: eid });
          await event(second, order, "charge.refunded", { refund: 20 });
          await event(second, order, "charge.refunded", { refund: 5 });
          assert.equal(
            Number(
              (await q("select refunded_aed from public.payments where id=$1", [second]))[0]
                .refunded_aed,
            ),
            20,
          );
          await event(second, order, "charge.refunded", { refund: 42 });
          await event(second, order, "checkout.session.completed");
          const p = (
            await q("select status,captured_aed,refunded_aed from public.payments where id=$1", [
              second,
            ])
          )[0];
          assert.equal(p.status, "refunded");
          assert.equal(Number(p.refunded_aed), 42);
          assert.equal(
            Number(
              (
                await q(
                  "select count(*) from commerce_private.refund_accounting_actions where payment_id=$1",
                  [second],
                )
              )[0].count,
            ),
            3,
          );
        },
      );
      await t.test(
        "unexpected second capture requires attention with no duplicate invoice job",
        async () => {
          await event(payment, order, "checkout.session.completed");
          assert.equal(
            (await q("select payment_attention from public.orders where id=$1", [order]))[0]
              .payment_attention,
            "MULTIPLE_SUCCESSFUL_ATTEMPTS",
          );
          assert.equal(
            Number(
              (
                await q(
                  "select count(*) from commerce_private.accounting_integration_jobs where order_id=$1",
                  [order],
                )
              )[0].count,
            ),
            1,
          );
        },
      );
      const makePaid = async () => {
        const o = (await q(createSql, [buyer, id(), args[2]]))[0].result.order_id;
        const p = (
          await q("select public.cm_pay_create_stripe_attempt_v2($1,'test') result", [o])
        )[0].result.payment_id;
        await event(p, o, "checkout.session.completed");
        return { o, p };
      };
      await t.test("refund before observed success cannot resurrect fulfillment", async () => {
        const o = (await q(createSql, [buyer, id(), args[2]]))[0].result.order_id,
          p = (await q("select public.cm_pay_create_stripe_attempt_v2($1,'test') result", [o]))[0]
            .result.payment_id;
        await q("select public.cm_pay_bind_stripe_session_v2($1,$2,null,'test')", [p, `cs_${p}`]);
        await event(p, o, "charge.refunded", { refund: 42 });
        await event(p, o, "checkout.session.completed");
        assert.deepEqual(
          (await q("select status,payment_status from public.orders where id=$1", [o]))[0],
          { status: "pending", payment_status: "refunded" },
        );
        assert.equal(
          Number(
            (
              await q(
                "select count(*) from commerce_private.accounting_integration_jobs where order_id=$1",
                [o],
              )
            )[0].count,
          ),
          0,
        );
      });
      const one = await makePaid(),
        two = await makePaid();
      await t.test(
        "customer lease serializes distinct jobs; durable create intent and stale owner fencing",
        async () => {
          const wa = `worker-${id()}`,
            wb = `worker-${id()}`;
          const claims = await Promise.all([
            a.query("select * from commerce_private.claim_accounting_integration_jobs($1,25)", [
              wa,
            ]),
            b.query("select * from commerce_private.claim_accounting_integration_jobs($1,25)", [
              wb,
            ]),
          ]);
          const jobs = claims
            .flatMap((r) => r.rows)
            .filter((j) => [one.o, two.o].includes(j.order_id));
          assert.equal(jobs.length, 1);
          const j = jobs[0],
            payload = JSON.stringify({ key: `customer:${buyer}` });
          const action = (worker, act, body = "{}") =>
            q("select public.cm_accounting_job_action_v2($1,$2,$3,$4) result", [
              j.id,
              worker,
              act,
              body,
            ]);
          assert.equal(
            (await action(j.locked_by, "begin_create", payload))[0].result.acquired,
            true,
          );
          assert.equal(
            (await action(j.locked_by, "begin_create", payload))[0].result.acquired,
            false,
          );
          await assert.rejects(action("stale-worker", "finish"), /LEASE_LOST/);
          await action(j.locked_by, "finish");
          const next = await q(
            "select * from commerce_private.claim_accounting_integration_jobs($1,25)",
            [wb],
          );
          assert.equal(next.filter((j) => [one.o, two.o].includes(j.order_id)).length, 1);
        },
      );
      await t.test(
        "historical generation jobs are quarantined when credentials/gate become available",
        async () => {
          const h = id();
          await q(
            "insert into commerce_private.accounting_integration_jobs(id,provider,job_type,order_id,dedupe_key) values($1,'zoho','reconciliation',$2,$3)",
            [h, one.o, h],
          );
          await q(
            "select * from commerce_private.claim_accounting_integration_jobs('history-test',25)",
          );
          assert.equal(
            (
              await q(
                "select last_failure_code from commerce_private.accounting_integration_jobs where id=$1",
                [h],
              )
            )[0].last_failure_code,
            "HISTORICAL_QUEUE_QUARANTINED",
          );
        },
      );
      await t.test(
        "invoice owner, other customer, account membership, removal, admin and anonymous enforcement",
        async () => {
          await q(
            "insert into commerce_private.accounting_entity_mappings(provider,entity_type,local_entity_id,external_id,external_number,metadata) values('zoho','invoice',$1,$2,'INV-OFFLINE','{\"issuedDate\":\"2026-09-12\"}')",
            [one.o, id()],
          );
          const view = async (who) =>
            (await q("select public.cm_invoice_projection_v2($1,$2) result", [who, one.o]))[0]
              .result;
          assert.equal((await view(buyer)).number, "INV-OFFLINE");
          assert.equal(await view(other), null);
          assert.equal(await view(null), null);
          assert.ok(await view(admin));
          const account = id();
          await q(
            "insert into commerce_private.b2b_customer_accounts(id,legal_name) values($1,'Offline account')",
            [account],
          );
          await q(
            "insert into commerce_private.b2b_account_users(account_id,user_id) values($1,$2)",
            [account, other],
          );
          await q("update public.orders set b2b_account_id=$1 where id=$2", [account, one.o]);
          assert.ok(await view(other));
          assert.equal(await view(buyer), null);
          await q(
            "update commerce_private.b2b_account_users set status='inactive' where account_id=$1",
            [account],
          );
          assert.equal(await view(other), null);
          assert.ok(await view(admin));
          await q("set role authenticated");
          await assert.rejects(view(other), /permission denied/);
          await q("reset role");
        },
      );
    } finally {
      await a.end();
      await b.end();
    }
  },
);
