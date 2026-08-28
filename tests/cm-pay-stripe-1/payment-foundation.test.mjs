import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  reconcilePaymentState,
  transitionFromVerifiedStripeEvent,
} from "../../src/lib/payment-state.ts";
import { verifyStripeWebhookEvent } from "../../src/lib/stripe-webhook-verification.ts";

const read = (path) => readFile(path, "utf8");
const paidSession = {
  type: "checkout.session.completed",
  checkoutPaymentStatus: "paid",
  amountAed: 42,
};

test("duplicate verified paid webhook is an idempotent no-op", async () => {
  assert.equal(transitionFromVerifiedStripeEvent("paid", paidSession), null);
  const migration = await read(
    "supabase/migrations/20260828180000_cm_pay_stripe_1_payment_foundation.sql",
  );
  assert.match(migration, /unique \(provider, provider_event_id\)/);
  assert.match(migration, /on conflict \(provider, provider_event_id\) do nothing/i);
});

test("out-of-order events cannot regress paid truth, while a verified success can repair a late expiry", () => {
  assert.equal(
    transitionFromVerifiedStripeEvent("paid", {
      type: "checkout.session.async_payment_failed",
      amountAed: 42,
    }),
    null,
  );
  assert.deepEqual(
    transitionFromVerifiedStripeEvent("cancelled", {
      type: "checkout.session.async_payment_succeeded",
      amountAed: 42,
    }),
    { next: "paid" },
  );
});

test("a browser success redirect has no payment mutation authority", async () => {
  const confirmation = await read("src/lib/payments.functions.ts");
  const route = await read("src/routes/order-confirmed.tsx");
  const block = confirmation.slice(
    confirmation.indexOf("export const getOrderPaymentConfirmation"),
    confirmation.indexOf("export const getOrderForConfirmation"),
  );
  assert.match(block, /Read-only by design/);
  assert.doesNotMatch(block, /\.update\(|\.insert\(|\.rpc\(/);
  assert.match(route, /redirect\(\{ to: "\/cart" \}\)/);
});

test("webhook verification uses the raw body and rejects invalid signatures before mutations", async () => {
  const source = await read("src/routes/api/public/stripe-webhook.ts");
  assert.match(source, /const rawBody = await request\.text\(\)/);
  assert.match(
    source,
    /verifyStripeWebhookEvent\(\{[\s\S]*?rawBody,[\s\S]*?signature,[\s\S]*?webhookSecret/,
  );
  assert.match(source, /Invalid signature/);
  assert.match(source, /verifyStripeWebhookEvent[\s\S]*?await process\(/);
  let calls = 0;
  const rejected = verifyStripeWebhookEvent({
    rawBody: '{"id":"evt_bad"}',
    signature: "bad",
    webhookSecret: "whsec_test_only",
    constructEvent: () => {
      calls += 1;
      throw new Error("signature failure");
    },
  });
  assert.deepEqual(rejected, { ok: false });
  assert.equal(calls, 1);

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe("sk_webhook_verification_only");
  const rawBody = '{"id":"evt_test_signed","object":"event"}';
  const webhookSecret = "whsec_test_only";
  const verified = verifyStripeWebhookEvent({
    rawBody,
    signature: stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: webhookSecret,
    }),
    webhookSecret,
    constructEvent: (body, signature, secret) =>
      stripe.webhooks.constructEvent(body, signature, secret),
  });
  assert.equal(verified.ok, true);
});

test("pending transitions to paid only from a verified provider event", () => {
  assert.deepEqual(transitionFromVerifiedStripeEvent("pending", paidSession), { next: "paid" });
  assert.deepEqual(
    transitionFromVerifiedStripeEvent("pending", {
      type: "checkout.session.completed",
      checkoutPaymentStatus: "unpaid",
      amountAed: 42,
    }),
    { next: "under_review" },
  );
});

test("failed attempts can be retried with a new verified success", () => {
  assert.deepEqual(transitionFromVerifiedStripeEvent("failed", paidSession), { next: "paid" });
});

test("full and partial refunds preserve the existing order-state semantics", () => {
  assert.deepEqual(
    transitionFromVerifiedStripeEvent("paid", {
      type: "charge.refunded",
      amountAed: 42,
      refundedAmountAed: 10,
    }),
    { next: "paid", refundedAmountAed: 10 },
  );
  assert.deepEqual(
    transitionFromVerifiedStripeEvent("paid", {
      type: "charge.refunded",
      amountAed: 42,
      refundedAmountAed: 42,
    }),
    { next: "refunded", refundedAmountAed: 42 },
  );
});

test("ambiguous provider timeout keeps one resumable attempt and its Stripe idempotency key", async () => {
  const source = await read("src/lib/payments.functions.ts");
  const migration = await read(
    "supabase/migrations/20260828180000_cm_pay_stripe_1_payment_foundation.sql",
  );
  assert.match(source, /idempotencyKey: `cm-pay-stripe-attempt-\$\{attempt\.payment_id\}`/);
  assert.match(source, /cm_pay_note_stripe_attempt_degraded_v1/);
  assert.match(migration, /same attempt[\s\S]*?reuses its idempotency key/i);
  assert.doesNotMatch(source, /cm_pay_mark_stripe_attempt_unavailable_v1/);
});

test("reconciliation exposes drift without exposing raw payment data", () => {
  assert.deepEqual(
    reconcilePaymentState({
      orderPaymentStatus: "pending",
      orderTotalAed: 42,
      paymentMethod: "card",
      attempts: [
        {
          provider: "stripe",
          providerReference: "cs_test_1",
          status: "paid",
          amountAed: 42,
        },
      ],
    }),
    ["order_payment_status_drift"],
  );
  assert.deepEqual(
    reconcilePaymentState({
      orderPaymentStatus: "paid",
      orderTotalAed: 42,
      paymentMethod: "card",
      attempts: [],
    }),
    ["missing_paid_attempt"],
  );
  assert.deepEqual(
    reconcilePaymentState({
      orderPaymentStatus: "refunded",
      orderTotalAed: 42,
      paymentMethod: "card",
      attempts: [],
    }),
    ["missing_refunded_attempt"],
  );
});

test("server payment code has no browser secret or raw payment logging", async () => {
  const combined = await Promise.all([
    read("src/lib/payments.functions.ts"),
    read("src/lib/stripe-checkout-provider.server.ts"),
    read("src/routes/api/public/stripe-webhook.ts"),
  ]);
  const source = combined.join("\n");
  assert.doesNotMatch(source, /VITE_[A-Z0-9_]*(?:SECRET|STRIPE)/);
  assert.doesNotMatch(source, /console\.(?:log|error).*?(?:rawBody|webhookSecret|secretKey)/i);
});
