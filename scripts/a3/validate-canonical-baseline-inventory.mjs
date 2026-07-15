import { assert, readJson } from "./lib.mjs";

export const CANONICAL_PUBLIC_TABLES = Object.freeze([
  "addresses",
  "b2b_leads",
  "cart_items",
  "carts",
  "catalog_events",
  "categories",
  "coupon_redemptions",
  "coupons",
  "inventory",
  "inventory_movements",
  "order_items",
  "orders",
  "payments",
  "product_images",
  "product_reviews",
  "product_translations",
  "product_variants",
  "products",
  "profiles",
  "user_roles",
]);

export async function validateCanonicalBaselineInventory(inventory) {
  inventory ??= await readJson("contracts/cornermex-canonical-baseline-inventory-v1.json");
  assert(
    inventory.contractVersion === "cornermex-canonical-baseline-inventory-v1",
    "unexpected inventory contract",
  );
  assert(inventory.canonicalProjectRef === "wlrfknmrhowldygmvtvn", "canonical project mismatch");
  assert(
    inventory.legacySourceStatus === "retired_not_available_for_migration",
    "legacy source must be retired",
  );
  assert(inventory.migrationMode === "greenfield_activation", "migration mode must be greenfield");
  assert(inventory.completeInventory === true, "canonical baseline inventory must be complete");

  const actual = new Set(inventory.tables);
  const expected = new Set(CANONICAL_PUBLIC_TABLES);
  const missing = CANONICAL_PUBLIC_TABLES.filter((table) => !actual.has(table));
  const unexpected = [...actual].filter((table) => !expected.has(table)).sort();
  const duplicates = inventory.tables.filter(
    (table, index) => inventory.tables.indexOf(table) !== index,
  );
  assert(
    duplicates.length === 0,
    `duplicate canonical tables: ${[...new Set(duplicates)].sort().join(",")}`,
  );
  assert(missing.length === 0, `missing canonical tables: ${missing.join(",")}`);
  assert(unexpected.length === 0, `unexpected canonical tables: ${unexpected.join(",")}`);
  assert(
    Object.values(inventory.businessCounts).every((count) => count === 0),
    "business baseline must be empty",
  );
  assert(
    inventory.containsPii === false && inventory.containsSecrets === false,
    "inventory must be sanitized",
  );
  return {
    status: "a3_inventory_valid",
    tables: inventory.tables.length,
    missingTables: missing,
    unexpectedTables: unexpected,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateCanonicalBaselineInventory()));
}
