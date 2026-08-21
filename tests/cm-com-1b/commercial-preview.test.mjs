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
  assert.match(footer, /B2B enquiries can be submitted/);
  assert.match(footer, /human review/);
  assert.match(footer, /not an order, payment or\s+confirmed quote/);
  assert.doesNotMatch(footer, /Order confirmed|Payment processed|Quote confirmed/i);
  assert.match(shop, /Product discovery only/);
  assert.match(home, /UAE commercial preview/);
  assert.doesNotMatch(filters, /In stock only|title="Availability"/);
  assert.match(login, /signInWithPassword/);
  assert.match(cart, /component: Cart/);
  assert.match(checkout, /component: Checkout/);
  assert.doesNotMatch(`${header}\n${footer}`, /to="\/(?:signup|sellers)/);
});

test("B2B conversion persists an enquiry without creating orders, payments or automated messaging", async () => {
  const [quote, leadServer, preview, leadPage, catalog] = await Promise.all([
    source("src/routes/b2b_.quote.tsx"),
    source("src/lib/b2b-leads.functions.ts"),
    source("src/components/b2b/ManualQuoteRequestPreview.tsx"),
    source("src/routes/b2b_.lead.tsx"),
    source("src/routes/b2b_.catalog.tsx"),
  ]);
  const publicCombined = `${quote}\n${preview}\n${leadPage}\n${catalog}`;

  assert.match(quote, /submitB2bLead/);
  assert.match(preview, /Submit enquiry to CornerMex/);
  assert.match(leadServer, /submit_b2b_lead_v2/);
  assert.match(leadServer, /getB2bIntakeAbuseKey/);
  assert.match(preview, /does not\s+create an order/i);
  assert.match(publicCombined, /human/i);

  for (const forbidden of [
    "placeOrder",
    "createStripeSession",
    "sendEmail",
    "sendWhatsApp",
    "capturePayment",
    "cornermex-cart-v1",
  ]) {
    assert.doesNotMatch(
      `${publicCombined}\n${leadServer}`,
      new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
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
