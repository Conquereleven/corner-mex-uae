import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { deterministicUuid } from "../../scripts/a3/lib.mjs";
import { reconcileRehearsal } from "../../scripts/a3/reconcile-rehearsal.mjs";
import { buildRehearsal } from "../../scripts/a3/rehearse-transformations.mjs";
import { validateMigrationMap } from "../../scripts/a3/validate-migration-map.mjs";
import { validateSourceInventory } from "../../scripts/a3/validate-source-inventory.mjs";
import { verifyTargetCleanState } from "../../scripts/a3/verify-target-clean-state.mjs";

test("canonical inventory describes the empty wlrf baseline", async () => {
  assert.equal((await validateSourceInventory()).tables, 20);
  assert.equal((await verifyTargetCleanState()).status, "a3_target_clean");
});

test("greenfield map covers every required commerce domain", async () => {
  const result = await validateMigrationMap();
  assert.equal(result.coverage, 100);
  assert.ok(result.mappings >= 25);
});

test("deterministic identifiers are stable and distinct by namespace", () => {
  assert.equal(deterministicUuid("product", "syn-001"), deterministicUuid("product", "syn-001"));
  assert.notEqual(deterministicUuid("product", "syn-001"), deterministicUuid("variant", "syn-001"));
});

test("synthetic transformation is deterministic and never activates products", async () => {
  const first = await buildRehearsal();
  const second = await buildRehearsal();
  assert.equal(first.checksum, second.checksum);
  assert.ok(first.output.products.every(({ active }) => active === false));
  assert.ok(first.output.product_variants.every(({ active }) => active === false));
});

test("reconciliation has no duplicates, orphans, stock or transaction rows", async () => {
  const result = await reconcileRehearsal();
  assert.equal(result.deterministic, true);
  assert.equal(result.idempotent, true);
  assert.equal(result.orphanCount, 0);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.inventoryTotal, 0);
});

test("fixture is explicitly synthetic and contains no contact data", async () => {
  const fixture = JSON.parse(
    await readFile("tests/fixtures/a3/greenfield-commerce.synthetic.json", "utf8"),
  );
  assert.equal(fixture.synthetic, true);
  assert.doesNotMatch(JSON.stringify(fixture), /@|\+\d{8,}/);
});
