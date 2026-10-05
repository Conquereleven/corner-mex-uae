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

// ── Browser card payments (Mercado Pago Card Payment Brick) ────────────────

test("card data never passes through CornerMex: only a single-use token is accepted", async () => {
  const source = await readFile("src/lib/mx-checkout.functions.ts", "utf8");
  const schema = source.slice(
    source.indexOf("export const PlaceMxOrderInput"),
    source.indexOf("export type MxPaymentStep"),
  );
  // The card object is strict and holds a token, a method id and installments.
  const card = schema.slice(schema.indexOf("card: z"), schema.indexOf("legal_acceptance"));
  assert.match(card, /token: z\.string\(\)\.regex\(/);
  assert.match(card, /payment_method_id: z\.string\(\)\.regex\(/);
  assert.match(card, /installments: z\.number\(\)\.int\(\)/);
  assert.match(
    card,
    /\.strict\(\)\s*\.optional\(\)/,
    "no other field can ride along with the token",
  );
  // Checked on the code, not on the comment that explains the rule.
  assert.doesNotMatch(
    schema.replace(/\/\/.*$/gm, ""),
    /card_number|cardNumber|cvv|cvc|security_code|expiration|expiry/i,
  );

  const brick = await readFile("src/components/site/MercadoPagoCardBrick.tsx", "utf8");
  // The form is Mercado Pago's own; this component renders no card input.
  assert.match(brick, /https:\/\/sdk\.mercadopago\.com\/js\/v2/);
  assert.doesNotMatch(brick, /<input|<Input/);
  assert.doesNotMatch(
    brick.replace(/\/\/.*$/gm, ""),
    /card_number|cardNumber|cvv|cvc|security_code/i,
  );
  // The Access Token is server-side only and never referenced by browser code.
  for (const file of ["src/components/site/MercadoPagoCardBrick.tsx", "src/routes/checkout.tsx"]) {
    assert.doesNotMatch(
      await readFile(file, "utf8"),
      /ACCESS_TOKEN|WEBHOOK_SECRET|API_SECRET|SERVICE_ROLE/,
      file,
    );
  }
});

test("a card payment is applied by re-reading the provider, and a decline keeps the cart", async () => {
  const source = await readFile("src/lib/mx-checkout.functions.ts", "utf8");
  const settle = source.slice(
    source.indexOf("if (data.card && provider.id"),
    source.indexOf("return { ...base, payment: paymentStep(payment) };"),
  );
  assert.match(
    settle,
    /reconcileOrderPayment\(db, payload\.order_id/,
    "a card result is never trusted from the create call alone",
  );
  const checkout = await readFile("src/routes/checkout.tsx", "utf8");
  const declined = checkout.slice(
    checkout.indexOf('order.payment.state === "FAILED"'),
    checkout.indexOf("// Only clear the cart after the order genuinely exists."),
  );
  assert.match(declined, /CHECKOUT_CARD_DECLINED/);
  assert.doesNotMatch(declined, /clear\(\);/, "a declined card must not empty the cart");
  // The amount the Brick shows is display only; the server never reads one.
  assert.doesNotMatch(
    source.slice(source.indexOf("card: z")),
    /data\.card\.amount|transaction_amount/,
  );
});

test("the Public Key is published only for the matching environment", async () => {
  const config = await import("../../src/lib/mx-checkout-config.server.ts");
  assert.equal(config.mercadoPagoPublicKey({}), null);
  assert.equal(config.mercadoPagoPublicKey({ MERCADO_PAGO_PUBLIC_KEY: "TEST-pk" }), "TEST-pk");
  // A production key in a sandbox deployment, or a test key in production, is refused.
  assert.equal(config.mercadoPagoPublicKey({ MERCADO_PAGO_PUBLIC_KEY: "APP_USR-pk" }), null);
  assert.equal(
    config.mercadoPagoPublicKey({
      MERCADO_PAGO_PUBLIC_KEY: "TEST-pk",
      MERCADO_PAGO_ENVIRONMENT: "production",
    }),
    null,
  );
  assert.equal(
    config.mercadoPagoPublicKey({
      MERCADO_PAGO_PUBLIC_KEY: "APP_USR-pk",
      MERCADO_PAGO_ENVIRONMENT: "production",
    }),
    "APP_USR-pk",
  );
  // Without Mercado Pago enabled the checkout is told nothing.
  assert.equal(
    config.getPublicMxCheckoutConfig({ MERCADO_PAGO_PUBLIC_KEY: "TEST-pk" }).mercadoPagoPublicKey,
    null,
  );
});

// ── Shipping webhooks ──────────────────────────────────────────────────────

const shipping = await import("../../src/lib/mx-shipping-webhooks.server.ts");
const carrierHook = await import("../../src/lib/shipping/webhook.server.ts");

function shippingDatabase() {
  const calls = [];
  const events = new Map();
  return {
    calls,
    async rpc(name, args = {}) {
      calls.push({ name, args });
      if (name === "cm_market_identity_v1")
        return { data: { market: "MX", currency: "MXN" }, error: null };
      if (name === "cm_mx_claim_webhook_event_v1") {
        const key = `${args.p_provider}|${args.p_external_event_id}`;
        if (events.has(key) && events.get(key) !== "failed") return { data: false, error: null };
        events.set(key, "processing");
        return { data: true, error: null };
      }
      if (name === "cm_mx_complete_webhook_event_v1") {
        events.set(`${args.p_provider}|${args.p_external_event_id}`, args.p_status);
        return { data: null, error: null };
      }
      if (name === "cm_mx_apply_shipment_event_v1") return { data: { applied: true }, error: null };
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

const packageEvent = (status = "in_transit") =>
  JSON.stringify({
    data: {
      id: "6172eb82-7b0b-4852-9954-b1ac1c20e4f8",
      type: "packages",
      attributes: {
        status,
        tracking_number: "794874381730",
        tracking_url_provider: "https://carrier.example.test/t",
        label_url: "",
      },
      relationships: {
        shipment: { data: { id: "93774c22-8275-4757-9963-71b79b2e8db7", type: "shipments" } },
      },
    },
  });

test("a signed carrier event updates the shipment once; a duplicate does nothing", async () => {
  const db = shippingDatabase();
  const rawBody = packageEvent();
  const input = {
    db,
    provider: "skydropx",
    rawBody,
    signature: carrierHook.signShippingWebhook(rawBody, "carrier-secret"),
    secret: "carrier-secret",
  };
  assert.deepEqual(await shipping.handleShippingWebhook(input), { status: 200, body: "processed" });
  const applied = db.calls.filter((call) => call.name === "cm_mx_apply_shipment_event_v1");
  assert.deepEqual(applied[0].args, {
    p_provider: "skydropx",
    p_provider_shipment_id: "93774c22-8275-4757-9963-71b79b2e8db7",
    p_status: "IN_TRANSIT",
    p_raw_status: "in_transit",
    p_tracking_number: "794874381730",
    p_tracking_url: "https://carrier.example.test/t",
    p_label_url: null,
  });
  // The carrier re-delivers twice, five minutes apart.
  assert.deepEqual(await shipping.handleShippingWebhook(input), { status: 200, body: "duplicate" });
  assert.equal(db.calls.filter((call) => call.name === "cm_mx_apply_shipment_event_v1").length, 1);
});

test("unsigned, wrongly signed and unconfigured carrier events are refused and leave no trace", async () => {
  const rawBody = packageEvent("delivered");
  for (const [signature, secret] of [
    [null, "carrier-secret"],
    ["Bearer static-token", "carrier-secret"],
    [carrierHook.signShippingWebhook(rawBody, "attacker"), "carrier-secret"],
    [carrierHook.signShippingWebhook(rawBody, "carrier-secret"), undefined],
  ]) {
    const db = shippingDatabase();
    const result = await shipping.handleShippingWebhook({
      db,
      provider: "solo_envios",
      rawBody,
      signature,
      secret,
    });
    assert.equal(result.status, 401);
    assert.equal(db.calls.length, 0);
  }
  assert.equal(shipping.shippingWebhookSecret("skydropx", {}), undefined);
  assert.equal(
    shipping.shippingWebhookSecret("solo_envios", { SOLO_ENVIOS_WEBHOOK_SECRET: " s " }),
    "s",
  );
});

test("an unknown carrier status is recorded raw and never guessed", async () => {
  const db = shippingDatabase();
  const rawBody = packageEvent("teleported");
  await shipping.handleShippingWebhook({
    db,
    provider: "skydropx",
    rawBody,
    signature: carrierHook.signShippingWebhook(rawBody, "s"),
    secret: "s",
  });
  const applied = db.calls.find((call) => call.name === "cm_mx_apply_shipment_event_v1");
  assert.deepEqual([applied.args.p_status, applied.args.p_raw_status], [null, "teleported"]);
});

test("order and quotation notifications on the same endpoint are acknowledged and ignored", async () => {
  const db = shippingDatabase();
  const rawBody = JSON.stringify({
    data: { id: "1f92595c", type: "orders", attributes: { status: "sent" } },
  });
  const result = await shipping.handleShippingWebhook({
    db,
    provider: "skydropx",
    rawBody,
    signature: carrierHook.signShippingWebhook(rawBody, "s"),
    secret: "s",
  });
  assert.deepEqual(result, { status: 200, body: "ignored" });
  assert.equal(db.calls.length, 0);
});
