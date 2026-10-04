// The webhook path end to end, against an in-memory stand-in for the Mexico
// database functions: authenticate → record once → re-read the payment from the
// provider → apply through one database call.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await import("../../src/lib/mx-payments.server.ts");
const mp = await import("../../src/lib/payments/mercado-pago.ts");

const NOW = 1_760_000_000_000;
const ORDER_ID = "ORD01J6TC8BYRR0T4ZKY0QR39WGYE";

function fakeDatabase({ identity = { market: "MX", currency: "MXN" }, attempt } = {}) {
  const calls = [];
  const events = new Map();
  const row = attempt ?? {
    attempt_id: "a-1",
    order_id: "o-1",
    order_number: "CM-20261005-ABCD1234",
    provider: "mercado_pago",
    provider_payment_id: ORDER_ID,
    amount: "349.50",
    currency: "MXN",
    status: "pending",
    refunded_amount: "0",
  };
  return {
    calls,
    events,
    async rpc(name, args = {}) {
      calls.push({ name, args });
      switch (name) {
        case "cm_market_identity_v1":
          return identity
            ? { data: identity, error: null }
            : { data: null, error: { message: "function does not exist" } };
        case "cm_mx_claim_webhook_event_v1": {
          const key = `${args.p_provider}|${args.p_external_event_id}`;
          const existing = events.get(key);
          if (existing && existing !== "failed") return { data: false, error: null };
          events.set(key, "processing");
          return { data: true, error: null };
        }
        case "cm_mx_complete_webhook_event_v1":
          events.set(`${args.p_provider}|${args.p_external_event_id}`, args.p_status);
          return { data: null, error: null };
        case "cm_mx_payment_attempt_v1":
        case "cm_mx_order_payment_attempt_v1":
          return { data: row, error: null };
        case "cm_mx_apply_payment_state_v1":
          return { data: { applied: true }, error: null };
        default:
          throw new Error(`unexpected rpc ${name}`);
      }
    },
  };
}

function provider(orderBody) {
  return mp.createMercadoPagoProvider({
    environment: "sandbox",
    accessToken: "TEST-x",
    webhookSecret: "mp-webhook-secret",
    now: () => NOW,
    sleep: async () => {},
    fetch: async () => ({ status: 200, text: async () => JSON.stringify(orderBody) }),
  });
}

const paidOrder = {
  id: ORDER_ID,
  external_reference: "CM-20261005-ABCD1234",
  total_amount: "349.50",
  currency_id: "MXN",
  status: "processed",
  status_detail: "accredited",
  transactions: { payments: [{ id: "PAY-1", amount: "349.50" }] },
};

function webhook(signatureSecret = "mp-webhook-secret") {
  const body = JSON.stringify({
    action: "order.processed",
    type: "order",
    data: { id: ORDER_ID, status: "processed", status_detail: "accredited" },
  });
  const requestId = "2066ca19-c6f1-498a-be75-1923005edd06";
  return {
    rawBody: body,
    headers: {
      "x-signature": mp.signMercadoPagoWebhook(
        { dataId: ORDER_ID, requestId, ts: String(NOW) },
        signatureSecret,
      ),
      "x-request-id": requestId,
    },
    query: { "data.id": ORDER_ID, type: "order" },
  };
}

test.beforeEach(() => server.resetMexicoDatabaseVerification());

test("an authentic event is recorded, the payment re-read and the order updated once", async () => {
  const db = fakeDatabase();
  const first = await server.handlePaymentWebhook({
    db,
    provider: provider(paidOrder),
    request: webhook(),
  });
  assert.deepEqual(first, { status: 200, body: "processed" });
  const applied = db.calls.filter((call) => call.name === "cm_mx_apply_payment_state_v1");
  assert.equal(applied.length, 1);
  assert.deepEqual(applied[0].args, {
    p_provider: "mercado_pago",
    p_provider_payment_id: ORDER_ID,
    p_status: "paid",
    p_amount: 349.5,
    p_refunded_amount: 0,
    p_raw_status: "processed",
    p_raw_status_detail: "accredited",
    p_late_capture: false,
  });
  // The raw event is stored for audit.
  const claim = db.calls.find((call) => call.name === "cm_mx_claim_webhook_event_v1");
  assert.equal(claim.args.p_raw_payload.action, "order.processed");
  assert.match(claim.args.p_payload_hash, /^[0-9a-f]{64}$/);

  // Mercado Pago delivers the same event again.
  const second = await server.handlePaymentWebhook({
    db,
    provider: provider(paidOrder),
    request: webhook(),
  });
  assert.deepEqual(second, { status: 200, body: "duplicate" });
  assert.equal(db.calls.filter((call) => call.name === "cm_mx_apply_payment_state_v1").length, 1);
});

test("a forged event is answered 401 and leaves no trace", async () => {
  const db = fakeDatabase();
  const result = await server.handlePaymentWebhook({
    db,
    provider: provider(paidOrder),
    request: webhook("attacker-secret"),
  });
  assert.deepEqual(result, { status: 401, body: "unauthorized" });
  assert.equal(db.calls.length, 0);
});

test("an unconfigured provider accepts nothing", async () => {
  const db = fakeDatabase();
  const result = await server.handlePaymentWebhook({ db, provider: null, request: webhook() });
  assert.equal(result.status, 503);
  assert.equal(db.calls.length, 0);
});

test("a tampered amount is flagged for review and never recorded as paid", async () => {
  const db = fakeDatabase();
  await server.handlePaymentWebhook({
    db,
    provider: provider({ ...paidOrder, total_amount: "1.00" }),
    request: webhook(),
  });
  const applied = db.calls.filter((call) => call.name === "cm_mx_apply_payment_state_v1");
  assert.equal(applied.length, 1);
  assert.equal(applied[0].args.p_status, "under_review");
  assert.equal(applied[0].args.p_raw_status, "REJECTED_BY_CORNERMEX");
});

test("events are refused when the database is not a Mexico database", async () => {
  // The UAE database has no market identity function.
  const uae = fakeDatabase({ identity: null });
  const refused = await server.handlePaymentWebhook({
    db: uae,
    provider: provider(paidOrder),
    request: webhook(),
  });
  assert.equal(refused.status, 500);
  assert.ok(!uae.calls.some((call) => call.name === "cm_mx_apply_payment_state_v1"));

  const wrong = fakeDatabase({ identity: { market: "AE", currency: "AED" } });
  await assert.rejects(server.assertMexicoDatabase(wrong), /CM_MARKET_DATABASE_MISMATCH/);
  // A wrong answer is never cached: the next call asks again and fails again.
  await assert.rejects(server.assertMexicoDatabase(wrong), /CM_MARKET_DATABASE_MISMATCH/);
  assert.equal(wrong.calls.length, 2);
});

test("the confirmation page's refresh reads the provider, and reports no attempt honestly", async () => {
  const db = fakeDatabase();
  const outcome = await server.reconcileOrderPayment(db, "o-1", () => provider(paidOrder));
  assert.equal(outcome.outcome, "CHANGED");
  assert.equal(outcome.change.to, "PAID");

  server.resetMexicoDatabaseVerification();
  const none = fakeDatabase({ attempt: { provider_payment_id: null } });
  assert.deepEqual(await server.reconcileOrderPayment(none, "o-1", () => provider(paidOrder)), {
    outcome: "NO_ATTEMPT",
  });
  server.resetMexicoDatabaseVerification();
  assert.deepEqual(await server.reconcileOrderPayment(fakeDatabase(), "o-1", () => null), {
    outcome: "PROVIDER_UNAVAILABLE",
  });
});

test("the order function never passes an amount to the payment attempt, and buys no label", async () => {
  const source = await readFile("src/lib/mx-checkout.functions.ts", "utf8");
  const start = source.slice(
    source.indexOf('"cm_mx_start_payment_attempt_v1"'),
    source.indexOf("if (attemptError)"),
  );
  assert.doesNotMatch(
    start,
    /amount|total|price/i,
    "the database reads the amount from the order row",
  );
  assert.match(source, /idempotencyKey: data\.operationId/);
  assert.match(
    source,
    /amount: Number\(attempt\.amount\)/,
    "the provider is given the database's amount",
  );
  assert.doesNotMatch(
    source,
    /createShipment|purchaseLabelOnce|cm_mx_reserve_label_v1/,
    "no label is bought at checkout",
  );
  // Cash on delivery cannot pay for a national parcel.
  assert.match(source, /paymentAllowedFor\(option, quote\.fulfillmentMode\)/);
  // The request schema has no field that could carry money.
  const schema = source.slice(
    source.indexOf("export const PlaceMxOrderInput"),
    source.indexOf("export type MxPaymentStep"),
  );
  assert.doesNotMatch(schema, /price|subtotal|total|tax|amount|discount/i);
});
