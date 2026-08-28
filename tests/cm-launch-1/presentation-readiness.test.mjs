import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public presentation surfaces use current operating language", async () => {
  const [header, home, shop, b2b, about] = await Promise.all([
    read("src/components/site/Header.tsx"),
    read("src/routes/index.tsx"),
    read("src/routes/shop.tsx"),
    read("src/routes/b2b.tsx"),
    read("src/routes/about.tsx"),
  ]);

  assert.match(header, /aria-label="Intermex UAE home"/);
  assert.match(header, />\s*Shop\s*</);
  assert.match(header, />\s*Wholesale\s*</);
  assert.match(home, /Intermex UAE · Mexican food supplier/);
  assert.match(home, /Tradition you can taste\./);
  assert.match(shop, />\s*Intermex UAE\s*</);
  assert.match(b2b, />\s*For business · UAE\s*</);
  assert.match(about, /Intermex combines a curated Mexican pantry catalogue/);
});

test("shop hides placeholder taxonomy from customer-facing filters", async () => {
  const shop = await read("src/routes/shop.tsx");

  assert.match(shop, /\.filter\(\(c\) => c\.slug !== "uncategorized"\)/);
  assert.match(shop, /aria-label="Product categories"/);
});

test("shop fails closed on non-positive catalogue prices", async () => {
  const shop = await read("src/routes/shop.tsx");

  assert.match(shop, /Number\.isFinite\(p\.price_aed\) && p\.price_aed > 0/);
  assert.match(shop, /productItems\.map\(\(p, i\) => <ProductCard/);
});

test("presentation journey keeps commerce and B2B entry points visible", async () => {
  const [home, shop, checkout, b2b] = await Promise.all([
    read("src/routes/index.tsx"),
    read("src/routes/shop.tsx"),
    read("src/routes/checkout.tsx"),
    read("src/routes/b2b.tsx"),
  ]);

  assert.match(home, /<Link to="\/shop">/);
  assert.match(home, /<Link to="\/b2b">/);
  assert.match(shop, /Products are sold directly by Intermex UAE/);
  assert.match(checkout, /createFileRoute\("\/checkout"\)/);
  assert.match(b2b, /createFileRoute\("\/b2b"\)/);
});
