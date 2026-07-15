import { assert, readJson } from "./lib.mjs";

export async function validateSourceInventory() {
  const inventory = await readJson("contracts/cornermex-active-source-inventory-v1.json");
  assert(
    inventory.contractVersion === "cornermex-active-source-inventory-v1",
    "unexpected inventory contract",
  );
  assert(inventory.canonicalProjectRef === "wlrfknmrhowldygmvtvn", "canonical project mismatch");
  assert(
    inventory.legacySourceStatus === "retired_not_available_for_migration",
    "legacy source must be retired",
  );
  assert(inventory.migrationMode === "greenfield_activation", "migration mode must be greenfield");
  assert(inventory.completeInventory === true, "canonical baseline inventory must be complete");
  assert(
    inventory.tables.length === 20 && new Set(inventory.tables).size === 20,
    "expected 20 unique tables",
  );
  assert(
    Object.values(inventory.businessCounts).every((count) => count === 0),
    "business baseline must be empty",
  );
  assert(
    inventory.containsPii === false && inventory.containsSecrets === false,
    "inventory must be sanitized",
  );
  return { status: "a3_inventory_valid", tables: inventory.tables.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateSourceInventory()));
}
