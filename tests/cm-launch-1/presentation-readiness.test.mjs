import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public home and shop no longer present CornerMex as a commercial preview", async () => {
  const [home, shop] = await Promise.all([
    read("src/routes/index.tsx"),
    read("src/routes/shop.tsx"),
  ]);

  assert.doesNotMatch(home, /commercial preview/i);
  assert.doesNotMatch(shop, /commercial preview/i);
  assert.match(home, /Mexican commerce for the UAE/);
  assert.match(shop, /CornerMex UAE/);
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
  assert.match(shop, /Products are sold directly by CornerMex UAE/);
  assert.match(checkout, /createFileRoute\("\/checkout"\)/);
  assert.match(b2b, /createFileRoute\("\/b2b"\)/);
});
