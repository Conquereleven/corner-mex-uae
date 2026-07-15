import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

test("A3 artifacts never authorize production data fabrication", async () => {
  const inventory = JSON.parse(
    await readFile("contracts/cornermex-active-source-inventory-v1.json", "utf8"),
  );
  assert.equal(inventory.legacySourceStatus, "retired_not_available_for_migration");
  assert.equal(inventory.migrationMode, "greenfield_activation");
  assert.ok(Object.values(inventory.businessCounts).every((count) => count === 0));
});

test("planning and unsafe legacy inventory are excluded", async () => {
  const map = JSON.parse(
    await readFile("contracts/cornermex-active-to-target-migration-map-v1.json", "utf8"),
  );
  const decisions = new Map(
    map.mappings.map(({ sourceObject, targetObject, migrationDecision }) => [
      sourceObject,
      { target: targetObject, decision: migrationDecision },
    ]),
  );
  assert.deepEqual(decisions.get("legacy.stock_50"), { target: "none", decision: "excluded" });
  assert.deepEqual(decisions.get("cornerops.planning_stock_100"), {
    target: "none",
    decision: "excluded",
  });
});

test("mapping contract and JSON Schema agree on required fields", async () => {
  const map = JSON.parse(
    await readFile("contracts/cornermex-active-to-target-migration-map-v1.json", "utf8"),
  );
  const schema = JSON.parse(
    await readFile(
      "contracts/schemas/cornermex-active-to-target-migration-map-v1.schema.json",
      "utf8",
    ),
  );
  for (const field of schema.required) assert.ok(Object.hasOwn(map, field), field);
  for (const entry of map.mappings) {
    for (const field of schema.properties.mappings.items.required)
      assert.ok(Object.hasOwn(entry, field), `${entry.sourceObject}:${field}`);
  }
});

test("committed target evidence remains empty and sanitized", async () => {
  const state = JSON.parse(
    await readFile("contracts/cornermex-target-clean-state-a3.json", "utf8"),
  );
  assert.equal(state.containsPii, false);
  assert.equal(state.containsSecrets, false);
  for (const key of [
    "authUsers",
    "storageBuckets",
    "storageObjects",
    "products",
    "inventory",
    "orders",
    "payments",
    "reviews",
  ]) {
    assert.equal(state[key], 0);
  }
});
