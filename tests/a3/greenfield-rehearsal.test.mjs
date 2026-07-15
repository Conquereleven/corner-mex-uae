import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { deterministicUuid } from "../../scripts/a3/lib.mjs";
import { reconcileRehearsal } from "../../scripts/a3/reconcile-rehearsal.mjs";
import { buildRehearsal } from "../../scripts/a3/rehearse-transformations.mjs";
import { validateMigrationMap } from "../../scripts/a3/validate-migration-map.mjs";
import { validateCanonicalBaselineInventory } from "../../scripts/a3/validate-canonical-baseline-inventory.mjs";
import { validateTargetCleanEvidence } from "../../scripts/a3/validate-target-clean-evidence.mjs";

const readFixture = async () =>
  JSON.parse(await readFile("tests/fixtures/a3/greenfield-commerce.synthetic.json", "utf8"));
const clone = (value) => structuredClone(value);

test("canonical inventory and committed evidence are explicit", async () => {
  assert.equal((await validateCanonicalBaselineInventory()).tables, 20);
  const evidence = await validateTargetCleanEvidence();
  assert.equal(evidence.status, "a3_committed_target_clean_evidence_valid");
  assert.equal(evidence.liveQueryPerformed, false);
  assert.match(evidence.message, /No live Supabase query was performed/);
});

test("greenfield map computes complete coverage", async () => {
  const result = await validateMigrationMap();
  assert.equal(result.expectedObjects, 25);
  assert.equal(result.coveredObjects, 25);
  assert.equal(result.computedCoverage, 100);
});

test("deterministic identity uses unambiguous tuple encoding", () => {
  assert.notEqual(deterministicUuid("product", "x:1"), deterministicUuid("product:x", "1"));
  const ids = new Set();
  for (let index = 0; index < 12_000; index += 1) {
    ids.add(deterministicUuid(`namespace-${index % 17}`, `value:${index}`));
  }
  assert.equal(ids.size, 12_000);
  assert.match(deterministicUuid("منتج", "jalapeño"), /^[0-9a-f-]{36}$/);
});

test("fixture order is canonical but business content changes checksum", async () => {
  const fixture = await readFixture();
  const reordered = clone(fixture);
  reordered.categories.reverse();
  reordered.products.reverse();
  reordered.variants.reverse();
  reordered.inventory.reverse();
  assert.equal(
    (await buildRehearsal(fixture)).checksum,
    (await buildRehearsal(reordered)).checksum,
  );
  const changed = clone(fixture);
  changed.products[0].name = "Changed business content";
  assert.notEqual(
    (await buildRehearsal(fixture)).checksum,
    (await buildRehearsal(changed)).checksum,
  );
});

test("reconciliation uses an independent fixture total", async () => {
  const fixture = await readFixture();
  const expected = fixture.variants.reduce((sum, row) => sum + row.priceMinor, 0);
  const result = await reconcileRehearsal(fixture);
  assert.equal(result.monetaryTotalMinor, expected);
  assert.equal(result.orphanCount, 0);
  assert.equal(result.inventoryTotal, 0);
});

for (const [field, error] of [
  ["orders", "GREENFIELD_ORDERS_MUST_BE_EMPTY"],
  ["payments", "GREENFIELD_PAYMENTS_MUST_BE_EMPTY"],
  ["customers", "GREENFIELD_CUSTOMERS_MUST_BE_EMPTY"],
  ["reviews", "GREENFIELD_REVIEWS_MUST_BE_EMPTY"],
  ["inventoryMovements", "GREENFIELD_RUNTIME_ACTIVITY_MUST_BE_EMPTY"],
  ["couponRedemptions", "GREENFIELD_RUNTIME_ACTIVITY_MUST_BE_EMPTY"],
  ["catalogEvents", "GREENFIELD_RUNTIME_ACTIVITY_MUST_BE_EMPTY"],
]) {
  test(`prohibited ${field} records fail closed`, async () => {
    const fixture = await readFixture();
    fixture[field].push({ syntheticCanary: true });
    await assert.rejects(buildRehearsal(fixture), new RegExp(error));
  });
}

for (const [value, error] of [
  [0, "INVALID_PRICE_MINOR_POSITIVE"],
  [-1, "INVALID_PRICE_MINOR_POSITIVE"],
  [1.5, "INVALID_PRICE_MINOR_INTEGER"],
  ["1250", "INVALID_PRICE_MINOR_INTEGER"],
  [Number.NaN, "INVALID_PRICE_MINOR_INTEGER"],
  [Number.POSITIVE_INFINITY, "INVALID_PRICE_MINOR_INTEGER"],
  [Number.MAX_SAFE_INTEGER + 1, "INVALID_PRICE_MINOR_SAFE_INTEGER"],
]) {
  test(`invalid price ${String(value)} fails closed`, async () => {
    const fixture = await readFixture();
    fixture.variants[0].priceMinor = value;
    await assert.rejects(buildRehearsal(fixture), new RegExp(error));
  });
}

test("non-AED currency and duplicate SKU fail closed", async () => {
  const currency = await readFixture();
  currency.variants[0].currency = "USD";
  await assert.rejects(buildRehearsal(currency), /INVALID_PRICE_CURRENCY/);
  const duplicate = await readFixture();
  duplicate.variants[1].sku = duplicate.variants[0].sku.trim();
  await assert.rejects(buildRehearsal(duplicate), /DUPLICATE_SKU/);
});

test("orphan relationships and prohibited stock sources fail closed", async () => {
  const orphan = await readFixture();
  orphan.products[0].categorySourceId = "missing";
  await assert.rejects(reconcileRehearsal(orphan), /ORPHAN_PRODUCT_CATEGORY/);
  const stock50 = await readFixture();
  stock50.stock50.push({ quantity: 50 });
  await assert.rejects(buildRehearsal(stock50), /GREENFIELD_STOCK_50_MUST_BE_EMPTY/);
  const planning = await readFixture();
  planning.planningStock100.push({ quantity: 100 });
  await assert.rejects(buildRehearsal(planning), /GREENFIELD_PLANNING_STOCK_MUST_BE_EMPTY/);
});
