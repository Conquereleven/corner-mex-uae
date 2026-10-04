// PaymentProvider contract: Mercado Pago (Orders API), Clip (Redirected
// Checkout), the shared state machine and exactly-once event processing.
//
// No network: `transport` stands in for fetch. Shapes follow the providers'
// published documentation (read 2026-10-05).
import assert from "node:assert/strict";
import test from "node:test";

const mp = await import("../../src/lib/payments/mercado-pago.ts");
const clip = await import("../../src/lib/payments/clip.ts");
const state = await import("../../src/lib/payments/state.ts");
const processor = await import("../../src/lib/payments/processor.ts");
const providers = await import("../../src/lib/payments/providers.ts");
const { PaymentError, PAYMENT_STATES } = await import("../../src/lib/payments/types.ts");

function transport(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const key = `${init.method ?? "GET"} ${pathname}`;
    calls.push({ key, url, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null });
    let handler = routes[key];
    if (Array.isArray(handler)) handler = handler.length > 1 ? handler.shift() : handler[0];
    if (!handler) throw new Error(`unexpected request: ${key}`);
    const result = await handler();
    return { status: result.status, text: async () => JSON.stringify(result.body ?? {}) };
  };
  return { fetchImpl, calls, count: (key) => calls.filter((call) => call.key === key).length };
}

const noSleep = async () => {};
const returnUrls = {
  success: "https://tienda.example.test/order-confirmed",
  failure: "https://tienda.example.test/checkout",
  pending: "https://tienda.example.test/order-confirmed",
};
const request = (overrides = {}) => ({
  orderReference: "CM-20261005-ABCD1234",
  amount: 349.5,
  currency: "MXN",
  idempotencyKey: "0b0c9f0e-6a0b-4a52-9a53-4f6f2f6f0001",
  description: "Pedido CM-20261005-ABCD1234",
  payer: { email: "cliente@example.test", firstName: "María" },
  method: { kind: "offline", methodId: "oxxo", methodType: "ticket" },
  returnUrls,
  ...overrides,
});

const mpOrder = (overrides = {}) => ({
  id: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE",
  type: "online",
  processing_mode: "automatic",
  external_reference: "CM-20261005-ABCD1234",
  total_amount: "349.50",
  currency_id: "MXN",
  status: "action_required",
  status_detail: "waiting_payment",
  transactions: {
    payments: [
      {
        id: "PAY01J6TC8BYRR0T4ZKY0QRTZ0E24",
        amount: "349.50",
        status: "action_required",
        status_detail: "waiting_payment",
        payment_method: { id: "oxxo", type: "ticket", ticket_url: "https://mp.example.test/ticket", reference: "1234567890" },
      },
    ],
  },
  ...overrides,
});

function mercadoPago(routes, extra = {}) {
  const t = transport(routes);
  return {
    t,
    provider: mp.createMercadoPagoProvider({
      environment: "sandbox",
      accessToken: "TEST-access-token",
      webhookSecret: "mp-webhook-secret",
      fetch: t.fetchImpl,
      sleep: noSleep,
      ...extra,
    }),
  };
}

// ── State machine ──────────────────────────────────────────────────────────

test("the eight normalised states map onto the canonical stored statuses", () => {
  assert.deepEqual(
    PAYMENT_STATES.map((s) => [s, state.toCanonicalStatus(s)]),
    [
      ["CREATED", "pending"],
      ["PENDING", "pending"],
      ["AUTHORIZED", "authorized"],
      ["PAID", "paid"],
      ["FAILED", "failed"],
      ["CANCELLED", "cancelled"],
      ["REFUNDED", "refunded"],
      ["PARTIALLY_REFUNDED", "paid"],
    ],
  );
  // The view is recoverable from what is stored: no second source of truth.
  const ctx = { hasProviderReference: true, amount: 100, refundedAmount: 0 };
  assert.equal(state.fromCanonicalStatus("paid", ctx), "PAID");
  assert.equal(state.fromCanonicalStatus("paid", { ...ctx, refundedAmount: 40 }), "PARTIALLY_REFUNDED");
  assert.equal(state.fromCanonicalStatus("pending", { ...ctx, hasProviderReference: false }), "CREATED");
  assert.equal(state.fromCanonicalStatus("pending", ctx), "PENDING");
});

test("status transitions are monotonic: a stale event cannot undo a payment", () => {
  const next = (from, to) => state.nextPaymentState(from, to);
  assert.deepEqual(next("PENDING", "PAID"), { changed: true, state: "PAID", lateCapture: false });
  assert.deepEqual(next("PAID", "PENDING"), { changed: false, state: "PAID" });
  assert.deepEqual(next("PAID", "FAILED"), { changed: false, state: "PAID" });
  assert.deepEqual(next("PAID", "CANCELLED"), { changed: false, state: "PAID" });
  assert.deepEqual(next("PAID", "PAID"), { changed: false, state: "PAID" });
  assert.deepEqual(next("REFUNDED", "PAID"), { changed: false, state: "REFUNDED" });
  assert.deepEqual(next("PAID", "PARTIALLY_REFUNDED").state, "PARTIALLY_REFUNDED");
  assert.deepEqual(next("PARTIALLY_REFUNDED", "REFUNDED").state, "REFUNDED");
  assert.deepEqual(next("PENDING", null), { changed: false, state: "PENDING" });
  // Money that arrives after a cancellation is recorded and flagged.
  assert.deepEqual(next("CANCELLED", "PAID"), { changed: true, state: "PAID", lateCapture: true });
});

test("only a paid payment makes an order eligible for fulfilment", () => {
  for (const s of PAYMENT_STATES) {
    assert.equal(state.orderEffectOf(s).fulfillmentEligible, s === "PAID", s);
  }
  assert.equal(state.orderEffectOf("FAILED").releaseStock, true);
  assert.equal(state.orderEffectOf("CANCELLED").releaseStock, true);
  assert.equal(state.orderEffectOf("PENDING").releaseStock, false);
});

test("amounts are compared in cents and formatted with two decimals", () => {
  assert.equal(state.amountsMatch(0.1 + 0.2, 0.3), true);
  assert.equal(state.amountsMatch(349.5, 349.49), false);
  assert.equal(state.amountsMatch(349.5, null), false);
  assert.equal(state.formatAmount(50), "50.00");
  assert.equal(state.formatAmount(349.5), "349.50");
  assert.throws(() => state.formatAmount(-1), /PAYMENT_AMOUNT_INVALID/);
});

// ── Mercado Pago ───────────────────────────────────────────────────────────

test("Mercado Pago: an order is created on the Orders API with idempotency and the CornerMex reference", async () => {
  const { provider, t } = mercadoPago({ "POST /v1/orders": () => ({ status: 201, body: mpOrder() }) });
  const payment = await provider.createPayment(request());

  const call = t.calls[0];
  assert.equal(call.url, "https://api.mercadopago.com/v1/orders");
  assert.equal(call.headers.Authorization, "Bearer TEST-access-token");
  assert.equal(call.headers["X-Idempotency-Key"], "0b0c9f0e-6a0b-4a52-9a53-4f6f2f6f0001");
  assert.deepEqual(call.body, {
    type: "online",
    processing_mode: "automatic",
    external_reference: "CM-20261005-ABCD1234",
    total_amount: "349.50",
    description: "Pedido CM-20261005-ABCD1234",
    payer: { email: "cliente@example.test", first_name: "María" },
    transactions: { payments: [{ amount: "349.50", payment_method: { id: "oxxo", type: "ticket" } }] },
  });
  assert.deepEqual(
    {
      id: payment.providerPaymentId,
      ref: payment.externalReference,
      state: payment.state,
      raw: [payment.rawStatus, payment.rawStatusDetail],
      amount: payment.amount,
      currency: payment.currency,
      instructions: payment.instructions,
      replayed: payment.replayed,
    },
    {
      id: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE",
      ref: "CM-20261005-ABCD1234",
      state: "PENDING",
      raw: ["action_required", "waiting_payment"],
      amount: 349.5,
      currency: "MXN",
      instructions: { url: "https://mp.example.test/ticket", reference: "1234567890" },
      replayed: false,
    },
  );
});

test("Mercado Pago: a card payment carries only a provider-minted token, never card data", async () => {
  const { provider, t } = mercadoPago({
    "POST /v1/orders": () => ({ status: 201, body: mpOrder({ status: "processed", status_detail: "accredited" }) }),
  });
  const payment = await provider.createPayment(
    request({ method: { kind: "card_token", token: "tok_abc", methodId: "master", installments: 1 } }),
  );
  assert.equal(payment.state, "PAID");
  assert.deepEqual(t.calls[0].body.transactions.payments[0].payment_method, {
    id: "master",
    type: "credit_card",
    token: "tok_abc",
    installments: 1,
  });
  assert.doesNotMatch(JSON.stringify(t.calls[0].body), /card_number|cvv|security_code|expiration/i);
});

test("Mercado Pago: repeating a request with the same idempotency key replays it and is flagged", async () => {
  const { provider, t } = mercadoPago({
    "POST /v1/orders": [() => ({ status: 201, body: mpOrder() }), () => ({ status: 200, body: mpOrder() })],
  });
  const first = await provider.createPayment(request());
  const second = await provider.createPayment(request());
  assert.equal(first.providerPaymentId, second.providerPaymentId);
  assert.deepEqual([first.replayed, second.replayed], [false, true]);
  const keys = t.calls.map((call) => call.headers["X-Idempotency-Key"]);
  assert.equal(keys[0], keys[1], "the retry must reuse the key, never mint a new one");
});

test("Mercado Pago: a creation with an unknown outcome is AMBIGUOUS_WRITE and is not retried", async () => {
  for (const failure of [
    () => {
      throw new Error("socket hang up");
    },
    () => ({ status: 503, body: {} }),
  ]) {
    const { provider, t } = mercadoPago({ "POST /v1/orders": failure });
    await assert.rejects(provider.createPayment(request()), (error) => {
      assert.ok(error instanceof PaymentError);
      assert.equal(error.code, "AMBIGUOUS_WRITE");
      return true;
    });
    assert.equal(t.count("POST /v1/orders"), 1);
  }
});

test("Mercado Pago: a rejected payment is a definite INVALID_REQUEST and bad credentials are AUTH_FAILED", async () => {
  const rejected = mercadoPago({ "POST /v1/orders": () => ({ status: 400, body: { message: "invalid payment_method" } }) });
  await assert.rejects(rejected.provider.createPayment(request()), (error) => error.code === "INVALID_REQUEST");
  const unauthorized = mercadoPago({ "POST /v1/orders": () => ({ status: 401, body: { message: "unauthorized" } }) });
  await assert.rejects(unauthorized.provider.createPayment(request()), (error) => error.code === "AUTH_FAILED");
});

test("Mercado Pago: an order recorded for a different amount is refused", async () => {
  const { provider } = mercadoPago({ "POST /v1/orders": () => ({ status: 201, body: mpOrder({ total_amount: "1.00" }) }) });
  await assert.rejects(provider.createPayment(request()), (error) => error.code === "AMOUNT_MISMATCH");
});

test("Mercado Pago: every documented status maps to a CornerMex state; unknown ones map to none", () => {
  const cases = [
    ["created", "created", "CREATED"],
    ["action_required", "waiting_payment", "PENDING"],
    ["action_required", "waiting_transfer", "PENDING"],
    ["action_required", "waiting_capture", "AUTHORIZED"],
    ["processing", "in_process", "PENDING"],
    ["processed", "accredited", "PAID"],
    ["processed", "partially_refunded", "PARTIALLY_REFUNDED"],
    ["refunded", "refunded", "REFUNDED"],
    ["failed", "rejected", "FAILED"],
    ["canceled", "canceled", "CANCELLED"],
    ["expired", "expired", "CANCELLED"],
    ["something_new", "x", null],
    ["processed", "something_new", null],
  ];
  for (const [status, detail, expected] of cases) {
    assert.equal(mp.mapMercadoPagoStatus(status, detail), expected, `${status}/${detail}`);
  }
});

test("Mercado Pago: status is retrieved from the provider and reads are retried", async () => {
  const path = "GET /v1/orders/ORD01J6TC8BYRR0T4ZKY0QR39WGYE";
  const { provider, t } = mercadoPago({
    [path]: [
      () => ({ status: 503, body: {} }),
      () => ({ status: 200, body: mpOrder({ status: "processed", status_detail: "accredited" }) }),
    ],
  });
  const payment = await provider.getPayment("ORD01J6TC8BYRR0T4ZKY0QR39WGYE");
  assert.equal(payment.state, "PAID");
  assert.equal(t.count(path), 2);
});

test("Mercado Pago: cancel and refund are idempotent money calls; a partial refund names its transaction", async () => {
  const id = "ORD01J6TC8BYRR0T4ZKY0QR39WGYE";
  const paid = mpOrder({ status: "processed", status_detail: "accredited" });
  const { provider, t } = mercadoPago({
    [`POST /v1/orders/${id}/cancel`]: () => ({ status: 200, body: mpOrder({ status: "canceled", status_detail: "canceled" }) }),
    [`GET /v1/orders/${id}`]: () => ({ status: 200, body: paid }),
    [`POST /v1/orders/${id}/refund`]: [
      () => ({ status: 201, body: { ...paid, status_detail: "partially_refunded", total_refunded_amount: "100.00" } }),
      () => ({ status: 201, body: { ...paid, status: "refunded", status_detail: "refunded", total_refunded_amount: "349.50" } }),
    ],
  });

  assert.equal((await provider.cancelPayment(id, "cancel-key")).state, "CANCELLED");
  assert.equal(t.calls.at(-1).headers["X-Idempotency-Key"], "cancel-key");

  const partial = await provider.refund({ providerPaymentId: id, amount: 100, idempotencyKey: "refund-1" });
  assert.deepEqual([partial.state, partial.refundedAmount], ["PARTIALLY_REFUNDED", 100]);
  const partialCall = t.calls.filter((call) => call.key.endsWith("/refund"))[0];
  assert.deepEqual(partialCall.body, { transactions: [{ id: "PAY01J6TC8BYRR0T4ZKY0QRTZ0E24", amount: "100.00" }] });
  assert.equal(partialCall.headers["X-Idempotency-Key"], "refund-1");

  const full = await provider.refund({ providerPaymentId: id, idempotencyKey: "refund-2" });
  assert.equal(full.state, "REFUNDED");
  assert.equal(t.calls.at(-1).body, null, "a full refund sends no body");

  await assert.rejects(
    provider.refund({ providerPaymentId: id, amount: 999, idempotencyKey: "refund-3" }),
    (error) => error.code === "INVALID_REQUEST",
  );
});

const NOW = 1_760_000_000_000;
const mpWebhook = (overrides = {}) => {
  const body = JSON.stringify({
    action: "order.processed",
    api_version: "v1",
    type: "order",
    live_mode: false,
    data: { id: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE", status: "processed", status_detail: "accredited", external_reference: "CM-20261005-ABCD1234", total_amount: "349.50" },
  });
  const input = { dataId: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE", requestId: "2066ca19-c6f1-498a-be75-1923005edd06", ts: String(NOW) };
  return {
    rawBody: body,
    headers: { "x-signature": mp.signMercadoPagoWebhook(input, "mp-webhook-secret"), "x-request-id": input.requestId },
    query: { "data.id": input.dataId, type: "order" },
    ...overrides,
  };
};

test("Mercado Pago: a webhook is verified with HMAC-SHA256 over the documented manifest", () => {
  const { provider } = mercadoPago({}, { now: () => NOW });
  assert.deepEqual(provider.verifyWebhook(mpWebhook()), { ok: true });
  // The manifest lower-cases an alphanumeric data.id.
  const manifestHeader = mpWebhook().headers["x-signature"];
  assert.match(manifestHeader, /^ts=\d+,v1=[0-9a-f]{64}$/);
});

test("Mercado Pago: forged, unsigned, replayed-late and unconfigured webhooks are refused", () => {
  const { provider } = mercadoPago({}, { now: () => NOW });
  const reason = (hook) => provider.verifyWebhook(hook).reason;
  const good = mpWebhook();
  assert.equal(reason({ ...good, headers: { ...good.headers, "x-signature": undefined } }), "signature_missing");
  assert.equal(reason({ ...good, headers: { ...good.headers, "x-request-id": undefined } }), "signature_inputs_missing");
  assert.equal(reason({ ...good, headers: { ...good.headers, "x-signature": `ts=${NOW},v1=${"a".repeat(64)}` } }), "signature_mismatch");
  // A signature is bound to the order it was issued for.
  assert.equal(reason({ ...good, query: { "data.id": "ORD-OTHER", type: "order" } }), "signature_mismatch");
  assert.equal(reason({ ...good, headers: { ...good.headers, "x-signature": "garbage" } }), "signature_malformed");

  const late = mercadoPago({}, { now: () => NOW + 60 * 60 * 1000 });
  assert.equal(late.provider.verifyWebhook(good).reason, "signature_expired");

  const noSecret = mp.createMercadoPagoProvider({ environment: "sandbox", accessToken: "TEST-x" });
  assert.equal(noSecret.verifyWebhook(good).reason, "webhook_secret_not_configured");
});

test("Mercado Pago: a webhook parses into an event with a stable identity", () => {
  const { provider } = mercadoPago({});
  const event = provider.parseWebhook(mpWebhook());
  assert.deepEqual(
    { id: event.externalEventId, payment: event.providerPaymentId, ref: event.externalReference, claimed: event.claimedState, action: event.action },
    {
      id: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE:order.processed:processed:accredited",
      payment: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE",
      ref: "CM-20261005-ABCD1234",
      claimed: "PAID",
      action: "order.processed",
    },
  );
  assert.match(event.payloadHash, /^[0-9a-f]{64}$/);
  assert.equal(provider.parseWebhook({ ...mpWebhook(), rawBody: "{" }), null);
  assert.equal(provider.parseWebhook({ ...mpWebhook(), rawBody: JSON.stringify({ type: "payment", data: { id: "1" } }) }), null);
});

// ── Clip ───────────────────────────────────────────────────────────────────

const clipLink = (overrides = {}) => ({
  payment_request_id: "e1961597-eccd-4bf5-94f3-c343d529caaa",
  object_type: "payment_request",
  status: "CHECKOUT_CREATED",
  last_status_message: "Checkout created",
  payment_request_url: "https://pago.clip.mx/e1961597-eccd-4bf5-94f3-c343d529caaa",
  amount: 349.5,
  currency: "MXN",
  metadata: { external_reference: "CM-20261005-ABCD1234" },
  ...overrides,
});

function clipProvider(routes) {
  const t = transport(routes);
  return {
    t,
    provider: clip.createClipProvider({
      environment: "production",
      apiKey: "key",
      apiSecret: "secret",
      webhookSecret: "c".repeat(40),
      fetch: t.fetchImpl,
      sleep: noSleep,
    }),
  };
}

test("Clip: a redirected checkout is created with the reference, return URLs and webhook", async () => {
  const { provider, t } = clipProvider({ "POST /v2/checkout": () => ({ status: 200, body: clipLink() }) });
  const payment = await provider.createPayment(
    request({ method: { kind: "redirect" }, webhookUrl: "https://tienda.example.test/api/public/hooks/clip?ref=x&token=y" }),
  );
  const call = t.calls[0];
  assert.equal(call.url, "https://api.payclip.com/v2/checkout");
  assert.equal(call.headers.Authorization, `Basic ${Buffer.from("key:secret").toString("base64")}`);
  assert.deepEqual(call.body, {
    amount: 349.5,
    currency: "MXN",
    purchase_description: "Pedido CM-20261005-ABCD1234",
    redirection_url: { success: returnUrls.success, error: returnUrls.failure, default: returnUrls.pending },
    metadata: { external_reference: "CM-20261005-ABCD1234", customer_info: { email: "cliente@example.test" } },
    webhook_url: "https://tienda.example.test/api/public/hooks/clip?ref=x&token=y",
  });
  assert.deepEqual(
    [payment.providerPaymentId, payment.state, payment.redirectUrl, payment.externalReference, payment.amount],
    ["e1961597-eccd-4bf5-94f3-c343d529caaa", "CREATED", "https://pago.clip.mx/e1961597-eccd-4bf5-94f3-c343d529caaa", "CM-20261005-ABCD1234", 349.5],
  );
});

test("Clip: only the redirected flow exists — card data can never be sent through it", async () => {
  const { provider, t } = clipProvider({});
  assert.deepEqual([...provider.supports], ["redirect"]);
  for (const method of [
    { kind: "card_token", token: "t", methodId: "visa", installments: 1 },
    { kind: "offline", methodId: "oxxo", methodType: "ticket" },
  ]) {
    await assert.rejects(provider.createPayment(request({ method })), (error) => error.code === "NOT_SUPPORTED");
  }
  assert.equal(t.calls.length, 0);
});

test("Clip: creation failures are explicit, and an unknown outcome is not retried", async () => {
  const tooLong = clipProvider({});
  await assert.rejects(
    tooLong.provider.createPayment(request({ method: { kind: "redirect" }, orderReference: "X".repeat(37) })),
    (error) => error.code === "INVALID_REQUEST",
  );
  const rejected = clipProvider({ "POST /v2/checkout": () => ({ status: 400, body: { message: "Invalid field" } }) });
  await assert.rejects(rejected.provider.createPayment(request({ method: { kind: "redirect" } })), (error) => error.code === "INVALID_REQUEST");
  const unauthorized = clipProvider({ "POST /v2/checkout": () => ({ status: 401, body: { message: "Authorization error" } }) });
  await assert.rejects(unauthorized.provider.createPayment(request({ method: { kind: "redirect" } })), (error) => error.code === "AUTH_FAILED");
  const unknown = clipProvider({ "POST /v2/checkout": () => ({ status: 500, body: {} }) });
  await assert.rejects(unknown.provider.createPayment(request({ method: { kind: "redirect" } })), (error) => error.code === "AMBIGUOUS_WRITE");
  assert.equal(unknown.t.count("POST /v2/checkout"), 1);
  const noUrl = clipProvider({ "POST /v2/checkout": () => ({ status: 200, body: clipLink({ payment_request_url: null }) }) });
  await assert.rejects(noUrl.provider.createPayment(request({ method: { kind: "redirect" } })), (error) => error.code === "PROVIDER_ERROR");
});

test("Clip: status is verified by reading the payment link from Clip", async () => {
  const path = "GET /v2/checkout/e1961597-eccd-4bf5-94f3-c343d529caaa";
  const { provider } = clipProvider({ [path]: () => ({ status: 200, body: clipLink({ status: "CHECKOUT_COMPLETED" }) }) });
  assert.equal((await provider.getPayment("e1961597-eccd-4bf5-94f3-c343d529caaa")).state, "PAID");
  for (const [raw, expected] of [
    ["CHECKOUT_CREATED", "CREATED"],
    ["CHECKOUT_PENDING", "PENDING"],
    ["CHECKOUT_COMPLETED", "PAID"],
    ["CHECKOUT_CANCELLED", "CANCELLED"],
    ["CHECKOUT_EXPIRED", "CANCELLED"],
    ["COMPLETED", "PAID"],
    ["CANCELED", "CANCELLED"],
    ["SOMETHING_NEW", null],
  ]) {
    assert.equal(clip.mapClipStatus(raw), expected, raw);
  }
});

const clipHook = (overrides = {}, query) => ({
  rawBody: JSON.stringify({
    id: "bc631b13-bda7-4473-9181-bc43e04dfa28",
    api_version: "1.0",
    payment_request_id: "e1961597-eccd-4bf5-94f3-c343d529caaa",
    resource: "CHECKOUT",
    resource_status: "COMPLETED",
    detail_type: "Payment Request Completed",
    me_reference_id: "CM-20261005-ABCD1234",
    receipt_no: "T96suhh",
    ...overrides,
  }),
  headers: {},
  query: query ?? {
    ref: "CM-20261005-ABCD1234",
    token: clip.clipWebhookToken("CM-20261005-ABCD1234", "c".repeat(40)),
  },
});

test("Clip: the unsigned webhook is authenticated by the per-order URL token", () => {
  const { provider } = clipProvider({});
  assert.deepEqual(provider.verifyWebhook(clipHook()), { ok: true });
  assert.equal(provider.verifyWebhook(clipHook({}, {})).reason, "webhook_token_missing");
  assert.equal(provider.verifyWebhook(clipHook({}, { ref: "CM-20261005-ABCD1234", token: "f".repeat(64) })).reason, "webhook_token_mismatch");
  // A token minted for one order does not authenticate another.
  const other = { ref: "CM-OTHER", token: clip.clipWebhookToken("CM-20261005-ABCD1234", "c".repeat(40)) };
  assert.equal(provider.verifyWebhook(clipHook({}, other)).reason, "webhook_token_mismatch");

  const event = provider.parseWebhook(clipHook());
  assert.deepEqual(
    [event.externalEventId, event.providerPaymentId, event.claimedState, event.externalReference],
    ["e1961597-eccd-4bf5-94f3-c343d529caaa:COMPLETED", "e1961597-eccd-4bf5-94f3-c343d529caaa", "PAID", "CM-20261005-ABCD1234"],
  );
  assert.equal(provider.parseWebhook(clipHook({ resource: "REFUND" })), null);
  assert.equal(provider.parseWebhook(clipHook({ me_reference_id: "CM-SOMEONE-ELSE" })), null);
});

test("Clip: cancellation and refunds are reported as not supported rather than faked", async () => {
  const { provider } = clipProvider({});
  await assert.rejects(provider.cancelPayment("x", "k"), (error) => error.code === "NOT_SUPPORTED");
  await assert.rejects(provider.refund({ providerPaymentId: "x", idempotencyKey: "k" }), (error) => error.code === "NOT_SUPPORTED");
});

// ── Exactly-once processing ────────────────────────────────────────────────

function memoryLedger() {
  const rows = new Map();
  return {
    rows,
    async claim(record) {
      const key = `${record.provider}|${record.external_event_id}`;
      const existing = rows.get(key);
      if (existing && existing.processing_status !== "failed") return false;
      rows.set(key, { ...record });
      return true;
    },
    async complete(provider, id, status, at) {
      Object.assign(rows.get(`${provider}|${id}`), { processing_status: status, processed_at: at });
    },
  };
}

const attempt = (overrides = {}) => ({
  orderReference: "CM-20261005-ABCD1234",
  provider: "mercado_pago",
  providerPaymentId: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE",
  amount: 349.5,
  currency: "MXN",
  state: "PENDING",
  ...overrides,
});

function processing(orderBody, attemptOverrides = {}) {
  const { provider } = mercadoPago({ "GET /v1/orders/ORD01J6TC8BYRR0T4ZKY0QR39WGYE": () => ({ status: 200, body: orderBody }) });
  const ledger = memoryLedger();
  const applied = [];
  const rejected = [];
  const hook = mpWebhook();
  const run = () =>
    processor.processPaymentEventOnce({
      provider,
      ledger,
      event: provider.parseWebhook(hook),
      rawBody: hook.rawBody,
      findAttempt: async () => attempt(attemptOverrides),
      apply: async (change) => void applied.push(change),
      onRejected: async (_attempt, reason) => void rejected.push(reason),
    });
  return { run, ledger, applied, rejected };
}

test("a duplicate webhook changes the order exactly once and stores the raw event", async () => {
  const { run, ledger, applied } = processing(mpOrder({ status: "processed", status_detail: "accredited" }));
  const first = await run();
  assert.equal(first.status, "processed");
  assert.deepEqual((await run()).status, "duplicate");
  assert.deepEqual((await run()).status, "duplicate");
  assert.equal(applied.length, 1);
  assert.deepEqual(
    [applied[0].from, applied[0].to, applied[0].fulfillmentEligible, applied[0].releaseStock],
    ["PENDING", "PAID", true, false],
  );
  const row = [...ledger.rows.values()][0];
  assert.deepEqual(Object.keys(row).sort(), ["external_event_id", "payload_hash", "processed_at", "processing_status", "provider", "raw_payload", "received_at"]);
  assert.equal(row.processing_status, "processed");
  assert.match(row.raw_payload, /order\.processed/);
});

test("amount tampering: a paid order for a different amount is rejected, never applied", async () => {
  const { run, applied, rejected } = processing(mpOrder({ status: "processed", status_detail: "accredited", total_amount: "1.00" }));
  const result = await run();
  assert.deepEqual(result.reconciliation, { outcome: "REJECTED", reason: "AMOUNT_MISMATCH" });
  assert.equal(applied.length, 0);
  assert.deepEqual(rejected, ["AMOUNT_MISMATCH"]);
});

test("a payment for another order or another currency is rejected", async () => {
  const wrongRef = processing(mpOrder({ status: "processed", status_detail: "accredited", external_reference: "CM-OTHER" }));
  assert.equal((await wrongRef.run()).reconciliation.reason, "REFERENCE_MISMATCH");
  const wrongCurrency = processing(mpOrder({ status: "processed", status_detail: "accredited", currency_id: "USD" }));
  assert.equal((await wrongCurrency.run()).reconciliation.reason, "CURRENCY_MISMATCH");
  assert.equal(wrongRef.applied.length + wrongCurrency.applied.length, 0);
});

test("the event's claimed status is not trusted: the provider's answer decides", async () => {
  // The webhook says "processed", but the provider still reports the order pending.
  const { run, applied } = processing(mpOrder());
  const result = await run();
  assert.deepEqual(result.reconciliation, { outcome: "UNCHANGED", state: "PENDING" });
  assert.equal(applied.length, 0);
});

test("a failed payment releases stock and never becomes eligible for fulfilment", async () => {
  const { run, applied } = processing(mpOrder({ status: "failed", status_detail: "rejected" }));
  await run();
  assert.deepEqual(
    [applied[0].to, applied[0].releaseStock, applied[0].fulfillmentEligible],
    ["FAILED", true, false],
  );
});

test("money arriving after a cancellation is recorded and held for a person", async () => {
  const { run, applied } = processing(mpOrder({ status: "processed", status_detail: "accredited" }), { state: "CANCELLED" });
  await run();
  assert.deepEqual([applied[0].to, applied[0].lateCapture, applied[0].fulfillmentEligible], ["PAID", true, false]);
});

test("an event for a payment CornerMex never created is ignored", async () => {
  const { provider } = mercadoPago({});
  const hook = mpWebhook();
  const result = await processor.processPaymentEventOnce({
    provider,
    ledger: memoryLedger(),
    event: provider.parseWebhook(hook),
    rawBody: hook.rawBody,
    findAttempt: async () => null,
    apply: async () => assert.fail("must not apply"),
  });
  assert.deepEqual(result, { status: "ignored", reason: "unknown_payment" });
});

test("an event whose processing failed is retried on redelivery", async () => {
  let reads = 0;
  const t = transport({
    "GET /v1/orders/ORD01J6TC8BYRR0T4ZKY0QR39WGYE": () => {
      reads += 1;
      if (reads <= 3) return { status: 503, body: {} };
      return { status: 200, body: mpOrder({ status: "processed", status_detail: "accredited" }) };
    },
  });
  const provider = mp.createMercadoPagoProvider({ environment: "sandbox", accessToken: "TEST-x", webhookSecret: "s", fetch: t.fetchImpl, sleep: noSleep });
  const ledger = memoryLedger();
  const hook = mpWebhook();
  const applied = [];
  const run = () =>
    processor.processPaymentEventOnce({
      provider,
      ledger,
      event: provider.parseWebhook(hook),
      rawBody: hook.rawBody,
      findAttempt: async () => attempt(),
      apply: async (change) => void applied.push(change),
    });
  await assert.rejects(run(), (error) => error.code === "PROVIDER_ERROR");
  assert.equal([...ledger.rows.values()][0].processing_status, "failed");
  assert.equal((await run()).status, "processed");
  assert.equal((await run()).status, "duplicate");
  assert.equal(applied.length, 1);
});

test("a Clip return is verified against Clip, not taken from the browser", async () => {
  const path = "GET /v2/checkout/e1961597-eccd-4bf5-94f3-c343d529caaa";
  const clipAttempt = attempt({ provider: "clip", providerPaymentId: "e1961597-eccd-4bf5-94f3-c343d529caaa", state: "CREATED" });

  // The customer lands on the success URL, but Clip says the link is unpaid.
  const unpaid = clipProvider({ [path]: () => ({ status: 200, body: clipLink({ status: "CHECKOUT_PENDING" }) }) });
  const pending = await processor.reconcilePayment(unpaid.provider, clipAttempt);
  assert.equal(pending.outcome, "CHANGED");
  assert.deepEqual([pending.change.to, pending.change.fulfillmentEligible], ["PENDING", false]);

  const paid = clipProvider({ [path]: () => ({ status: 200, body: clipLink({ status: "CHECKOUT_COMPLETED" }) }) });
  const done = await processor.reconcilePayment(paid.provider, clipAttempt);
  assert.deepEqual([done.change.to, done.change.fulfillmentEligible], ["PAID", true]);

  // Clip reports a completed link for a different amount.
  const tampered = clipProvider({ [path]: () => ({ status: 200, body: clipLink({ status: "CHECKOUT_COMPLETED", amount: 10 }) }) });
  assert.deepEqual(await processor.reconcilePayment(tampered.provider, clipAttempt), { outcome: "REJECTED", reason: "AMOUNT_MISMATCH" });

  // A completed link that does not report its amount cannot be accepted.
  const silent = clipProvider({ [path]: () => ({ status: 200, body: clipLink({ status: "CHECKOUT_COMPLETED", amount: undefined }) }) });
  assert.deepEqual(await processor.reconcilePayment(silent.provider, clipAttempt), { outcome: "REJECTED", reason: "AMOUNT_MISMATCH" });
});

// ── Configuration ──────────────────────────────────────────────────────────

test("providers default to off and report missing names, never values", () => {
  assert.deepEqual(providers.configuredPaymentProviders({}), []);
  const health = providers.paymentConfigHealth({});
  assert.deepEqual(health.map((entry) => [entry.provider, entry.state]), [["mercado_pago", "NOT_CONFIGURED"], ["clip", "NOT_CONFIGURED"]]);
  assert.deepEqual(health[0].missing, ["MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_WEBHOOK_SECRET"]);

  const env = { MERCADO_PAGO_ACCESS_TOKEN: "TEST-secret-token", MERCADO_PAGO_WEBHOOK_SECRET: "hook-secret-value" };
  // Credentials alone do not enable a provider.
  assert.deepEqual(providers.configuredPaymentProviders(env), []);
  const enabled = { ...env, MERCADO_PAGO_ENABLED: "true" };
  assert.deepEqual(providers.configuredPaymentProviders(enabled).map((provider) => provider.id), ["mercado_pago"]);
  assert.equal(providers.paymentConfigHealth(enabled)[0].state, "SANDBOX");
  assert.doesNotMatch(JSON.stringify(providers.paymentConfigHealth(enabled)), /secret-token|hook-secret-value/);
});

test("a production token cannot be used in sandbox, nor a test token in production", () => {
  const live = { MERCADO_PAGO_ENABLED: "true", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-live", MERCADO_PAGO_WEBHOOK_SECRET: "s" };
  assert.deepEqual(providers.configuredPaymentProviders(live), []);
  assert.ok(providers.paymentConfigHealth(live)[0].missing.includes("MERCADO_PAGO_ACCESS_TOKEN:not_a_test_token"));

  const testInProd = { MERCADO_PAGO_ENABLED: "true", MERCADO_PAGO_ENVIRONMENT: "production", MERCADO_PAGO_ACCESS_TOKEN: "TEST-x", MERCADO_PAGO_WEBHOOK_SECRET: "s" };
  assert.deepEqual(providers.configuredPaymentProviders(testInProd), []);

  // Production credentials are never reported CONNECTED or LIVE from config alone.
  const production = { ...live, MERCADO_PAGO_ENVIRONMENT: "production" };
  const health = providers.paymentConfigHealth(production)[0];
  assert.deepEqual([health.state, health.missing], ["NOT_CONFIGURED", ["PRODUCTION_VERIFICATION"]]);
});

test("Clip is never reported as sandbox: its redirected checkout has no test mode", () => {
  const base = { CLIP_ENABLED: "true", CLIP_API_KEY: "k", CLIP_API_SECRET: "s", CLIP_WEBHOOK_SECRET: "w".repeat(40) };
  const health = providers.paymentConfigHealth(base)[1];
  assert.equal(health.state, "NOT_CONFIGURED");
  assert.ok(health.missing.includes("CLIP_ENVIRONMENT:redirected_checkout_has_no_sandbox"));
  assert.deepEqual(providers.configuredPaymentProviders(base), []);
  const production = { ...base, CLIP_ENVIRONMENT: "production" };
  assert.deepEqual(providers.configuredPaymentProviders(production).map((provider) => provider.id), ["clip"]);
  assert.notEqual(providers.paymentConfigHealth(production)[1].state, "SANDBOX");
});
