import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const canonical = new Set([
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
  "order_lifecycle_events",
  "payments",
  "product_images",
  "product_reviews",
  "product_translations",
  "product_variants",
  "products",
  "profiles",
  "notifications",
  "user_roles",
  "place_cod_order_v1",
  "admin_transition_order_lifecycle_v1",
  "cm_com_4a_order_lifecycle_capability",
]);
const future = new Set([
  "catalog_import_executions",
  "catalog_import_reviews",
]);
const roots = ["src", "scripts"];
const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(target);
  }
};
for (const root of roots) await walk(root);

const found = new Map();
for (const file of files.sort()) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/\.(from|rpc)\(\s*["']([^"']+)["']/g)) {
    const kind = match[1] === "rpc" ? "function" : "table_or_storage_bucket";
    const key = `${kind}:${match[2]}`;
    if (!found.has(key)) found.set(key, { kind, name: match[2], files: [] });
    found.get(key).files.push(file);
  }
}

const outputPath = "contracts/application-schema-reference-baseline-v1.json";
const committed = await readFile(outputPath, "utf8").catch(() => null);
const committedContract = committed ? JSON.parse(committed) : null;
const committedOrder = new Map(
  (committedContract?.references ?? []).map((reference, index) => [
    `${reference.kind}:${reference.name}`,
    index,
  ]),
);

const references = [...found.values()]
  .map((reference) => ({
    ...reference,
    files: [...new Set(reference.files)].sort(),
    classification:
      canonical.has(reference.name)
        ? "canonical_supported"
        : future.has(reference.name)
          ? "requires_future_migration"
          : "lovable_live_only",
    rationale:
      canonical.has(reference.name)
        ? "present_in_canonical_db2_inventory"
        : future.has(reference.name)
          ? "owned_by_pending_canonical_migration"
          : "preexisting_lovable_runtime_reference_not_in_canonical_db2",
  }))
  .sort((left, right) => {
    const leftKey = `${left.kind}:${left.name}`;
    const rightKey = `${right.kind}:${right.name}`;
    const leftIndex = committedOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = committedOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || leftKey.localeCompare(rightKey);
  });

const output = `${JSON.stringify({ contractVersion: "application-schema-reference-baseline-v1", canonicalProjectRef: "wlrfknmrhowldygmvtvn", references }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (committed !== output) {
    console.error("APPLICATION_SCHEMA_REFERENCE_BASELINE_EXPECTED_BEGIN");
    console.error(output);
    console.error("APPLICATION_SCHEMA_REFERENCE_BASELINE_EXPECTED_END");
    throw new Error("application schema references changed; regenerate and classify deliberately");
  }
  console.log(`application schema reference baseline unchanged: ${references.length} identities`);
} else {
  await writeFile(outputPath, output);
  console.log(`application schema reference baseline written: ${references.length} identities`);
}
