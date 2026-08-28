import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const runPostgresReplay = process.env.CM_PAY_POSTGRES_TEST === "1";

test(
  "verified Stripe events are replay-safe, monotonic, and preserve refund semantics in PostgreSQL",
  { skip: !runPostgresReplay },
  async () => {
    const client = new pg.Client(
      process.env.TEST_DATABASE_URL ? { connectionString: process.env.TEST_DATABASE_URL } : {},
    );
    await client.connect();
    try {
      const userId = randomUUID();
      const orderId = randomUUID();
      const orderNumber = `CM-PAY-TEST-${randomUUID().slice(0, 8)}`;
      const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
      const paymentIntentId = `pi_test_${randomUUID().replaceAll("-", "")}`;
      const eventId = `evt_${randomUUID().replaceAll("-", "")}`;

      await client.query("insert into auth.users(id) values ($1)", [userId]);
      await client.query(
        `insert into public.orders (
           id, order_number, buyer_id, payment_method, subtotal_aed, total_aed, shipping_address
         ) values ($1, $2, $3, 'card', 42, 42, '{}'::jsonb)`,
        [orderId, orderNumber, userId],
      );
      const created = await client.query(
        "select public.cm_pay_create_stripe_attempt_v1($1) as attempt",
        [orderId],
      );
      const paymentId = created.rows[0].attempt.payment_id;

      const paidArgs = [
        eventId,
        "checkout.session.completed",
        sessionId,
        paymentId,
        orderId,
        "aed",
        42,
        null,
        "paid",
        paymentIntentId,
        null,
      ];
      const paid = await client.query(
        "select public.cm_pay_process_stripe_webhook_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
        paidArgs,
      );
      assert.equal(paid.rows[0].result.mutated, true);

      const duplicate = await client.query(
        "select public.cm_pay_process_stripe_webhook_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
        paidArgs,
      );
      assert.deepEqual(duplicate.rows[0].result, { ok: true, duplicate: true, mutated: false });

      const lateFailure = await client.query(
        "select public.cm_pay_process_stripe_webhook_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
        [
          `evt_${randomUUID().replaceAll("-", "")}`,
          "checkout.session.async_payment_failed",
          sessionId,
          paymentId,
          orderId,
          "aed",
          42,
          null,
          null,
          paymentIntentId,
          null,
        ],
      );
      assert.equal(lateFailure.rows[0].result.ignored_as_stale, true);

      const partialRefund = await client.query(
        "select public.cm_pay_process_stripe_webhook_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
        [
          `evt_${randomUUID().replaceAll("-", "")}`,
          "charge.refunded",
          `ch_test_${randomUUID().replaceAll("-", "")}`,
          paymentId,
          orderId,
          "aed",
          42,
          null,
          null,
          paymentIntentId,
          10,
        ],
      );
      assert.equal(partialRefund.rows[0].result.payment_status, "paid");

      const fullRefund = await client.query(
        "select public.cm_pay_process_stripe_webhook_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
        [
          `evt_${randomUUID().replaceAll("-", "")}`,
          "charge.refunded",
          `ch_test_${randomUUID().replaceAll("-", "")}`,
          paymentId,
          orderId,
          "aed",
          42,
          null,
          null,
          paymentIntentId,
          42,
        ],
      );
      assert.equal(fullRefund.rows[0].result.payment_status, "refunded");

      const state = await client.query(
        `select o.payment_status as order_status, p.status as payment_status,
                p.metadata->>'refunded_amount_aed' as refunded_amount,
                (select count(*) from commerce_private.payment_webhook_events where payment_id = p.id) as event_count
           from public.orders o
           join public.payments p on p.order_id = o.id
          where o.id = $1`,
        [orderId],
      );
      assert.deepEqual(state.rows[0], {
        order_status: "refunded",
        payment_status: "refunded",
        refunded_amount: "42.00",
        event_count: "4",
      });
    } finally {
      await client.end();
    }
  },
);
