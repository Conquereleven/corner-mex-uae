import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { safeInternalRedirect } from "../../src/lib/safe-internal-redirect.ts";
import {
  isCheckoutExecutionEnabled,
  assertCheckoutExecutionEnabled,
} from "../../src/lib/checkout-execution.server.ts";
import { B2B_CATEGORIES, WAVE_1_PRODUCTS } from "../../src/features/b2b-catalog/wave1-products.ts";
import {
  QUOTE_SELECTION_STORAGE_KEY,
  clearQuoteSelection,
} from "../../src/features/b2b-catalog/quote-selection.ts";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const login = read("src/routes/login.tsx");
const protectedRoute = read("src/routes/_authenticated.tsx");
const adminRoute = read("src/routes/_authenticated/admin.tsx");
const routeAuth = read("src/lib/route-auth.functions.ts");
const account = read("src/routes/_authenticated/account.index.tsx");
const header = read("src/components/site/Header.tsx");
const product = read("src/routes/product.$slug.tsx");
const cartStore = read("src/lib/cart.ts");
const cartRoute = read("src/routes/cart.tsx");
const checkout = read("src/routes/checkout.tsx");
const orders = read("src/lib/orders.functions.ts");
const payments = read("src/lib/payments.functions.ts");
const quote = read("src/routes/b2b_.quote.tsx");
const b2bSurface = [
  read("src/routes/b2b_.catalog.tsx"),
  quote,
  read("src/components/b2b/B2bProductCard.tsx"),
].join("\n");
const boundaries = read("src/lib/commerce-flow-boundaries.ts");

test("login renders email/password auth instead of the unavailable preview", () => {
  assert.match(login, /signInWithPassword\(\{ email, password \}\)/);
  assert.doesNotMatch(login, /LoginUnavailable|Accounts unavailable/);
});

test("safe redirect accepts internal paths and rejects external forms", () => {
  assert.equal(safeInternalRedirect("/account?tab=orders"), "/account?tab=orders");
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(safeInternalRedirect(value), "/");
  }
});

test("protected routes redirect unauthenticated users to login", () => {
  assert.match(protectedRoute, /await getRouteAuthState\(\)/);
  assert.match(protectedRoute, /to: "\/login"/);
  assert.doesNotMatch(protectedRoute, /typeof window/);
});

test("admin route invokes the role gate and rejects non-admins", () => {
  assert.match(adminRoute, /await getRouteAdminState\(\)/);
  assert.match(adminRoute, /access === "account"/);
  assert.doesNotMatch(adminRoute, /typeof window/);
  assert.match(routeAuth, /supabase\.auth\.getClaims\(\)/);
  assert.match(routeAuth, /\.from\("user_roles"\)/);
});

test("account exposes Admin only for admin=true and restores sign-out", () => {
  assert.match(account, /admin\.data\?\.admin &&[\s\S]*to="\/admin"/);
  assert.match(account, /supabase\.auth\.signOut\(\)/);
});

test("no Claim admin or Lovable OAuth control is rendered", () => {
  assert.doesNotMatch(account, /AdminBootstrapCard|adminBootstrap|Claim admin/i);
  assert.match(login, /supabase\.auth\.signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.doesNotMatch(login, /lovableAuth|integrations\/lovable/i);
});

test("product supports variant selection, quantity, and Add to cart", () => {
  assert.match(product, /setVariantId/);
  assert.match(product, /setQuantity/);
  assert.match(product, /Add to cart/);
});

test("B2C storage key remains exact", () => {
  assert.match(cartStore, /B2C_CART_STORAGE_KEY = "cornermex-cart-v1"/);
});

test("header cart counter sums B2C quantities", () => {
  assert.match(header, /items\.reduce\(\(total, item\) => total \+ item\.qty, 0\)/);
  assert.match(header, /cartCount > 0/);
});

test("cart supports quantity updates and removal", () => {
  assert.match(cartRoute, /setQty\(item\.variantId/);
  assert.match(cartRoute, /remove\(item\.variantId\)/);
});

test("checkout is a rendered interface, not a redirect", () => {
  assert.match(checkout, /component: Checkout/);
  assert.doesNotMatch(checkout, /beforeLoad:[\s\S]*redirect/);
});

test("client checkout gate accepts only exact true", () => {
  assert.match(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/);
});

test("final action is disabled when execution prerequisites are false", () => {
  assert.match(checkout, /const canExecute = CHECKOUT_ENABLED &&/);
  assert.match(checkout, /disabled=\{!canExecute \|\| submitting\}/);
});

test("server checkout gate defaults off and accepts only exact true", () => {
  for (const value of [undefined, "", "TRUE", "1", " true", "false"])
    assert.equal(isCheckoutExecutionEnabled(value), false);
  assert.equal(isCheckoutExecutionEnabled("true"), true);
  assert.throws(() => assertCheckoutExecutionEnabled(undefined), /CHECKOUT_EXECUTION_DISABLED/);
});

test("placeOrder gates before database or external effects", () => {
  const handler = orders.indexOf(".handler(async ({ data, context }) => {");
  const gate = orders.indexOf("assertCheckoutExecutionEnabled();", handler);
  const database = orders.indexOf("supabaseAdmin", handler);
  assert.ok(handler >= 0 && gate > handler && gate < database);
});

test("payment and confirmation functions independently fail closed", () => {
  assert.equal((payments.match(/assertCheckoutExecutionEnabled\(\);/g) ?? []).length, 3);
  for (const name of ["createStripeSession", "confirmBnplPayment", "getOrderForConfirmation"]) {
    const start = payments.indexOf(`export const ${name}`);
    const next = payments.indexOf("export const ", start + 1);
    const block = payments.slice(start, next < 0 ? undefined : next);
    assert.match(block, /\.handler[\s\S]*\{\s*assertCheckoutExecutionEnabled\(\);/);
  }
});

test("no AED 25 shipping fallback is authoritative", () => {
  assert.match(cartRoute, /Pending destination check/);
  // CM-COM-3A replaced the placeholder shipping line with the Founder-approved
  // per-emirate rate, which the SERVER computes. The browser must still never
  // derive a shipping amount of its own.
  assert.match(checkout, /preview \? `AED \$\{preview\.shippingAed/);
  assert.doesNotMatch(`${cartStore}\n${orders}`, /shipping\s*=.*25|:\s*25\b|size \* 25/);
  assert.doesNotMatch(checkout, /shipping\s*=\s*\d/);
});

test("low-stock and guaranteed-delivery claims are not restored", () => {
  assert.doesNotMatch(
    `${product}\n${cartRoute}\n${checkout}`,
    /Only .* left|left in stock|guaranteed delivery/i,
  );
});

test("B2B selection key and approved 15-product mix remain exact", () => {
  assert.equal(QUOTE_SELECTION_STORAGE_KEY, "cm.quoteSelection");
  assert.equal(WAVE_1_PRODUCTS.length, 15);
  assert.deepEqual(
    B2B_CATEGORIES.map((category) => category.count),
    [7, 5, 3],
  );
});

test("B2B surface has no public numeric prices or automated submission", () => {
  assert.doesNotMatch(b2bSurface, /\bAED\s*\d|unit_price|placeOrder|createServerFn|fetch\s*\(/i);
  assert.match(b2bSurface, /Price on request/);
});

test("boundary manifest uses different storage and gives B2B no execution path", () => {
  assert.match(boundaries, /storage: "localStorage"[\s\S]*storage: "sessionStorage"/);
  assert.match(boundaries, /execution: null/);
});

test("clearing B2B removes only its session key", () => {
  const calls = [];
  const sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: (key) => calls.push(key),
  };
  clearQuoteSelection(sessionStorage);
  assert.deepEqual(calls, ["cm.quoteSelection"]);
  assert.notEqual(calls[0], "cornermex-cart-v1");
});

test("checkout and B2B quote do not import each other's state or execution", () => {
  assert.doesNotMatch(checkout, /quote-selection|useQuoteSelection|cm\.quoteSelection/);
  assert.doesNotMatch(quote, /useCart|cornermex-cart-v1|placeOrder|createStripeSession/);
});

test("navigation clearly preserves Shop, Business, Account or Sign in, and Cart", () => {
  for (const label of ["Shop", "Business", "Account", "Sign in", "Cart"])
    assert.match(header, new RegExp(label));
});
