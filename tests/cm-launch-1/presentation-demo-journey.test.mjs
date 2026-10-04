import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("presentation journey connects Home to Shop and For Business", async () => {
  const home = await read("src/routes/index.tsx");
  assert.match(home, /to="\/shop"/);
  assert.match(home, /to="\/b2b"/);
  assert.match(home, /Compra en línea sin crear una cuenta/);
  assert.doesNotMatch(home, /UAE|Middle East|Emirat/i);
});

test("Shop presents canonical sellable catalogue only", async () => {
  const shop = await read("src/routes/shop.tsx");
  assert.match(shop, /listProducts/);
  assert.match(shop, /listCategories/);
  assert.match(shop, /Number\.isFinite\(p\.price_aed\) && p\.price_aed > 0/);
  assert.match(shop, /c\.slug !== "uncategorized"/);
  // The seller line is the active market's, and is omitted until it is known.
  assert.match(shop, /marketSellerLine\(\) && \(/);
  assert.doesNotMatch(shop, /sellerOfRecordLine/);
});

test("Product detail fails closed on non-positive variants and adds CornerMex cart items", async () => {
  const product = await read("src/routes/product.$slug.tsx");
  assert.match(product, /hasPublicSellableVariant/);
  assert.match(product, /variant\.price_aed > 0/);
  assert.match(
    product,
    /if \(!product \|\| !hasPublicSellableVariant\(product\)\) throw notFound\(\)/,
  );
  assert.match(product, /\{marketSellerLine\(\) \?\? "CornerMex"\}/);
  assert.doesNotMatch(product, /sellerOfRecordLine/);
  assert.match(product, /addToCart/);
  assert.match(product, /Agregar al carrito/);
});

test("Cart preserves single-merchant identity and routes cleanly to checkout", async () => {
  const [cart, catalog] = await Promise.all([
    read("src/routes/cart.tsx"),
    read("src/lib/catalog.functions.ts"),
  ]);
  assert.match(cart, /group\.sellerName/);
  assert.match(cart, /to="\/checkout"/);
  assert.match(
    cart,
    /El precio vigente, la disponibilidad y el envío se confirman\s+al finalizar la compra/,
  );
  assert.doesNotMatch(cart, />B2C cart</);
  assert.match(catalog, /slug: "cornermex", name: "CornerMex"/);
});

test("Checkout is server-priced and offers only the payment methods the server enables", async () => {
  const checkout = await read("src/routes/checkout.tsx");
  assert.match(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/);
  assert.match(checkout, /Boolean\(user\)/);
  assert.match(checkout, /quoteMxShipping/);
  assert.match(checkout, /placeMxOrder/);
  // Methods come from the server configuration; none is hardcoded as available.
  assert.match(checkout, /config\?\.paymentOptions \?\? \[\]/);
  assert.doesNotMatch(checkout, /codOnly|getCardCheckoutCapability|initiateCardCheckout/);
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
  assert.match(hero, /CornerMex · Catálogo para negocios/);
  assert.match(hero, /href="#business-products"/);
  assert.match(grid, /id="business-products"/);
  assert.match(quote, /submitB2bLead/);
  assert.match(quote, /Cotización revisada por una persona/);
  assert.match(leads, /submit_b2b_lead_v2/);
});

test("Admin journey stays role-gated, presentation-ready and operationally truthful", async () => {
  const [admin, overview, leads] = await Promise.all([
    read("src/routes/_authenticated/admin.tsx"),
    read("src/routes/_authenticated/admin.index.tsx"),
    read("src/routes/_authenticated/admin.leads.index.tsx"),
  ]);
  assert.match(admin, /getRouteAdminState/);
  assert.match(admin, /resolveRouteAccess/);
  assert.match(admin, /title="CornerMex Admin"/);
  assert.match(admin, /to: "\/admin\/orders"/);
  assert.match(admin, /to: "\/admin\/leads"/);
  assert.match(overview, /Live first-party order, customer and catalogue metrics/);
  assert.match(overview, /UAE operations/);
  assert.doesNotMatch(overview, /Canonical production model/);
  assert.match(leads, /adminListB2bLeads/);
  assert.match(leads, /Human-owned commercial pipeline/);
  assert.match(leads, /No B2B enquiries yet/);
  assert.match(leads, /human review, ownership and follow-up/);
});
