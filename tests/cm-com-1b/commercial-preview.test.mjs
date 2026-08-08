import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public chrome truthfully presents independent B2C and B2B surfaces", async () => {
  const [header, footer, home, shop, filters, login, cart, checkout] = await Promise.all([
    source("src/components/site/Header.tsx"),
    source("src/components/site/Footer.tsx"),
    source("src/routes/index.tsx"),
    source("src/routes/shop.tsx"),
    source("src/components/site/ShopFilters.tsx"),
    source("src/routes/login.tsx"),
    source("src/routes/cart.tsx"),
    source("src/routes/checkout.tsx"),
  ]);

  assert.match(header, /Commercial preview/);
  for (const label of ["Shop", "Business", "Account", "Sign in", "Cart"]) {
    assert.match(header, new RegExp(label));
  }
  assert.match(header, /to="\/cart"/);
  assert.match(header, /user \? "\/account" : "\/login"/);
  assert.match(footer, /B2C cart and account access are available/);
  assert.match(
    footer,
    /Checkout and order processing run only\s+when\s+authorized configuration is enabled/,
  );
  assert.match(footer, /B2B quote requests remain manual/);
  assert.match(footer, /does\s+not claim that an order, payment or quote request was processed/);
  assert.doesNotMatch(footer, /Order confirmed|Payment processed|Quote request received/i);
  assert.match(shop, /Product discovery only/);
  assert.match(home, /UAE commercial preview/);
  assert.doesNotMatch(filters, /In stock only|title="Availability"/);
  assert.match(login, /signInWithPassword/);
  assert.match(cart, /component: Cart/);
  assert.match(checkout, /component: Checkout/);
  assert.doesNotMatch(`${header}\n${footer}`, /to="\/(?:signup|sellers)/);
});

test("B2B conversion remains manual without order creation or automated messaging", async () => {
  const paths = [
    "src/components/site/Footer.tsx",
    "src/routes/b2b_.lead.tsx",
    "src/routes/b2b_.catalog.tsx",
    "src/routes/b2b_.quote.tsx",
    "src/components/b2b/ManualQuoteRequestForm.tsx",
    "src/components/b2b/ManualQuoteRequestPreview.tsx",
  ];
  const combined = (await Promise.all(paths.map(source))).join("\n");

  for (const forbidden of [
    "subscribeNewsletter",
    "submitB2bLead",
    "createServerFn",
    "placeOrder",
    "createStripeSession",
    "sendEmail",
    "sendWhatsApp",
    "capturePayment",
    "supabase",
  ]) {
    assert.doesNotMatch(combined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(combined, /Nothing is submitted, sent, or\s+stored by this page/);
  assert.match(combined, /reviewed manually/i);
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

test("delivery, returns, privacy and terms are discoverable without unsupported SLAs", async () => {
  // CM-COM-2A: /shipping became a redirect to /delivery; discoverability moved with it.
  const [footer, shipping, delivery, returns, privacy, terms] = await Promise.all([
    source("src/components/site/Footer.tsx"),
    source("src/routes/shipping.tsx"),
    source("src/routes/delivery.tsx"),
    source("src/routes/returns.tsx"),
    source("src/routes/privacy.tsx"),
    source("src/routes/terms.tsx"),
  ]);

  for (const path of ["/delivery", "/returns", "/privacy", "/terms"]) {
    assert.match(footer, new RegExp(`"${path}"`));
  }
  assert.match(shipping, /redirect\(\{ to: "\/delivery" \}\)/);
  const policies = `${delivery}\n${returns}\n${privacy}\n${terms}`;
  assert.match(policies, /Order execution is not currently enabled/i);
  assert.match(policies, /does not create an order/i);
  assert.doesNotMatch(
    policies,
    /same[- ]day|within one business day|free shipping|guaranteed delivery/i,
  );
});

test("dual commerce execution fails closed and public sitemaps exclude seller routes", async () => {
  const [
    checkout,
    serverGate,
    orders,
    payments,
    bnpl,
    orderConfirmed,
    cartStore,
    quoteSelection,
    b2bQuote,
    sitemap,
    publicSitemap,
  ] = await Promise.all([
    source("src/routes/checkout.tsx"),
    source("src/lib/checkout-execution.server.ts"),
    source("src/lib/orders.functions.ts"),
    source("src/lib/payments.functions.ts"),
    source("src/routes/checkout.bnpl.$provider.$orderId.tsx"),
    source("src/routes/order-confirmed.tsx"),
    source("src/lib/cart.ts"),
    source("src/features/b2b-catalog/quote-selection.ts"),
    source("src/routes/b2b_.quote.tsx"),
    source("src/routes/sitemap[.]xml.ts"),
    source("src/routes/api/public/sitemap[.]xml.ts"),
  ]);

  assert.match(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/);
  assert.match(checkout, /const canExecute = CHECKOUT_ENABLED &&/);
  assert.match(checkout, /disabled=\{!canExecute \|\| submitting\}/);
  assert.match(checkout, /no order or\s+payment will be created/i);
  assert.match(serverGate, /value = process\.env\.CORNERMEX_CHECKOUT_ENABLED/);
  assert.match(serverGate, /return value === "true"/);
  assert.match(serverGate, /throw new Error\(CHECKOUT_EXECUTION_DISABLED\)/);

  const orderHandler = orders.indexOf(".handler(async ({ data, context }) => {");
  const orderGate = orders.indexOf("assertCheckoutExecutionEnabled();", orderHandler);
  const firstOrderEffect = orders.indexOf("supabaseAdmin", orderHandler);
  assert.ok(orderHandler >= 0 && orderGate > orderHandler && orderGate < firstOrderEffect);
  assert.equal((payments.match(/assertCheckoutExecutionEnabled\(\);/g) ?? []).length, 3);

  assert.match(bnpl, /throw redirect\(\{ to: "\/cart" \}\)/);
  assert.match(orderConfirmed, /throw redirect\(\{ to: "\/cart" \}\)/);
  assert.match(cartStore, /B2C_CART_STORAGE_KEY = "cornermex-cart-v1"/);
  assert.match(quoteSelection, /QUOTE_SELECTION_STORAGE_KEY = "cm\.quoteSelection"/);
  assert.doesNotMatch(checkout, /quote-selection|cm\.quoteSelection/);
  assert.doesNotMatch(b2bQuote, /placeOrder|createStripeSession|useCart|cornermex-cart-v1/);
  assert.doesNotMatch(`${sitemap}\n${publicSitemap}`, /loc: `\$\{origin\}\/sellers|"\/sellers"/);
});

test("public legal links only reference slugs supported by legal.$slug", async () => {
  const [legalSlug, cookieConsent] = await Promise.all([
    source("src/routes/legal.$slug.tsx"),
    source("src/components/site/CookieConsent.tsx"),
  ]);

  // Supported slugs are the keys of the CURRENT_POLICIES map; anything else 404s.
  const supported = new Set(
    [...legalSlug.matchAll(/"([a-z-]+)":\s*"\/[a-z-]+"/g)].map((m) => m[1]),
  );
  assert.ok(supported.size > 0, "expected CURRENT_POLICIES to declare supported slugs");

  // The cookie banner renders on every public page; its policy link must resolve.
  assert.ok(supported.has("cookie-policy"), "cookie-policy must be a supported legal slug");
  assert.match(legalSlug, /"cookie-policy":\s*"\/privacy"/);

  // No public-chrome legal link may point at an unsupported (404) slug.
  const referenced = [...cookieConsent.matchAll(/slug:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(referenced.length > 0, "expected CookieConsent to link to a legal slug");
  for (const slug of referenced) {
    assert.ok(supported.has(slug), `CookieConsent links to unsupported legal slug: ${slug}`);
  }
});
