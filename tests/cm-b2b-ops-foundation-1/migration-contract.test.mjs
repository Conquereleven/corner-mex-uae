import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationName = "20260823023904_cm_b2b_ops_foundation_1.sql";
const migrationPath = `supabase/migrations/${migrationName}`;
const privateTables = [
  "b2b_customer_accounts",
  "b2b_account_users",
  "b2b_account_variant_prices",
  "saved_lists",
  "saved_list_items",
  "inventory_policies",
];

test("the canonical migration reuses existing commerce authorities", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /references public\.product_variants\(id\)/i);
  assert.match(sql, /references auth\.users\(id\)/i);
  assert.doesNotMatch(
    sql,
    /create table (?:commerce_private\.)?(?:products|product_variants|inventory|orders)\b/i,
  );
  assert.doesNotMatch(sql, /create\s+function|create\s+policy|security\s+definer/i);
});

test("all B2B foundation tables are force-RLS private with no direct grants", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const table of privateTables) {
    assert.match(sql, new RegExp(`create table commerce_private\\.${table}`, "i"));
    assert.match(
      sql,
      new RegExp(`alter table commerce_private\\.${table} force row level security`, "i"),
    );
    assert.match(
      sql,
      new RegExp(
        `revoke all on table commerce_private\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`,
        "i",
      ),
    );
  }
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)\s+on\s+table/i);
});

test("migration custody is canonical, gated and explicitly unapplied", async () => {
  const custody = JSON.parse(
    await readFile("contracts/canonical-active-migration-extensions-v1.json", "utf8"),
  );
  const entry = custody.migrations.find((migration) => migration.filename === migrationName);
  assert.deepEqual(entry, {
    filename: migrationName,
    owner: "canonical_cornermex",
    purpose: "cm_b2b_ops_foundation_1",
    productionApplied: false,
    requiresFounderProductionGate: true,
  });
});

test("foundation contract records no automatic or production side effects", async () => {
  const contract = JSON.parse(await readFile("contracts/cm-b2b-ops-foundation-1.json", "utf8"));
  assert.deepEqual(contract.privateTables, privateTables);
  assert.deepEqual(contract.pricingPrecedence, ["exact_account_variant", "default_sell_price"]);
  assert.equal(contract.currency, "AED");
  assert.ok(Object.values(contract.sideEffects).every((value) => value === false));
  assert.equal(contract.followUps.length, 4);
});
