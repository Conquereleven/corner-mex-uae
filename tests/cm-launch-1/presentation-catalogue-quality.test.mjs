import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("catalogue cards no longer render prototype pricing labels and use the Intermex public identity", async () => {
  const card = await read("src/components/site/ProductCard.tsx");

  assert.doesNotMatch(card, />\s*Preview\s*</i);
  assert.doesNotMatch(card, /indicative/i);
  assert.match(card, /Intermex UAE/);
  assert.doesNotMatch(card, /Sold by CornerMex/);
});

test("public product detail fails closed without a positive sellable variant", async () => {
  const product = await read("src/routes/product.$slug.tsx");

  assert.match(product, /hasPublicSellableVariant/);
  assert.match(product, /Number\.isFinite\(variant\.price_aed\)/);
  assert.match(product, /variant\.price_aed > 0/);
  assert.match(product, /throw notFound\(\)/);
  assert.match(product, /sellableVariants/);
  assert.doesNotMatch(product, /commercial preview/i);
});

test("placeholder source brands are not customer-facing brands", async () => {
  const [brandAuthority, filters, product] = await Promise.all([
    read("src/lib/public-product-brand.ts"),
    read("src/components/site/ShopFilters.tsx"),
    read("src/routes/product.$slug.tsx"),
  ]);

  assert.match(brandAuthority, /"my store"/);
  assert.match(brandAuthority, /"intermex uae"/);
  assert.match(brandAuthority, /publicProductBrand/);
  assert.match(filters, /publicBrands/);
  assert.match(filters, /publicProductBrand\(state\.brand\)/);
  assert.match(product, /const publicBrand = publicProductBrand\(p\.brand\)/);
  assert.match(product, /\.\.\.\(brand && \{ brand:/);
});

test("canonical taxonomy plan is read-only and covers the presentation taxonomy", async () => {
  const sql = await read("scripts/catalogue/cm-present-2-taxonomy-dry-run.sql");
  const categorySlugs = [
    "chiles-spices",
    "salsas-moles",
    "tortillas-masa",
    "pantry-staples",
    "snacks-sweets",
    "drinks",
    "chilled-frozen",
    "kitchen-tableware",
    "gifts-lifestyle",
  ];

  for (const slug of categorySlugs) assert.match(sql, new RegExp(`'${slug}'`));
  assert.match(sql, /'expected_active_products', 195/);
  assert.match(sql, /where proposed_category is null/);
  assert.match(sql, /zero_or_negative_price_active_products/);
  assert.doesNotMatch(sql, /^\s*(insert|update|delete|alter|create|drop|truncate)\b/im);
});
