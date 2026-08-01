import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public chrome presents a truthful phase-one commercial preview", async () => {
  const [header, footer, home, shop, filters] = await Promise.all([
    source("src/components/site/Header.tsx"),
    source("src/components/site/Footer.tsx"),
    source("src/routes/index.tsx"),
    source("src/routes/shop.tsx"),
    source("src/components/site/ShopFilters.tsx"),
  ]);

  assert.match(header, /Commercial preview/);
  assert.match(
    footer,
    /Ordering, checkout, payment, live stock and\s+automated messages are not available/,
  );
  assert.match(shop, /Product discovery only/);
  assert.match(home, /UAE commercial preview/);
  assert.doesNotMatch(filters, /In stock only|title="Availability"/);

  for (const forbiddenPath of ['to="/cart"', 'to="/signup"', 'to="/account"', 'to="/sellers']) {
    assert.doesNotMatch(`${header}\n${footer}`, new RegExp(forbiddenPath.replace(/["/]/g, "\\$&")));
  }
});

test("public conversion surfaces contain no database or automated-message writes", async () => {
  const paths = [
    "src/components/site/Footer.tsx",
    "src/components/site/ProductCard.tsx",
    "src/routes/b2b_.lead.tsx",
    "src/routes/cart.tsx",
    "src/routes/checkout.tsx",
    "src/routes/checkout.bnpl.$provider.$orderId.tsx",
    "src/routes/login.tsx",
    "src/routes/order-confirmed.tsx",
    "src/routes/product.$slug.tsx",
    "src/routes/signup.tsx",
  ];
  const combined = (await Promise.all(paths.map(source))).join("\n");

  for (const forbidden of [
    "subscribeNewsletter",
    "submitB2bLead",
    "trackCatalogEvent",
    "trackProductView",
    "trackEvent(",
    "supabase.auth.signUp",
    "supabase.auth.signIn",
    "toggleWishlist",
    "useCart(",
    "addToCart",
  ]) {
    assert.doesNotMatch(combined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("canonical URLs are domain-ready and contain no legacy Lovable origin", async () => {
  const paths = [
    "src/lib/site-url.ts",
    "src/routes/__root.tsx",
    "src/routes/index.tsx",
    "src/routes/about.tsx",
    "src/routes/b2b.tsx",
    "src/routes/product.$slug.tsx",
    "src/routes/legal.index.tsx",
  ];
  const combined = (await Promise.all(paths.map(source))).join("\n");

  assert.doesNotMatch(combined, /corner-mex-uae\.lovable\.app/);
  assert.match(combined, /CORNERMEX_PUBLIC_APPLICATION_URL/);
  assert.match(combined, /siteUrl\(/);
});

test("shipping, returns, privacy and terms are discoverable without unsupported SLAs", async () => {
  const [footer, shipping, returns, privacy, terms] = await Promise.all([
    source("src/components/site/Footer.tsx"),
    source("src/routes/shipping.tsx"),
    source("src/routes/returns.tsx"),
    source("src/routes/privacy.tsx"),
    source("src/routes/terms.tsx"),
  ]);

  for (const path of ["/shipping", "/returns", "/privacy", "/terms"]) {
    assert.match(footer, new RegExp(`to=\\"${path}\\"`));
  }
  const policies = `${shipping}\n${returns}\n${privacy}\n${terms}`;
  assert.match(policies, /online ordering and shipping are not active/i);
  assert.match(policies, /does not create an order/i);
  assert.doesNotMatch(
    policies,
    /same[- ]day|within one business day|free shipping|guaranteed delivery/i,
  );
});

test("checkout is fail-closed and public sitemaps exclude seller routes", async () => {
  const [checkout, bnpl, orderConfirmed, sitemap, publicSitemap] = await Promise.all([
    source("src/routes/checkout.tsx"),
    source("src/routes/checkout.bnpl.$provider.$orderId.tsx"),
    source("src/routes/order-confirmed.tsx"),
    source("src/routes/sitemap[.]xml.ts"),
    source("src/routes/api/public/sitemap[.]xml.ts"),
  ]);

  assert.match(checkout, /beforeLoad:[\s\S]*throw redirect\(\{ to: "\/cart" \}\)/);
  assert.match(bnpl, /throw redirect\(\{ to: "\/cart" \}\)/);
  assert.match(orderConfirmed, /throw redirect\(\{ to: "\/cart" \}\)/);
  assert.doesNotMatch(checkout.match(/beforeLoad:[\s\S]*?\n\s*},/)?.[0] ?? "", /CHECKOUT_ENABLED/);
  assert.doesNotMatch(`${sitemap}\n${publicSitemap}`, /loc: `\$\{origin\}\/sellers|"\/sellers"/);
});
