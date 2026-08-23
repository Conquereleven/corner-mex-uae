import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");
const rlsMigrationPath = "supabase/migrations/20260822034500_sec_rls_1_b2b_private_rls.sql";
const pipelineMigrationPath =
  "supabase/migrations/20260820210000_cm_launch_1_l5r_canonical_b2b_lead_pipeline.sql";
const antiAbuseMigrationPath =
  "supabase/migrations/20260821023000_cm_launch_1_l5r_b2b_intake_anti_abuse.sql";

test("SEC-RLS-1 enables non-forced RLS on all private B2B tables with no direct policies", async () => {
  const migration = await read(rlsMigrationPath);

  for (const table of ["b2b_lead_status_history", "b2b_lead_notes", "b2b_intake_abuse_budget"]) {
    assert.match(
      migration,
      new RegExp(`alter table commerce_private\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on table commerce_private\\.${table}[\\s\\S]*from public, anon, authenticated, service_role`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(migration, /force row level security/i);
  assert.doesNotMatch(migration, /create\s+policy/i);
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+table/i);
});

test("SEC-RLS-1 preserves the reviewed RPC-only access model", async () => {
  const [pipeline, antiAbuse] = await Promise.all([
    read(pipelineMigrationPath),
    read(antiAbuseMigrationPath),
  ]);

  assert.match(pipeline, /security definer/);
  assert.match(pipeline, /role = 'admin'/);
  assert.match(
    pipeline,
    /revoke all on table commerce_private\.b2b_lead_status_history from public, anon, authenticated, service_role/,
  );
  assert.match(
    pipeline,
    /revoke all on table commerce_private\.b2b_lead_notes from public, anon, authenticated, service_role/,
  );
  assert.match(
    pipeline,
    /grant execute on function public\.admin_list_b2b_leads_v1\(text\) to authenticated/,
  );

  assert.match(antiAbuse, /commerce_private\.consume_b2b_intake_budget_v1/);
  assert.match(antiAbuse, /security definer/);
  assert.match(
    antiAbuse,
    /revoke all on table commerce_private\.b2b_intake_abuse_budget[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    antiAbuse,
    /revoke all on function commerce_private\.consume_b2b_intake_budget_v1\(text, timestamptz\)[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    antiAbuse,
    /grant execute on function public\.submit_b2b_lead_v2[\s\S]*to service_role/,
  );
});

test("SEC-RLS-1 records the verified production postflight without changing its canonical identity", async () => {
  const [contractText, replay, postflightText] = await Promise.all([
    read("contracts/canonical-active-migration-extensions-v1.json"),
    read("scripts/supabase/test-canonical-migration-replay.mjs"),
    read("docs/evidence/sec-rls-1-production-postflight-2026-08-23.json"),
  ]);
  const contract = JSON.parse(contractText);
  const postflight = JSON.parse(postflightText);
  const entry = contract.migrations.find(
    (item) => item.filename === "20260822034500_sec_rls_1_b2b_private_rls.sql",
  );

  assert.ok(entry);
  assert.equal(entry.owner, "canonical_cornermex");
  assert.equal(entry.purpose, "sec_rls_1_b2b_private_rls");
  assert.equal(entry.productionApplied, true);
  assert.equal(entry.productionVersion, "20260823004146");
  assert.equal(entry.productionProjectRef, "wlrfknmrhowldygmvtvn");
  assert.equal(entry.requiresFounderProductionGate, true);

  assert.equal(postflight.projectRef, "wlrfknmrhowldygmvtvn");
  assert.deepEqual(postflight.canonicalMigration, {
    filename: "20260822034500_sec_rls_1_b2b_private_rls.sql",
    runtimeVersion: "20260823004146",
    runtimeName: "sec_rls_1_b2b_private_rls",
    productionApplied: true,
  });
  assert.deepEqual(
    postflight.privateTables.map(({ name }) => name),
    ["b2b_lead_status_history", "b2b_lead_notes", "b2b_intake_abuse_budget"],
  );
  for (const table of postflight.privateTables) {
    assert.equal(table.schema, "commerce_private");
    assert.equal(table.rlsEnabled, true);
    assert.equal(table.forceRls, false);
    assert.equal(table.policyCount, 0);
    assert.equal(table.directGrantCount, 0);
    assert.deepEqual(table.directAccess, {
      PUBLIC: false,
      anon: false,
      authenticated: false,
      service_role: false,
    });
  }

  assert.deepEqual(postflight.privateLimiter.directExecute, {
    PUBLIC: false,
    anon: false,
    authenticated: false,
    service_role: false,
  });
  assert.equal(postflight.privateLimiter.securityDefiner, true);
  assert.equal(postflight.privateLimiter.owner, "postgres");
  assert.deepEqual(postflight.publicIntakeRpc.execute, {
    PUBLIC: false,
    anon: false,
    authenticated: false,
    service_role: true,
  });
  assert.equal(postflight.publicIntakeRpc.securityDefiner, true);
  assert.equal(postflight.publicIntakeRpc.owner, "postgres");
  assert.equal(postflight.adminRpcs.length, 7);
  assert.deepEqual(
    postflight.adminRpcs.map(({ qualifiedName }) => qualifiedName),
    [
      "public.admin_add_b2b_lead_note_v1",
      "public.admin_delete_b2b_lead_note_v1",
      "public.admin_get_b2b_lead_v1",
      "public.admin_list_b2b_leads_v1",
      "public.admin_save_b2b_quote_draft_v1",
      "public.admin_update_b2b_lead_pipeline_v1",
      "public.admin_update_b2b_lead_v1",
    ],
  );
  for (const rpc of postflight.adminRpcs) {
    assert.equal(rpc.securityDefiner, true);
    assert.equal(rpc.owner, "postgres");
    assert.deepEqual(rpc.execute, {
      PUBLIC: false,
      anon: false,
      authenticated: true,
      service_role: false,
    });
    assert.deepEqual(rpc.internalAuthorization, {
      authUidValidation: true,
      userRolesAdminCheck: true,
    });
  }
  assert.equal(postflight.advisorAcceptance.rlsEnabledNoPolicy.code, "rls_enabled_no_policy");
  assert.equal(postflight.advisorAcceptance.rlsEnabledNoPolicy.expectedByDesign, true);
  assert.equal(
    postflight.advisorAcceptance.authenticatedAdminSecurityDefiner.expectedByDesign,
    true,
  );
  assert.equal(postflight.boundary.productionMutationPerformedByThisReconciliation, false);

  assert.match(replay, /privateB2bRlsTables: 3/);
  assert.match(replay, /privateB2bPolicies: 0/);
  assert.match(replay, /privateB2bDirectGrants: 0/);
  assert.match(replay, /not c\.relforcerowsecurity/);
});
