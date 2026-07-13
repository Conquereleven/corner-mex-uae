import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260714010000_commerce_foundation_a2.sql";
const sql = readFileSync(migrationPath, "utf8");
const expected = readFileSync(`${migrationPath}.sha256`, "utf8").trim().split(/\s+/)[0];
const actual = createHash("sha256").update(sql).digest("hex");

assert.equal(actual, expected, "A2 baseline checksum mismatch");
assert.doesNotMatch(sql, /\binsert\s+into\b/i, "business seed statements are forbidden");
assert.doesNotMatch(sql, /\b(stock|quantity_on_hand)\b[^;\n]*(default|values?)\s*\(?\s*(50|100)\b/i, "stock fixtures are forbidden");
assert.doesNotMatch(sql, /create\s+table\s+(?:public\.)?(sellers|seller_payouts|commissions|storefronts)\b/i, "marketplace entities are forbidden");
assert.doesNotMatch(sql, /grant\s+all\s+on[^;]+to\s+(public|anon)/i, "broad public grants are forbidden");

for (const table of [
  "profiles", "addresses", "categories", "products", "product_variants", "inventory",
  "inventory_movements", "carts", "cart_items", "orders", "order_items", "payments",
  "product_reviews", "coupons", "catalog_events", "b2b_leads",
]) {
  assert.match(sql, new RegExp(`create\\s+table\\s+public\\.${table}\\b`, "i"), `missing ${table}`);
  assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.%I enable row level security`, "i"), "RLS loop missing");
}

console.log(JSON.stringify({ status: "approved_for_target_application", checksum: actual, seeds: 0, commerceModel: "single_merchant" }));
