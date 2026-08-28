import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");
const contractPath = "contracts/cm-b2b-ops-prod-readiness-1.json";
const runbookPath = "docs/b2b/CM-B2B-OPS-PROD-READINESS-1.md";
const evidencePath = "docs/evidence/cm-b2b-ops-prod-readiness-1-readonly-snapshot-2026-08-23.json";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("the three exact migration artifacts are checksum-bound in mandatory order", async () => {
  const contract = JSON.parse(await read(contractPath));
  assert.deepEqual(contract.mandatoryOrder, [
    "20260823023904_cm_b2b_ops_foundation_1.sql",
    "20260823040000_cm_b2b_portal_1a_boundary.sql",
    "20260823041625_cm_b2b_portal_1b_pricing_availability.sql",
  ]);
  assert.deepEqual(
    contract.gates.map(({ id }) => id),
    ["A", "B", "C"],
  );

  for (const gate of contract.gates) {
    const bytes = await read(`supabase/migrations/${gate.artifact.filename}`);
    assert.equal(sha256(bytes), gate.artifact.sha256);
    assert.equal(gate.artifact.filename.startsWith(gate.artifact.sourceVersion), true);
    assert.equal(gate.artifact.filename.includes(gate.artifact.migrationName), true);
  }
});

test("Gate B has a hard dependency on every Gate A private table", async () => {
  const [foundation, portal] = await Promise.all([
    read("supabase/migrations/20260823023904_cm_b2b_ops_foundation_1.sql"),
    read("supabase/migrations/20260823040000_cm_b2b_portal_1a_boundary.sql"),
  ]);
  for (const table of [
    "b2b_customer_accounts",
    "b2b_account_users",
    "b2b_account_variant_prices",
    "saved_lists",
    "saved_list_items",
    "inventory_policies",
  ]) {
    assert.match(foundation, new RegExp(`create table commerce_private\\.${table}`, "i"));
  }
  for (const table of [
    "b2b_customer_accounts",
    "b2b_account_users",
    "saved_lists",
    "saved_list_items",
  ])
    assert.match(portal, new RegExp(`commerce_private\\.${table}`, "i"));

  const contract = JSON.parse(await read(contractPath));
  assert.deepEqual(contract.gates[1].requires, [
    "Gate A postflight green",
    "new and separate Founder authorization issued after Gate A postflight",
  ]);
  assert.equal(contract.gates[0].postflightMustBeGreenBeforeNextGate, true);
  assert.equal(contract.aggregateAuthorizationAllowed, false);
});

test("Gate C is a separate exact-head replacement gate after Portal 1A", async () => {
  const contract = JSON.parse(await read(contractPath));
  const gateC = contract.gates[2];
  assert.deepEqual(gateC.requires, [
    "Gate B postflight and runtime smoke green",
    "new and separate Founder authorization issued after Gate B postflight and runtime smoke",
  ]);
  assert.match(gateC.artifact.filename, /cm_b2b_portal_1b_pricing_availability/);
  assert.match(gateC.founderAuthorizationCommand, /SOLO ES VALIDA DESPUES DE GATE B/);
  assert.match(gateC.founderAuthorizationCommand, /AUTORIZACION NUEVA/);
  assert.equal(contract.gates[1].postflightMustBeGreenBeforeNextGate, true);
});

test("all gate verification SQL is read-only and fail-closed", async () => {
  const contract = JSON.parse(await read(contractPath));
  const paths = contract.gates.flatMap((gate) => [gate.preflightSql, gate.postflightSql]);

  for (const path of paths) {
    const sql = await read(path);
    const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");
    const statements = withoutComments
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    assert.ok(statements.length >= 1, `${path} must contain verification statements`);
    for (const statement of statements) {
      assert.match(statement, /^(?:with|select)\b/i, `${path} contains a non-read-only statement`);
    }
    assert.match(sql, /STOP/);
    assert.match(sql, /supabase_migrations\.schema_migrations/);
  }
});

test("Gate A postflight binds private ownership, RLS, grants, foreign keys and constraints", async () => {
  const sql = await read("docs/b2b/sql/gate-a-foundation-postflight.sql");
  assert.match(sql, /relrowsecurity/);
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /r\.rolname = 'postgres'/);
  assert.match(sql, /PUBLIC', 'anon', 'authenticated', 'service_role/);
  assert.match(sql, /A106_nine_canonical_foreign_keys/);
  assert.match(sql, /A109_pricing_and_inventory_checks_present/);
  assert.match(sql, /public\.set_updated_at\(\)/);
  assert.match(sql, /A110_portal_function_still_absent/);
});

test("Gate B postflight binds the exact authenticated-only SECURITY DEFINER boundary", async () => {
  const sql = await read("docs/b2b/sql/gate-b-portal-boundary-postflight.sql");
  assert.match(sql, /public\.b2b_portal_v1\(text,uuid,jsonb\)/);
  assert.match(sql, /prosecdef/);
  assert.match(sql, /search_path=pg_catalog, public, commerce_private/);
  assert.match(sql, /has_function_privilege\('authenticated'/);
  assert.match(sql, /has_function_privilege\('anon'/);
  assert.match(sql, /has_function_privilege\('service_role'/);
  assert.match(sql, /acl\.grantee = 0/);
  assert.match(sql, /auth\[\.\]uid/);
  assert.match(sql, /active_membership/);
  assert.match(sql, /no_forbidden_commerce_mutation/);
  assert.match(sql, /private_tables_remain_unexposed/);
});

test("Gate C preflight and postflight bind the Portal 1A replacement boundary", async () => {
  const [preflight, postflight] = await Promise.all([
    read("docs/b2b/sql/gate-c-portal-pricing-availability-preflight.sql"),
    read("docs/b2b/sql/gate-c-portal-pricing-availability-postflight.sql"),
  ]);
  assert.match(preflight, /C01_gate_a_ledger_present_once/);
  assert.match(preflight, /C02_gate_b_ledger_present_once/);
  assert.match(preflight, /C03_gate_c_ledger_absent/);
  assert.match(preflight, /catalogPriceAed/);
  assert.doesNotMatch(preflight, /effectivePriceAed/);
  assert.match(postflight, /C101_gate_c_ledger_present_once/);
  assert.match(postflight, /effectivePriceAed/);
  assert.match(postflight, /special_account/);
  assert.match(postflight, /statement_timestamp/);
  assert.match(postflight, /no_forbidden_commerce_mutation/);
  assert.match(postflight, /private_tables_remain_unexposed/);
});

test("separate Founder commands cannot carry authorization between gates", async () => {
  const contract = JSON.parse(await read(contractPath));
  const [gateA, gateB, gateC] = contract.gates;
  assert.notEqual(gateA.founderAuthorizationCommand, gateB.founderAuthorizationCommand);
  assert.notEqual(gateB.founderAuthorizationCommand, gateC.founderAuthorizationCommand);
  assert.match(gateA.founderAuthorizationCommand, /SOLO GATE A/);
  assert.doesNotMatch(gateA.founderAuthorizationCommand, /GATE B/);
  assert.match(
    gateB.founderAuthorizationCommand,
    /SOLO ES VALIDA DESPUES DE GATE A POSTFLIGHT GREEN/,
  );
  assert.match(gateB.founderAuthorizationCommand, /AUTORIZACION NUEVA/);
  assert.match(gateC.founderAuthorizationCommand, /GATE C/);
});

test("rollback preserves customer data and disables the RPC by exact grant revoke", async () => {
  const runbook = await read(runbookPath);
  assert.match(runbook, /No rollback in this plan drops a table or discards customer data/);
  assert.match(
    runbook,
    /revoke all on function public\.b2b_portal_v1\(text, uuid, jsonb\)[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(runbook, /drop table|truncate table/i);
  assert.match(runbook, /Do not drop the function or underlying tables/);
});

test("runtime smoke is read-only, existing-data-only and covers all three portal surfaces", async () => {
  const runbook = await read(runbookPath);
  assert.match(runbook, /Quick Order/);
  assert.match(runbook, /Saved Lists/);
  assert.match(runbook, /Reorder boundary/);
  assert.match(runbook, /Do not create a user, account, membership, saved list/);
  assert.match(runbook, /blocked_no_existing_order/);
  assert.match(runbook, /Do not call `create_list`, `rename_list`, `add_item`/);
  assert.match(runbook, /no order is recreated/);
});

test("advisor deltas are exact and the snapshot records non-activation", async () => {
  const [contract, evidence] = await Promise.all([
    read(contractPath).then(JSON.parse),
    read(evidencePath).then(JSON.parse),
  ]);
  assert.deepEqual(contract.securityAdvisorBaseline.expectedGateADelta, {
    "INFO:rls_enabled_no_policy": 6,
  });
  assert.deepEqual(contract.securityAdvisorBaseline.expectedGateBDelta, {
    "WARN:authenticated_security_definer_function_executable": 1,
  });
  assert.deepEqual(contract.securityAdvisorBaseline.expectedGateCDelta, {
    added: 0,
    removed: 0,
    unchangedIdentity: "public.b2b_portal_v1(text,uuid,jsonb)",
  });
  assert.equal(evidence.migrationLedger.latest.version, "20260823004146");
  assert.equal(evidence.migrationLedger.cm_b2b_ops_foundation_1, "absent");
  assert.equal(evidence.migrationLedger.cm_b2b_portal_1a_boundary, "absent");
  assert.equal(evidence.migrationLedger.cm_b2b_portal_1b_pricing_availability, "absent");
  assert.ok(Object.values(evidence.targetCollisions).every((present) => present === false));
  assert.equal(evidence.boundary.executeSqlStatementsWereSelectOnly, true);
  assert.equal(evidence.boundary.productionMutationPerformed, false);
  assert.ok(Object.values(contract.nonActivation).every((performed) => performed === false));
});
