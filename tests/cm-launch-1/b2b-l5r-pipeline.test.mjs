import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { b2bLeadRiskFlags } from "../../src/lib/b2b-lead-lifecycle.ts";

const read = (path) => readFile(path, "utf8");
const migrationPath =
  "supabase/migrations/20260820210000_cm_launch_1_l5r_canonical_b2b_lead_pipeline.sql";
const operatingMigrationPath =
  "supabase/migrations/20260820213000_cm_launch_1_l5r_pipeline_operations.sql";
const antiAbuseMigrationPath =
  "supabase/migrations/20260821023000_cm_launch_1_l5r_b2b_intake_anti_abuse.sql";

test("L5R public B2B intake is real, idempotent, guarded and server mediated", async () => {
  const [server, quote, migration, antiAbuseMigration] = await Promise.all([
    read("src/lib/b2b-leads.functions.ts"),
    read("src/routes/b2b_.quote.tsx"),
    read(migrationPath),
    read(antiAbuseMigrationPath),
  ]);

  assert.match(server, /submit_b2b_lead_v2/);
  assert.match(server, /getB2bIntakeAbuseKey/);
  assert.doesNotMatch(server, /sendExternalEmail|isExternalEmailEnabled/);
  assert.match(quote, /Submit enquiry to CornerMex|submitB2bLead/);
  assert.match(quote, /idempotency_key: submissionKey/);
  assert.match(migration, /b2b_leads_idempotency_key_uidx/);
  assert.match(migration, /drop policy if exists b2b_leads_public_intake/);
  assert.match(migration, /revoke all on table public\.b2b_leads from anon, authenticated/);
  assert.match(
    antiAbuseMigration,
    /revoke all on function public\.submit_b2b_lead_v1[\s\S]*service_role/,
  );
  assert.match(
    antiAbuseMigration,
    /grant execute on function public\.submit_b2b_lead_v2[\s\S]*to service_role/,
  );
  assert.doesNotMatch(
    antiAbuseMigration,
    /grant execute on function public\.submit_b2b_lead_v2[\s\S]*to anon/,
  );
});

test("L5R canonical lifecycle is aligned across SQL and UI", async () => {
  const [migration, lifecycle, listRoute, detailRoute] = await Promise.all([
    read(migrationPath),
    read("src/lib/b2b-lead-lifecycle.ts"),
    read("src/routes/_authenticated/admin.leads.index.tsx"),
    read("src/routes/_authenticated/admin.leads.$id.tsx"),
  ]);

  for (const status of ["new", "contacted", "quoting", "won", "lost"]) {
    assert.match(migration, new RegExp(`\\b${status}\\b`));
    assert.match(lifecycle, new RegExp(`\\b${status}\\b`));
  }
  for (const legacy of ["qualified", "closed"]) {
    assert.doesNotMatch(lifecycle, new RegExp(`\\b${legacy}\\b`));
    assert.doesNotMatch(listRoute, new RegExp(`\\b${legacy}\\b`));
    assert.doesNotMatch(detailRoute, new RegExp(`\\b${legacy}\\b`));
  }
  assert.match(migration, /v_from_status = 'new' and p_status in \('contacted', 'lost'\)/);
  assert.match(migration, /v_from_status = 'contacted' and p_status in \('quoting', 'lost'\)/);
  assert.match(migration, /v_from_status = 'quoting' and p_status in \('won', 'lost'\)/);
  assert.match(migration, /CM_B2B_LEAD_TRANSITION_NOT_ALLOWED/);
});

test("L5R admin pipeline uses authenticated RPCs and canonical admin guard", async () => {
  const server = await read("src/lib/b2b-leads.functions.ts");
  const migration = await read(migrationPath);
  const operatingMigration = await read(operatingMigrationPath);

  assert.match(server, /assertAdmin\(context\.userId\)/);
  assert.match(server, /context\.supabase as unknown as B2bRpcClient/);
  assert.match(server, /admin_list_b2b_leads_v1/);
  assert.match(server, /admin_get_b2b_lead_v1/);
  assert.match(server, /admin_update_b2b_lead_v1/);
  assert.match(server, /admin_update_b2b_lead_pipeline_v1/);
  assert.match(server, /admin_save_b2b_quote_draft_v1/);
  assert.match(server, /admin_add_b2b_lead_note_v1/);
  assert.match(server, /admin_delete_b2b_lead_note_v1/);
  assert.match(migration, /role = 'admin'/);
  assert.match(operatingMigration, /role = 'admin'/);
  assert.match(
    migration,
    /grant execute on function public\.admin_list_b2b_leads_v1\(text\) to authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.admin_list_b2b_leads_v1\(text\) from public, anon, service_role/,
  );
  assert.match(operatingMigration, /admin_update_b2b_lead_pipeline_v1/);
  assert.match(operatingMigration, /admin_save_b2b_quote_draft_v1/);
});

test("L5R lead history is private and append-only", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /commerce_private\.b2b_lead_status_history/);
  assert.match(migration, /commerce_private\.b2b_lead_notes/);
  assert.doesNotMatch(migration, /create table if not exists public\.lead_status_history/);
  assert.doesNotMatch(migration, /create table if not exists public\.lead_notes/);
  assert.match(migration, /reject_b2b_lead_history_mutation/);
  assert.match(migration, /before update or delete on commerce_private\.b2b_lead_status_history/);
  assert.match(migration, /public_intake/);
});

test("L5R operating layer carries GTM profile, follow-up, blockers and first purchase traceability", async () => {
  const [migration, server, listRoute, panel] = await Promise.all([
    read(operatingMigrationPath),
    read("src/lib/b2b-leads.functions.ts"),
    read("src/routes/_authenticated/admin.leads.index.tsx"),
    read("src/components/b2b/AdminB2bLeadPipeline.tsx"),
  ]);

  for (const field of [
    "website",
    "decision_maker",
    "qualification_score",
    "priority",
    "owner",
    "source_url",
    "last_contact_at",
    "next_action",
    "next_action_at",
    "blocker",
    "first_order_id",
    "quote_draft",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
    assert.match(server, new RegExp(`\\b${field}\\b`));
  }

  assert.match(migration, /qualification_score between 0 and 100/);
  assert.match(migration, /priority in \('unassigned', 'low', 'medium', 'high'\)/);
  assert.match(migration, /first_order_id uuid references public\.orders\(id\) on delete set null/);
  assert.match(migration, /CM_B2B_LEAD_FIRST_ORDER_NOT_FOUND/);
  assert.doesNotMatch(
    migration,
    /insert into public\.orders|update public\.orders|delete from public\.orders/i,
  );
  assert.match(listRoute, /Follow-up overdue/);
  assert.match(listRoute, /Needs owner/);
  assert.match(panel, /Human-owned GTM profile/);
  assert.match(panel, /Existing canonical order UUID/);
});

test("L5R risk model marks last-mile work without inventing terminal follow-up", () => {
  const base = {
    status: "contacted",
    owner: null,
    source_url: null,
    next_action: null,
    next_action_at: "2026-08-20T10:00:00.000Z",
    blocker: "Waiting for approved pricing",
    first_order_id: null,
  };
  assert.deepEqual(b2bLeadRiskFlags(base, Date.parse("2026-08-20T12:00:00.000Z")), [
    "OWNER_MISSING",
    "PROVENANCE_MISSING",
    "NEXT_ACTION_MISSING",
    "FOLLOW_UP_OVERDUE",
    "BLOCKED",
  ]);
  assert.deepEqual(
    b2bLeadRiskFlags({ ...base, status: "lost" }, Date.parse("2026-08-20T12:00:00.000Z")),
    [],
  );
  assert.deepEqual(
    b2bLeadRiskFlags({ ...base, status: "won" }, Date.parse("2026-08-20T12:00:00.000Z")),
    ["FIRST_ORDER_UNLINKED"],
  );
});

test("L5R quote preparation stays draft-only and cannot mutate commerce", async () => {
  const [migration, server, panel] = await Promise.all([
    read(operatingMigrationPath),
    read("src/lib/b2b-leads.functions.ts"),
    read("src/components/b2b/AdminB2bLeadPipeline.tsx"),
  ]);

  assert.match(server, /B2bQuoteDraftSchema/);
  assert.match(migration, /'draft_only', true/);
  assert.match(panel, /Draft only · manual approval\/send/);
  assert.match(panel, /does not send a quote, reserve stock/);
  assert.doesNotMatch(migration, /inventory_movements|product_variants|payments/);
  assert.doesNotMatch(panel, />\s*Send quote\s*</i);
});

test("L5R B2B customer copy remains non-transactional and human approved", async () => {
  const [quote, preview, leadPage, formatter] = await Promise.all([
    read("src/routes/b2b_.quote.tsx"),
    read("src/components/b2b/ManualQuoteRequestPreview.tsx"),
    read("src/routes/b2b_.lead.tsx"),
    read("src/features/b2b-catalog/manual-quote-request.ts"),
  ]);

  assert.match(quote, /human|Human-reviewed/i);
  assert.match(preview, /does not\s+create an order/i);
  assert.match(leadPage, /A request is not an order/);
  assert.match(formatter, /not an order/i);
  assert.doesNotMatch(preview, /order confirmed|quote confirmed/i);
});
