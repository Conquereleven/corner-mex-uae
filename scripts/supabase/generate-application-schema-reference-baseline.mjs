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
  "payments",
  "product_images",
  "product_reviews",
  "product_translations",
  "product_variants",
  "products",
  "profiles",
  "user_roles",
]);
const future = new Set(["catalog_import_executions", "catalog_import_reviews"]);
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

const references = [...found.values()].map((reference) => ({
  ...reference,
  files: [...new Set(reference.files)].sort(),
  classification:
    reference.kind !== "function" && canonical.has(reference.name)
      ? "canonical_supported"
      : future.has(reference.name)
        ? "requires_future_migration"
        : "lovable_live_only",
  rationale:
    reference.kind !== "function" && canonical.has(reference.name)
      ? "present_in_canonical_db2_inventory"
      : future.has(reference.name)
        ? "owned_by_pending_canonical_a3_2b_migration"
        : "preexisting_lovable_runtime_reference_not_in_canonical_db2",
}));

const outputPath = "contracts/application-schema-reference-baseline-v1.json";
const output = `${JSON.stringify({ contractVersion: "application-schema-reference-baseline-v1", canonicalProjectRef: "wlrfknmrhowldygmvtvn", references }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const committed = await readFile(outputPath, "utf8");
  if (committed !== output)
    throw new Error("application schema references changed; regenerate and classify deliberately");
  console.log(`application schema reference baseline unchanged: ${references.length} identities`);
} else {
  await writeFile(outputPath, output);
  console.log(`application schema reference baseline written: ${references.length} identities`);
}
