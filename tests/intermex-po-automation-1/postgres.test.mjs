import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { composePo, parsePoText } from "../../src/lib/po/domain.ts";
import { hash } from "../../src/lib/po/document.server.ts";
import { source, mappings } from "./fixture.mjs";
test(
  "PO SQL: ACL, concurrent intake/claim, receipts, mapping revision, lease, durable intent and mode fencing",
  { skip: process.env.PO_POSTGRES_TEST !== "1" },
  async () => {
    assert.ok(["localhost", "127.0.0.1"].includes(process.env.PGHOST));
    const a = new pg.Client(),
      b = new pg.Client();
    await a.connect();
    await b.connect();
    const q = async (sql, args = []) => (await a.query(sql, args)).rows;
    const act = async (action, payload = {}, actor = null, client = a) =>
      (
        await client.query("select public.cm_po_action_v1($1,$2,$3) result", [
          action,
          JSON.stringify(payload),
          actor,
        ])
      ).rows[0].result;
    const admin = randomUUID(),
      other = randomUUID(),
      generation = randomUUID(),
      m = mappings();
    m.organizationId = `fixture-${randomUUID()}`;
    try {
      await q("insert into auth.users(id) values($1),($2)", [admin, other]);
      await q("insert into public.user_roles(user_id,role) values($1,'admin')", [admin]);
      await assert.rejects(act("configure", m, other), /CM_ADMIN_ROLE_REQUIRED/);
      await act("configure", m, admin);
      let config = await act("mappings", { mode: m.mode, organizationId: m.organizationId });
      const normalized = parsePoText(source),
        composed = composePo(normalized, m),
        bytes = Buffer.from(source);
      const payload = {
        mode: m.mode,
        organizationId: m.organizationId,
        source: "email",
        sourceKey: hash("message1:part1"),
        documentHash: hash(bytes),
        documentBase64: bytes.toString("base64"),
        mime: "text/plain",
        normalized,
        composed,
        mappingRevision: config.revision,
      };
      const results = await Promise.all([act("intake", payload), act("intake", payload, null, b)]);
      let id = results[0].id;
      assert.equal(id, results[1].id);
      assert.equal(results.filter((r) => r.duplicate).length, 1);
      assert.equal(
        (await act("intake", { ...payload, source: "ichat", sourceKey: hash("msg2") })).id,
        id,
      );
      const changed = Buffer.from(source + "\n");
      assert.equal(
        (
          await act("intake", {
            ...payload,
            source: "ichat",
            sourceKey: hash("msg2"),
            documentHash: hash(changed),
            documentBase64: changed.toString("base64"),
          })
        ).code,
        "SOURCE_ID_CONFLICT",
      );
      assert.equal(
        (
          await act("intake", {
            ...payload,
            sourceKey: hash("newmessage"),
            documentHash: hash(changed),
            documentBase64: changed.toString("base64"),
          })
        ).code,
        "PO_REVISION_REQUIRES_ATTENTION",
      );
      const conflict = await act("detail", { id }, admin);
      assert.equal(conflict.status, "requires_attention");
      assert.equal(conflict.conflicts.length, 2);
      assert.ok(conflict.audit.length >= 3);
      assert.ok(!JSON.stringify(conflict).includes("document_base64"));
      await assert.rejects(act("release", { id }, admin), /PO_NOT_RELEASABLE/);
      // Continue lease/gate tests with a separate, conflict-free PO identity.
      const cleanBytes = Buffer.from(source.replace("B202609-37789", "B202609-37790"));
      normalized.poNumber = "B202609-37790";
      Object.assign(composed, composePo(normalized, m));
      id = (
        await act("intake", {
          ...payload,
          sourceKey: hash("clean-message"),
          documentHash: hash(cleanBytes),
          documentBase64: cleanBytes.toString("base64"),
          normalized,
          composed,
        })
      ).id;
      await assert.rejects(act("release", { id }, admin), /PO_ACTIVATION_BLOCKED/);
      // Synthetic loopback-only gate; this test never reaches Zoho.
      await q(
        "insert into commerce_private.provider_runtime_gates(provider,mode,generation,enabled,eligible_after,validated_at,valid_until,evidence_ref) values('zoho','test',$1,true,now()-interval '2 hours',now()-interval '3 hours',now()+interval '1 hour','offline PO test') on conflict(provider) do update set mode=excluded.mode,generation=excluded.generation,enabled=true,eligible_after=excluded.eligible_after,validated_at=excluded.validated_at,valid_until=excluded.valid_until",
        [generation],
      );
      await act("configure", m, admin);
      await assert.rejects(act("release", { id }, admin), /PO_MAPPING_CHANGED/);
      config = await act("mappings", { mode: m.mode, organizationId: m.organizationId });
      await act(
        "revise",
        {
          id,
          normalized,
          composed,
          mappingRevision: config.revision,
          reason: "Reviewed source and refreshed mappings",
        },
        admin,
      );
      await act("release", { id }, admin);
      const claim = (client, worker, mode = "test") =>
        client.query("select * from public.cm_po_claim_v1($1,$2,$3)", [
          worker,
          mode,
          m.organizationId,
        ]);
      assert.equal((await claim(a, "wrong-mode", "live")).rows.length, 0);
      const claims = await Promise.all([claim(a, "worker-a"), claim(b, "worker-b")]);
      assert.equal(claims[0].rows.length + claims[1].rows.length, 1);
      const row = claims.flatMap((c) => c.rows)[0],
        workerId = row.locked_by;
      await assert.rejects(act("assert", { id, workerId: "wrong" }), /PO_LEASE_LOST/);
      assert.equal((await act("begin_create", { id, workerId })).acquired, true);
      assert.equal((await act("begin_create", { id, workerId })).acquired, false);
      await q(
        "update commerce_private.provider_runtime_gates set enabled=false where provider='zoho'",
      );
      await assert.rejects(
        act("complete", { id, workerId, invoiceId: "x" }),
        /PO_ACTIVATION_BLOCKED/,
      );
      await act("attention", { id, workerId, code: "CREATE_OUTCOME_UNKNOWN" });
      await assert.rejects(
        act(
          "revise",
          {
            id,
            normalized,
            composed,
            mappingRevision: config.revision,
            reason: "Cannot clear an ambiguous intent",
          },
          admin,
        ),
        /PO_RECONCILIATION_ONLY/,
      );
      assert.ok(
        (
          await q(
            "select count(*)::int n from commerce_private.accounting_integration_audit_events where po_intake_id=$1",
            [id],
          )
        )[0].n >= 5,
      );
      for (const role of ["anon", "authenticated"]) {
        await q(`set role ${role}`);
        await assert.rejects(act("list", {}, admin), /permission denied/);
        await assert.rejects(q("select * from commerce_private.po_intakes"), /permission denied/);
        await q("reset role");
      }
      const acl = await q(
        "select grantee from information_schema.table_privileges where table_schema='commerce_private' and table_name like 'po_%' and grantee in ('PUBLIC','anon','authenticated','service_role')",
      );
      assert.equal(acl.length, 0);
    } finally {
      await a.end();
      await b.end();
    }
  },
);
