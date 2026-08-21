import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("presentation journey connects Home to Shop and For Business", async () => {
  const home = await read("src/routes/index.tsx");
  assert.match(home, /to="\/shop"/);
  assert.match(home, /to="\/b2b"/);
  assert.match(home, /Signed-in customers can place cash-on-delivery orders/);
});

test("Shop presents canonical sellable catalogue only", async () => {
  const shop = await read("src/routes/shop.tsx");
  assert.match(shop, /listProducts/);
  assert.match(shop, /listCategories/);
  assert.match(shop, /Number\.isFinite\(p\.price_aed\) && p\.price_aed > 0/);
  assert.match(shop, /c\.slug !== "uncategorized"/);
  assert.match(shop, /Products are sold directly by CornerMex UAE/);
});

test("Product detail fails closed on non-positive variants and adds CornerMex cart items", async () => {
  const product = await read("src/routes/product.$slug.tsx");
  assert.match(product, /hasPublicSellableVariant/);
  assert.match(product, /variant\.price_aed > 0/);
  assert.match(
    product,
    /if \(!product \|\| !hasPublicSellableVariant\(product\)\) throw notFound\(\)/,
  );
  assert.match(product, /Sold by CornerMex/);
  assert.match(product, /addToCart/);
  assert.match(product, /Add to cart/);
});

test("Cart preserves single-merchant identity and routes cleanly to checkout", async () => {
  const [cart, catalog] = await Promise.all([
    read("src/routes/cart.tsx"),
    read("src/lib/catalog.functions.ts"),
  ]);
  assert.match(cart, /group\.sellerName/);
  assert.match(cart, /to="\/checkout"/);
  assert.match(cart, /Current price, availability and shipping are verified at\s+checkout/);
  assert.doesNotMatch(cart, />B2C cart</);
  assert.match(catalog, /slug: "cornermex", name: "CornerMex"/);
});

test("Checkout remains COD-only, signed-in and server-priced", async () => {
  const checkout = await read("src/routes/checkout.tsx");
  assert.match(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/);
  assert.match(checkout, /Boolean\(user\)/);
  assert.match(checkout, /previewCodOrderTotals/);
  assert.match(checkout, /hasCurrentPreview/);
  assert.match(checkout, /payment_method: "cod"/);
  assert.match(checkout, /codOnly: true/);
  assert.match(checkout, /No card details are collected/);
  assert.doesNotMatch(checkout, /createPaymentSession|stripe\.checkout|paymentIntent/);
});

test("B2B catalogue flows into the guarded human-reviewed lead pipeline without prototype copy", async () => {
  const [catalogRoute, hero, grid, quote, leads] = await Promise.all([
    read("src/routes/b2b_.catalog.tsx"),
    read("src/components/b2b/B2bCatalogHero.tsx"),
    read("src/components/b2b/B2bProductGrid.tsx"),
    read("src/routes/b2b_.quote.tsx"),
    read("src/lib/b2b-leads.functions.ts"),
  ]);
  const publicB2bCopy = `${catalogRoute}\n${hero}`;
  assert.doesNotMatch(publicB2bCopy, /Wave 1|Founder-approved/i);
  assert.match(hero, /CornerMex · Business catalogue/);
  assert.match(hero, /href="#business-products"/);
  assert.match(grid, /id="business-products"/);
  assert.match(quote, /submitB2bLead/);
  assert.match(quote, /Human-reviewed B2B pipeline/);
  assert.match(leads, /submit_b2b_lead_v2/);
});

test("Admin journey stays role-gated and exposes Orders plus B2B Leads", async () => {
  const [admin, leads] = await Promise.all([
    read("src/routes/_authenticated/admin.tsx"),
    read("src/routes/_authenticated/admin.leads.index.tsx"),
  ]);
  assert.match(admin, /getRouteAdminState/);
  assert.match(admin, /resolveRouteAccess/);
  assert.match(admin, /to: "\/admin\/orders"/);
  assert.match(admin, /to: "\/admin\/leads"/);
  assert.match(leads, /adminListB2bLeads/);
  assert.match(leads, /Human-owned commercial pipeline/);
});
