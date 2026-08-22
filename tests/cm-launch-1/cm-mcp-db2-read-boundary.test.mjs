import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260822050535_cm_mcp_db2_read_boundary.sql";
const edgePath = "supabase/functions/cornermex-mcp/index.ts";

const read = (path) => readFile(path, "utf8");

const rpcNames = [
  "mcp_current_permissions",
  "mcp_catalog_search",
  "mcp_catalog_get_product",
  "mcp_inventory_get_availability",
  "mcp_orders_list",
  "mcp_orders_get",
  "mcp_b2b_list_leads",
  "mcp_b2b_get_lead",
  "mcp_ops_summary",
];

function functionSection(sql, name, nextName) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start) : sql.length;
  return sql.slice(start, end === -1 ? sql.length : end);
}

test("CM-MCP-DB2 creates a private fail-closed grant store", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /create table commerce_private\.mcp_grants/i);
  assert.match(migration, /primary key \(user_id, client_id, permission\)/i);
  assert.match(migration, /alter table commerce_private\.mcp_grants enable row level security/i);
  assert.doesNotMatch(migration, /force row level security/i);
  assert.doesNotMatch(migration, /create\s+policy[\s\S]*mcp_grants/i);
  assert.match(
    migration,
    /revoke all on table commerce_private\.mcp_grants[\s\S]*from public, anon, authenticated, service_role/i,
  );

  for (const permission of [
    "catalog:read",
    "inventory:read",
    "orders:read",
    "orders:note",
    "orders:transition",
    "b2b:read",
    "b2b:write",
    "ops:read",
  ]) {
    assert.ok(migration.includes(`'${permission}'`), `${permission} must be constrained`);
  }
});

test("CM-MCP-DB2 exposes exactly the Edge Function RPC contract to authenticated callers", async () => {
  const [migration, edge] = await Promise.all([read(migrationPath), read(edgePath)]);

  for (const name of rpcNames) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`, "i"));
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*from public, anon, authenticated, service_role`, "i"),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*to authenticated`, "i"),
    );
    assert.ok(edge.includes(`"${name}"`), `${name} must be consumed by the Edge Function`);
  }

  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to service_role/i);
});

test("every MCP data RPC independently binds user, OAuth client, permission, and expiry", async () => {
  const migration = await read(migrationPath);
  const dataRpcs = [
    ["mcp_catalog_search", "catalog:read"],
    ["mcp_catalog_get_product", "catalog:read"],
    ["mcp_inventory_get_availability", "inventory:read"],
    ["mcp_orders_list", "orders:read"],
    ["mcp_orders_get", "orders:read"],
    ["mcp_b2b_list_leads", "b2b:read"],
    ["mcp_b2b_get_lead", "b2b:read"],
    ["mcp_ops_summary", "ops:read"],
  ];

  for (let index = 0; index < dataRpcs.length; index += 1) {
    const [name, permission] = dataRpcs[index];
    const nextName = dataRpcs[index + 1]?.[0];
    const section = functionSection(migration, name, nextName);
    assert.match(section, /v_actor uuid := auth\.uid\(\)/i);
    assert.match(section, /auth\.jwt\(\) ->> 'client_id'/i);
    assert.match(section, /g\.user_id = v_actor/i);
    assert.match(section, /g\.client_id = v_client/i);
    assert.ok(section.includes(`g.permission = '${permission}'`));
    assert.match(section, /g\.active/i);
    assert.match(section, /g\.expires_at is null or g\.expires_at > now\(\)/i);
    assert.match(section, /CM_MCP_PERMISSION_REQUIRED/);
    assert.match(section, /security definer/i);
    assert.match(section, /set search_path = ''/i);
  }
});

test("remote order and B2B RPC outputs keep direct PII out", async () => {
  const migration = await read(migrationPath);

  const orderList = functionSection(migration, "mcp_orders_list", "mcp_orders_get");
  const orderGet = functionSection(migration, "mcp_orders_get", "mcp_b2b_list_leads");
  for (const section of [orderList, orderGet]) {
    assert.doesNotMatch(section, /buyer_id/i);
    assert.doesNotMatch(section, /shipping_address/i);
    assert.doesNotMatch(section, /legal_acceptance/i);
  }

  const b2bList = functionSection(migration, "mcp_b2b_list_leads", "mcp_b2b_get_lead");
  const b2bGet = functionSection(migration, "mcp_b2b_get_lead", "mcp_ops_summary");
  for (const section of [b2bList, b2bGet]) {
    for (const pii of ["contact_name", "email", "phone", "message", "admin_note", "website"]) {
      assert.doesNotMatch(section, new RegExp(pii, "i"));
    }
  }
});

test("CM-MCP-DB2 remains Founder-gated and unapplied", async () => {
  const [contractText, replay] = await Promise.all([
    read("contracts/canonical-active-migration-extensions-v1.json"),
    read("scripts/supabase/test-canonical-migration-replay.mjs"),
  ]);
  const contract = JSON.parse(contractText);
  const entry = contract.migrations.find(
    (item) => item.filename === "20260822050535_cm_mcp_db2_read_boundary.sql",
  );

  assert.ok(entry);
  assert.equal(entry.owner, "canonical_cornermex");
  assert.equal(entry.purpose, "cm_mcp_db2_read_boundary");
  assert.equal(entry.productionApplied, false);
  assert.equal(entry.requiresFounderProductionGate, true);
  assert.equal("productionVersion" in entry, false);
  assert.equal("productionProjectRef" in entry, false);

  assert.match(replay, /mcpGrantRlsTables: 1/);
  assert.match(replay, /mcpGrantPolicies: 0/);
  assert.match(replay, /mcpGrantDirectGrants: 0/);
  assert.match(replay, /mcpReadFunctions: 9/);
  assert.match(replay, /mcpAuthenticatedExecuteFunctions: 9/);
});
