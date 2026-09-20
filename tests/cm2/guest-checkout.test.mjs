// Guest checkout wiring (founder decision 2026-09-20): buying never requires an
// account, and guest and authenticated orders share one canonical pipeline.
// The SQL contract itself is proven in scripts/cm2/test-launch-hardening-sql.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(p, "utf8");

test("checkout has no account wall and offers sign-in only as a convenience", async () => {
  const checkout = await read("src/routes/checkout.tsx");
  assert.doesNotMatch(checkout, /COD_ORDER_SIGN_IN_REQUIRED/, "guests must not be blocked");
  assert.doesNotMatch(checkout, /Sign in before an authorized checkout/);
  assert.match(checkout, /Sign in for faster checkout/, "sign-in stays optional");
  // Readiness depends on an identity, not on a session.
  assert.match(checkout, /const identityReady = Boolean\(user\) \|\| guestEmailValid;/);
  assert.match(checkout, /readyToOrder =\s*\n?\s*identityReady/);
});

test("the guest email is collected and sent only when there is no session", async () => {
  const checkout = await read("src/routes/checkout.tsx");
  assert.match(checkout, /id="checkout-email"/);
  assert.match(checkout, /\{!user && \(/, "the email field is for guests");
  assert.match(
    checkout,
    /const guestEmail = user \? null : form\.email\.trim\(\)\.toLowerCase\(\);/,
  );
  assert.match(checkout, /guest: \{ email: guestEmail \}/);
});

test("one server endpoint serves both identities through the canonical transaction", async () => {
  const fn = await read("src/lib/cod-order.functions.ts");
  assert.match(fn, /optionalSupabaseAuth/, "optional auth, not required auth");
  assert.doesNotMatch(fn, /requireSupabaseAuth/);
  assert.match(fn, /"cm_create_cod_order_v2" as never/);
  assert.match(fn, /p_guest_email: guestEmail/);
  assert.match(fn, /COD_ORDER_IDENTITY_REQUIRED/, "an order must never be anonymous");
  // No separate, weaker guest engine.
  assert.doesNotMatch(fn, /place_cod_order_v1|insert into public\.orders/i);
});

test("an invalid session is rejected rather than downgraded to a guest order", async () => {
  const middleware = await read("src/integrations/supabase/optional-auth-middleware.ts");
  assert.match(middleware, /Unauthorized: Invalid token/);
  assert.match(
    middleware,
    /if \(!authHeader\) \{[\s\S]{0,200}userId: null/,
    "no header means guest",
  );
});

test("the guest tracking token is stored locally and never placed in a URL", async () => {
  const store = await read("src/lib/guest-order-token.ts");
  const confirmed = await read("src/routes/order-confirmed.tsx");
  assert.match(store, /localStorage/);
  assert.match(confirmed, /guestOrderToken\(order\)/);
  // The route's search schema carries only the order id.
  assert.match(confirmed, /validateSearch[\s\S]{0,200}order:/);
  assert.doesNotMatch(confirmed, /search\.token|token=\$\{|navigate\([^)]*token/);
});

test("guest order lookup and claim go through the token-scoped RPCs", async () => {
  const fn = await read("src/lib/guest-order.functions.ts");
  assert.match(fn, /cm_guest_order_by_token_v1/);
  assert.match(fn, /cm_claim_guest_order_v1/);
  assert.match(
    fn,
    /token: z\.string\(\)\.regex\(\/\^\[0-9a-f\]\{64\}\$\//,
    "token shape is validated",
  );
  // Claiming requires a session; looking up with a token does not.
  const claim = fn.slice(fn.indexOf("export const claimGuestOrder"));
  assert.match(claim, /requireSupabaseAuth/);
  const lookup = fn.slice(
    fn.indexOf("export const getGuestOrder"),
    fn.indexOf("export const claimGuestOrder"),
  );
  assert.doesNotMatch(lookup, /requireSupabaseAuth/);
});

test("the guest cart is a single local source of truth, so signing in cannot duplicate it", async () => {
  const cart = await read("src/lib/cart.ts");
  // One persisted store, keyed globally rather than per user: a guest cart is
  // the same cart after sign-in, so there is nothing to merge and no way to
  // double quantities.
  assert.match(cart, /export const B2C_CART_STORAGE_KEY = "cornermex-cart-v1"/);
  assert.doesNotMatch(cart, /user|session|buyer/i, "the cart key must not vary by identity");
  assert.match(cart, /persist\(/);
});

test("the migrations keep one engine and one identity rule", async () => {
  const schema = await read("supabase/migrations/20260919115000_cm2_guest_checkout_schema.sql");
  assert.match(schema, /alter column buyer_id drop not null/);
  assert.match(schema, /orders_identity_check/);
  assert.match(schema, /create or replace function public\.place_cod_order_v2/);
  // v1 becomes a wrapper so there is still a single implementation.
  assert.match(schema, /select public\.place_cod_order_v2\(/);
  assert.match(schema, /guest_order_access/);
  assert.doesNotMatch(schema, /drop table|delete from public\.orders/);

  const idem = await read("supabase/migrations/20260919121000_cm2_cod_order_idempotency.sql");
  assert.match(idem, /guest_checkout_operations/);
  assert.match(idem, /GUEST_ORDER_RATE_LIMITED/, "COD abuse control");
  assert.match(idem, /ORDER_CLAIM_EMAIL_NOT_VERIFIED/, "claim needs a verified email");
  assert.match(idem, /char_length\(p_token\) <> 64/, "token shape is checked in SQL too");
});
