import { assert, readJson } from "./lib.mjs";

const allowedDecisions = new Set([
  "initialize_empty",
  "new_enrollment_only",
  "runtime_only",
  "excluded",
]);

export async function validateMigrationMap() {
  const map = await readJson("contracts/cornermex-active-to-target-migration-map-v1.json");
  const schema = await readJson(
    "contracts/schemas/cornermex-active-to-target-migration-map-v1.schema.json",
  );
  for (const field of schema.required)
    assert(Object.hasOwn(map, field), `schema-required field missing: ${field}`);
  assert(
    map.contractVersion === "cornermex-active-to-target-migration-map-v1",
    "unexpected map contract",
  );
  assert(map.mode === "greenfield_activation", "map must be greenfield");
  assert(map.canonicalProjectRef === "wlrfknmrhowldygmvtvn", "unexpected canonical project");
  assert(map.mappingCoveragePercent === 100, "mapping coverage must be 100");
  assert(map.mappings.length >= 25, "required domain coverage is incomplete");
  const entryRequired = schema.properties.mappings.items.required;
  for (const entry of map.mappings) {
    for (const field of entryRequired) {
      assert(Object.hasOwn(entry, field), `schema-required mapping field missing: ${field}`);
      if (!["manualReviewRequired", "blockers", "notes"].includes(field)) {
        assert(typeof entry[field] === "string" && entry[field].length > 0, `missing ${field}`);
      }
    }
    assert(entry.manualReviewRequired === true, `manual review missing for ${entry.sourceObject}`);
    assert(
      Array.isArray(entry.blockers) && Array.isArray(entry.notes),
      "blockers and notes must be arrays",
    );
    assert(
      allowedDecisions.has(entry.migrationDecision),
      `unsupported decision for ${entry.sourceObject}`,
    );
  }
  const domains = new Set(map.mappings.map(({ sourceObject }) => sourceObject.split(".").at(-1)));
  for (const required of [
    "products",
    "categories",
    "product_variants",
    "commercial_inventory",
    "profiles",
    "orders",
    "order_items",
    "payments",
    "reviews",
    "auth_users",
    "storage_objects",
    "marketplace",
    "planning_stock_100",
  ]) {
    assert(domains.has(required), `missing mapping for ${required}`);
  }
  assert(
    map.mappings.every(({ blockers }) => blockers.length === 0),
    "mapping contains blockers",
  );
  assert(
    new Set(map.mappings.map(({ sourceObject }) => sourceObject)).size === map.mappings.length,
    "duplicate source object",
  );
  const targetObjects = map.mappings
    .filter(({ targetObject }) => targetObject !== "none")
    .map(({ targetObject }) => targetObject);
  assert(new Set(targetObjects).size === targetObjects.length, "duplicate target object");
  return { status: "a3_mapping_valid", mappings: map.mappings.length, coverage: 100 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateMigrationMap()));
}
