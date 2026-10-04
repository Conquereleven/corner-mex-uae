// Rate shopping, manual rules, parcel estimation, signed selection, webhook
// replay safety and single label purchase.
import assert from "node:assert/strict";
import test from "node:test";

const engine = await import("../../src/lib/shipping/quote-engine.ts");
const fulfillment = await import("../../src/lib/shipping/fulfillment.ts");
const parcel = await import("../../src/lib/shipping/parcel.ts");
const tokens = await import("../../src/lib/shipping/quote-token.server.ts");
const webhook = await import("../../src/lib/shipping/webhook.server.ts");
const labels = await import("../../src/lib/shipping/label-purchase.ts");
const status = await import("../../src/lib/shipping/status.ts");
const { ShippingError } = await import("../../src/lib/shipping/types.ts");

const NOW = Date.parse("2026-10-04T12:00:00Z");
const quote = (overrides = {}) => ({
  provider: "skydropx",
  carrier: "fedex",
  carrierName: "FedEx",
  service: "Express",
  serviceCode: "express",
  price: 200,
  currency: "MXN",
  estimatedDaysMin: 1,
  estimatedDaysMax: 1,
  deliveryEstimate: "1 día hábil",
  fulfillmentMode: "PARCEL_SHIPPING",
  package: { count: 1, totalWeightKg: 2 },
  insurance: { available: true, cost: null },
  pickupSupported: true,
  providerQuoteId: "q",
  providerRateId: "r",
  expiresAt: new Date(NOW + 3600_000).toISOString(),
  ...overrides,
});

const express = quote();
const economy = quote({
  carrier: "estafeta",
  carrierName: "Estafeta",
  service: "Terrestre",
  serviceCode: "ground",
  price: 95,
  estimatedDaysMin: 5,
  estimatedDaysMax: 5,
  providerRateId: "r2",
});
const balanced = quote({
  carrier: "dhl",
  carrierName: "DHL",
  service: "Económico",
  serviceCode: "eco",
  price: 110,
  estimatedDaysMin: 2,
  estimatedDaysMax: 2,
  providerRateId: "r3",
});
const unknownEta = quote({
  carrier: "local",
  carrierName: "Local",
  service: "Sin estimado",
  serviceCode: "x",
  price: 60,
  estimatedDaysMin: null,
  estimatedDaysMax: null,
  providerRateId: "r4",
});

const provider = (id, result) => ({
  id,
  quote: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

test("CHEAPEST and FASTEST rank differently and both keep the delivery metadata", () => {
  const all = [express, economy, balanced];
  const cheapest = engine.rankQuotes(all, "CHEAPEST");
  const fastest = engine.rankQuotes(all, "FASTEST");
  assert.deepEqual(
    cheapest.map((q) => q.carrier),
    ["estafeta", "dhl", "fedex"],
  );
  assert.deepEqual(
    fastest.map((q) => q.carrier),
    ["fedex", "dhl", "estafeta"],
  );
  // Ranking reorders; it never strips the SLA from an option.
  for (const ranked of [...cheapest, ...fastest]) {
    assert.equal(typeof ranked.estimatedDaysMax, "number");
    assert.ok(ranked.deliveryEstimate);
  }
});

test("BEST_VALUE prefers the balanced option over the extremes", () => {
  assert.equal(engine.rankQuotes([express, economy, balanced], "BEST_VALUE")[0].carrier, "dhl");
});

test("an option without a delivery estimate is never ranked fastest", () => {
  assert.equal(engine.rankQuotes([unknownEta, economy], "FASTEST")[0].carrier, "estafeta");
  // It can still be the cheapest.
  assert.equal(engine.rankQuotes([unknownEta, economy], "CHEAPEST")[0].carrier, "local");
});

test("the same carrier service from two aggregators is offered once, at the lower price", () => {
  const viaSolo = quote({ provider: "solo_envios", price: 180, providerRateId: "solo-r" });
  const deduped = engine.dedupeQuotes([express, viaSolo, economy]);
  assert.equal(deduped.length, 2);
  const fedex = deduped.find((q) => q.carrier === "fedex");
  assert.deepEqual([fedex.provider, fedex.price], ["solo_envios", 180]);
});

test("expired quotes and quotes in another currency are not offered", () => {
  const expired = quote({ expiresAt: new Date(NOW - 1).toISOString(), providerRateId: "old" });
  const dollars = quote({ currency: "USD", providerRateId: "usd" });
  assert.deepEqual(
    engine.usableQuotes([express, expired, dollars], "MXN", NOW).map((q) => q.providerRateId),
    ["r"],
  );
});

test("rate shopping merges both providers and survives one of them failing", async () => {
  const outcome = await engine.shopRates(
    [
      provider("skydropx", [express, economy]),
      provider(
        "solo_envios",
        new ShippingError("TIMEOUT", "provider did not respond", { provider: "solo_envios" }),
      ),
    ],
    { origin: {}, destination: {}, parcels: [] },
    { policy: "CHEAPEST", currency: "MXN", now: () => NOW },
  );
  assert.deepEqual(
    outcome.quotes.map((q) => q.carrier),
    ["estafeta", "fedex"],
  );
  assert.equal(outcome.recommended.carrier, "estafeta");
  assert.deepEqual(outcome.failures, [
    { provider: "solo_envios", code: "TIMEOUT", message: "provider did not respond" },
  ]);
});

test("when every provider fails there are no quotes and no invented price", async () => {
  const outcome = await engine.shopRates(
    [provider("skydropx", new Error("boom")), provider("solo_envios", new Error("boom"))],
    { origin: {}, destination: {}, parcels: [] },
    { currency: "MXN", now: () => NOW },
  );
  assert.deepEqual(outcome.quotes, []);
  assert.equal(outcome.recommended, null);
  assert.equal(outcome.failures.length, 2);
});

test("manual rules: a local prefix beats the national catch-all for the same mode", () => {
  const rules = fulfillment.parseManualShippingRules(
    JSON.stringify([
      {
        id: "local",
        label: "Entrega local Tecámac",
        mode: "LOCAL_DELIVERY",
        postalPrefixes: ["557"],
        price: 49,
        daysMin: 0,
        daysMax: 1,
        freeFromSubtotal: 600,
      },
      {
        id: "nacional",
        label: "Envío nacional",
        mode: "PARCEL_SHIPPING",
        postalPrefixes: ["*"],
        price: 149,
        daysMin: 3,
        daysMax: 6,
      },
    ]),
  );
  const local = fulfillment.manualQuotes(
    rules,
    { postalCode: "55764", subtotal: 300, currency: "MXN", totalWeightKg: 1 },
    NOW,
  );
  assert.deepEqual(
    local.map((q) => [q.serviceCode, q.price, q.fulfillmentMode]),
    [
      ["local", 49, "LOCAL_DELIVERY"],
      ["nacional", 149, "PARCEL_SHIPPING"],
    ],
  );
  assert.equal(local[0].provider, "manual");
  assert.equal(local[0].deliveryEstimate, "0–1 día hábil");

  const far = fulfillment.manualQuotes(
    rules,
    { postalCode: "64000", subtotal: 300, currency: "MXN", totalWeightKg: 1 },
    NOW,
  );
  assert.deepEqual(
    far.map((q) => q.serviceCode),
    ["nacional"],
  );

  const free = fulfillment.manualQuotes(
    rules,
    { postalCode: "55764", subtotal: 600, currency: "MXN", totalWeightKg: 1 },
    NOW,
  );
  assert.equal(free[0].price, 0);
});

test("manual rules fail closed on malformed configuration and default to none", () => {
  assert.deepEqual(fulfillment.parseManualShippingRules(undefined), []);
  assert.equal(fulfillment.parseManualShippingRules("{"), null);
  assert.equal(
    fulfillment.parseManualShippingRules(
      '[{"id":"x","label":"x","mode":"PARCEL_SHIPPING","postalPrefixes":["*"],"price":-1,"daysMin":1,"daysMax":2}]',
    ),
    null,
  );
  assert.equal(
    fulfillment.parseManualShippingRules(
      '[{"id":"x","label":"x","mode":"DRONE","postalPrefixes":["*"],"price":1,"daysMin":1,"daysMax":2}]',
    ),
    null,
  );
  assert.equal(
    fulfillment.parseManualShippingRules(
      '[{"id":"x","label":"x","mode":"PARCEL_SHIPPING","postalPrefixes":["*"],"price":1.005,"daysMin":1,"daysMax":2}]',
    ),
    null,
  );
});

test("the origin address is configuration and is never assumed", () => {
  assert.deepEqual(fulfillment.parseFulfillmentOrigin(undefined), {
    location: null,
    problems: ["origin_not_configured"],
  });
  const partial = fulfillment.parseFulfillmentOrigin(
    JSON.stringify({ name: "Almacén", state: "MEX", postal_code: "55740" }),
  );
  assert.equal(partial.location, null);
  assert.ok(partial.problems.includes("origin.street"));
  assert.ok(partial.problems.includes("origin.phone"));

  const complete = fulfillment.parseFulfillmentOrigin(
    JSON.stringify({
      name: "Almacén CornerMex",
      company: "CornerMex",
      phone: "5512345678",
      email: "envios@example.test",
      street: "Calle Ejemplo 10",
      colonia: "Centro",
      municipality: "Tecámac",
      state: "mex",
      postal_code: "55740",
    }),
  );
  assert.deepEqual(complete.problems, []);
  assert.equal(complete.location.name, "CornerMex MX - Tecámac");
  assert.equal(complete.location.address.state, "Estado de México");
  assert.deepEqual(fulfillment.quoteAddressOf(complete.location.address), {
    country: "MX",
    postalCode: "55740",
    state: "Estado de México",
    municipality: "Tecámac",
    colonia: "Centro",
  });
});

test("parcel estimation flags assumed data instead of blocking the order", () => {
  const measured = parcel.estimateParcels([
    { sku: "A", qty: 2, weightGrams: 450, lengthCm: 10, widthCm: 10, heightCm: 10 },
  ]);
  assert.equal(measured.complete, true);
  assert.equal(measured.parcels.length, 1);
  assert.equal(measured.parcels[0].weightKg, 1.1);

  const assumed = parcel.estimateParcels([
    { sku: "A", qty: 1, weightGrams: 450 },
    { sku: "B", qty: 3, weightGrams: null },
  ]);
  assert.equal(assumed.complete, false);
  assert.deepEqual(assumed.missingWeight, ["B"]);
  assert.deepEqual(assumed.missingDimensions, ["A", "B"]);
  assert.equal(assumed.parcels[0].weightKg, 2.15);
  assert.ok(assumed.parcels[0].lengthCm > 0);

  const huge = parcel.estimateParcels([{ sku: "C", qty: 500, weightGrams: 1000 }]);
  assert.equal(huge.oversize, true);
  assert.equal(huge.complete, false);
  assert.throws(() => parcel.estimateParcels([]), /PARCEL_LINES_INVALID/);
});

const SECRET = "s".repeat(40);
const items = [
  { variant_id: "11111111-1111-4111-8111-111111111111", qty: 2 },
  { variant_id: "22222222-2222-4222-8222-222222222222", qty: 1 },
];

test("a signed shipping selection verifies and carries the server's price", () => {
  const token = tokens.signQuote(express, { postalCode: "64000", items }, SECRET);
  // The cart fingerprint does not depend on item order.
  const result = tokens.verifyQuoteToken(
    token,
    { postalCode: "64000", items: [...items].reverse() },
    SECRET,
    NOW,
  );
  assert.equal(result.ok, true);
  assert.equal(result.quote.price, 200);
});

test("amount tampering is rejected: a forged or edited selection never verifies", () => {
  const token = tokens.signQuote(express, { postalCode: "64000", items }, SECRET);
  const [body, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  payload.quote.price = 1;
  const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
  const binding = { postalCode: "64000", items };
  assert.deepEqual(tokens.verifyQuoteToken(forged, binding, SECRET, NOW), {
    ok: false,
    reason: "SHIPPING_QUOTE_INVALID",
  });
  assert.equal(tokens.verifyQuoteToken("not-a-token", binding, SECRET, NOW).ok, false);
  assert.equal(tokens.verifyQuoteToken(token, binding, "x".repeat(40), NOW).ok, false);
});

test("a selection is refused once expired, or when the destination or cart changed", () => {
  const token = tokens.signQuote(express, { postalCode: "64000", items }, SECRET);
  const reason = (binding, at = NOW) => tokens.verifyQuoteToken(token, binding, SECRET, at).reason;
  assert.equal(
    reason({ postalCode: "64000", items }, NOW + 2 * 3600_000),
    "SHIPPING_QUOTE_EXPIRED",
  );
  assert.equal(reason({ postalCode: "55764", items }), "SHIPPING_QUOTE_DESTINATION_CHANGED");
  assert.equal(
    reason({ postalCode: "64000", items: [{ ...items[0], qty: 9 }, items[1]] }),
    "SHIPPING_QUOTE_CART_CHANGED",
  );
});

test("signing refuses to run without a real secret", () => {
  assert.throws(
    () => tokens.signQuote(express, { postalCode: "64000", items }, "short"),
    /QUOTE_SIGNING_SECRET_NOT_CONFIGURED/,
  );
  assert.throws(
    () => tokens.verifyQuoteToken("a.b", { postalCode: "64000", items }, undefined),
    /QUOTE_SIGNING_SECRET_NOT_CONFIGURED/,
  );
});

const body = JSON.stringify({
  data: {
    id: "6172eb82-7b0b-4852-9954-b1ac1c20e4f8",
    type: "packages",
    attributes: {
      status: "delivered",
      tracking_number: "794874381730",
      tracking_url_provider: "https://carrier.example.test/track/794874381730",
      label_url: "https://labels.example.test/label.pdf",
      returned_status: null,
      returned: false,
    },
    relationships: {
      shipment: { data: { id: "93774c22-8275-4757-9963-71b79b2e8db7", type: "shipments" } },
    },
  },
});

test("webhooks verify with HMAC-SHA512 over the raw body, lowercase hex", () => {
  const header = webhook.signShippingWebhook(body, "hook-secret");
  assert.match(header, /^HMAC [0-9a-f]{128}$/);
  assert.deepEqual(webhook.verifyShippingWebhook(body, header, "hook-secret"), { ok: true });
  // Any change to the bytes — even re-serialising the same JSON — breaks it.
  assert.equal(
    webhook.verifyShippingWebhook(JSON.stringify(JSON.parse(body), null, 1), header, "hook-secret")
      .ok,
    false,
  );
  assert.equal(webhook.verifyShippingWebhook(body, header, "other-secret").ok, false);
});

test("unsigned, bearer-only and unconfigured webhooks are refused", () => {
  const reason = (header, secret = "hook-secret") =>
    webhook.verifyShippingWebhook(body, header, secret).reason;
  assert.equal(reason(null), "signature_missing");
  assert.equal(reason("Bearer some-static-token"), "signature_scheme_unsupported");
  assert.equal(reason("HMAC abcd"), "signature_mismatch");
  assert.equal(
    webhook.verifyShippingWebhook(body, webhook.signShippingWebhook(body, "hook-secret"), undefined)
      .reason,
    "webhook_secret_not_configured",
  );
});

test("a webhook is parsed into a normalised event that keeps the raw status", () => {
  const event = webhook.parseShippingWebhook("skydropx", body);
  assert.deepEqual(
    {
      id: event.externalEventId,
      status: event.status,
      raw: event.rawStatus,
      shipment: event.providerShipmentId,
      tracking: event.trackingNumber,
    },
    {
      id: "packages:6172eb82-7b0b-4852-9954-b1ac1c20e4f8:delivered",
      status: "DELIVERED",
      raw: "delivered",
      shipment: "93774c22-8275-4757-9963-71b79b2e8db7",
      tracking: "794874381730",
    },
  );
  assert.match(event.payloadHash, /^[0-9a-f]{64}$/);
  assert.equal(webhook.parseShippingWebhook("skydropx", "not json"), null);
  assert.equal(webhook.parseShippingWebhook("skydropx", "{}"), null);
  const unknown = webhook.parseShippingWebhook(
    "solo_envios",
    body.replace("delivered", "teleported"),
  );
  assert.deepEqual([unknown.status, unknown.rawStatus], [null, "teleported"]);
});

function memoryWebhookLedger() {
  const rows = new Map();
  return {
    rows,
    async claim(entry) {
      const key = `${entry.provider}|${entry.external_event_id}`;
      const existing = rows.get(key);
      if (existing && existing.processing_status !== "failed") return false;
      rows.set(key, { ...entry });
      return true;
    },
    async complete(provider, id, processingStatus, processedAt) {
      Object.assign(rows.get(`${provider}|${id}`), {
        processing_status: processingStatus,
        processed_at: processedAt,
      });
    },
  };
}

test("a duplicate webhook is processed exactly once", async () => {
  const ledger = memoryWebhookLedger();
  const event = webhook.parseShippingWebhook("skydropx", body);
  let applied = 0;
  const apply = async () => {
    applied += 1;
  };
  assert.equal(await webhook.processShippingWebhookOnce(ledger, event, apply), "processed");
  // The provider re-delivers the same event twice more.
  assert.equal(await webhook.processShippingWebhookOnce(ledger, event, apply), "duplicate");
  assert.equal(await webhook.processShippingWebhookOnce(ledger, event, apply), "duplicate");
  assert.equal(applied, 1);

  const row = [...ledger.rows.values()][0];
  assert.deepEqual(Object.keys(row).sort(), [
    "external_event_id",
    "payload_hash",
    "processed_at",
    "processing_status",
    "provider",
    "received_at",
  ]);
  assert.equal(row.processing_status, "processed");
  assert.ok(row.processed_at);
});

test("a webhook whose processing failed is retried on redelivery, then never again", async () => {
  const ledger = memoryWebhookLedger();
  const event = webhook.parseShippingWebhook("skydropx", body);
  let attempts = 0;
  const flaky = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("database unavailable");
  };
  await assert.rejects(
    webhook.processShippingWebhookOnce(ledger, event, flaky),
    /database unavailable/,
  );
  assert.equal([...ledger.rows.values()][0].processing_status, "failed");
  assert.equal(await webhook.processShippingWebhookOnce(ledger, event, flaky), "processed");
  assert.equal(await webhook.processShippingWebhookOnce(ledger, event, flaky), "duplicate");
  assert.equal(attempts, 2);
});

test("shipment status never moves backwards and never leaves a terminal state", () => {
  assert.equal(status.nextShipmentStatus("IN_TRANSIT", "LABEL_CREATED"), "IN_TRANSIT");
  assert.equal(status.nextShipmentStatus("LABEL_CREATED", "IN_TRANSIT"), "IN_TRANSIT");
  assert.equal(status.nextShipmentStatus("DELIVERED", "IN_TRANSIT"), "DELIVERED");
  assert.equal(status.nextShipmentStatus("CANCELLED", "DELIVERED"), "CANCELLED");
  assert.equal(status.nextShipmentStatus("IN_TRANSIT", "EXCEPTION"), "EXCEPTION");
  assert.equal(status.nextShipmentStatus("EXCEPTION", "OUT_FOR_DELIVERY"), "OUT_FOR_DELIVERY");
  assert.equal(status.nextShipmentStatus("IN_TRANSIT", null), "IN_TRANSIT");
  assert.equal(status.mapTrackingStatus("in_return"), "RETURNED");
  assert.equal(status.mapTrackingStatus("canceled"), "CANCELLED");
  assert.equal(status.mapWorkflowStatus("pending"), "LABEL_PENDING");
  assert.equal(status.mapTrackingStatus("never_heard_of_it"), null);
});

function memoryLabelLedger() {
  const rows = new Map();
  return {
    rows,
    find: async (ref) => rows.get(ref) ?? null,
    async reserve(reservation) {
      if (rows.has(reservation.orderReference)) return false;
      rows.set(reservation.orderReference, { ...reservation });
      return true;
    },
    update: async (ref, patch) => {
      Object.assign(rows.get(ref), patch);
    },
  };
}

const request = {
  orderReference: "CM-1001",
  providerRateId: "rate-1",
  origin: {},
  destination: {},
  parcels: [],
};
const bought = {
  provider: "skydropx",
  providerShipmentId: "shipment-1",
  status: "LABEL_CREATED",
  packages: [],
  replayed: false,
};
const PAID = { kind: "PAID" };

test("no label is bought before payment is confirmed", async () => {
  let calls = 0;
  const carrier = { id: "skydropx", createShipment: async () => ((calls += 1), bought) };
  await assert.rejects(
    labels.purchaseLabelOnce({
      provider: carrier,
      ledger: memoryLabelLedger(),
      request,
      payment: null,
    }),
    /LABEL_PURCHASE_REQUIRES_CONFIRMED_PAYMENT/,
  );
  assert.equal(calls, 0);
});

test("a label is bought once: a second attempt for the same order does not buy again", async () => {
  let calls = 0;
  const carrier = { id: "skydropx", createShipment: async () => ((calls += 1), bought) };
  const ledger = memoryLabelLedger();
  const first = await labels.purchaseLabelOnce({
    provider: carrier,
    ledger,
    request,
    payment: PAID,
  });
  const second = await labels.purchaseLabelOnce({
    provider: carrier,
    ledger,
    request,
    payment: PAID,
  });
  // Even with a different rate, the order already has its label.
  const third = await labels.purchaseLabelOnce({
    provider: carrier,
    ledger,
    request: { ...request, providerRateId: "rate-9" },
    payment: PAID,
  });
  assert.equal(first.outcome, "PURCHASED");
  assert.deepEqual(second, { outcome: "ALREADY_PURCHASED", providerShipmentId: "shipment-1" });
  assert.deepEqual(third, { outcome: "ALREADY_PURCHASED", providerShipmentId: "shipment-1" });
  assert.equal(calls, 1);
});

test("concurrent purchases for one order call the provider once", async () => {
  let calls = 0;
  const carrier = {
    id: "skydropx",
    createShipment: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return bought;
    },
  };
  const ledger = memoryLabelLedger();
  const results = await Promise.all([
    labels.purchaseLabelOnce({ provider: carrier, ledger, request, payment: PAID }),
    labels.purchaseLabelOnce({ provider: carrier, ledger, request, payment: PAID }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map((result) => result.outcome).sort(), ["IN_PROGRESS", "PURCHASED"]);
});

test("an ambiguous creation timeout is looked up, not bought again", async () => {
  const seenRates = [];
  let attempt = 0;
  const carrier = {
    id: "solo_envios",
    createShipment: async (input) => {
      seenRates.push(input.providerRateId);
      attempt += 1;
      if (attempt === 1)
        throw new ShippingError("AMBIGUOUS_WRITE", "no response to a label purchase", {
          provider: "solo_envios",
        });
      // The provider's idempotent replay returns the ORIGINAL shipment.
      return { ...bought, provider: "solo_envios", replayed: true };
    },
  };
  const ledger = memoryLabelLedger();

  const first = await labels.purchaseLabelOnce({
    provider: carrier,
    ledger,
    request,
    payment: PAID,
  });
  assert.equal(first.outcome, "AMBIGUOUS");
  assert.equal(ledger.rows.get("CM-1001").state, "AMBIGUOUS");

  // A naive retry does not reach the provider at all.
  const retry = await labels.purchaseLabelOnce({
    provider: carrier,
    ledger,
    request,
    payment: PAID,
  });
  assert.equal(retry.outcome, "AMBIGUOUS");
  assert.equal(attempt, 1);

  // Reconciling with a different rate would buy a second label — refused.
  await assert.rejects(
    labels.reconcileAmbiguousLabel({
      provider: carrier,
      ledger,
      request: { ...request, providerRateId: "rate-2" },
    }),
    /LABEL_RECONCILE_RATE_MISMATCH/,
  );
  assert.equal(attempt, 1);

  const resolved = await labels.reconcileAmbiguousLabel({ provider: carrier, ledger, request });
  assert.equal(resolved.outcome, "PURCHASED");
  assert.equal(resolved.shipment.replayed, true);
  assert.deepEqual(seenRates, ["rate-1", "rate-1"], "the same rate is replayed, never a new one");
  assert.equal(ledger.rows.get("CM-1001").state, "PURCHASED");
});

test("a known shipment id is reconciled by lookup, without any create call", async () => {
  let creates = 0;
  const carrier = {
    id: "skydropx",
    createShipment: async () => ((creates += 1), bought),
    getShipment: async (id) => ({ ...bought, providerShipmentId: id }),
  };
  const ledger = memoryLabelLedger();
  await ledger.reserve({
    orderReference: "CM-1001",
    provider: "skydropx",
    providerRateId: "rate-1",
    state: "AMBIGUOUS",
    providerShipmentId: "shipment-7",
  });
  const resolved = await labels.reconcileAmbiguousLabel({ provider: carrier, ledger, request });
  assert.equal(resolved.shipment.providerShipmentId, "shipment-7");
  assert.equal(creates, 0);
});

test("a definite rejection records FAILED and is not silently retried", async () => {
  let calls = 0;
  const carrier = {
    id: "skydropx",
    createShipment: async () => {
      calls += 1;
      throw new ShippingError("INVALID_REQUEST", "Tarifa expirada", {
        provider: "skydropx",
        status: 422,
      });
    },
  };
  const ledger = memoryLabelLedger();
  await assert.rejects(
    labels.purchaseLabelOnce({ provider: carrier, ledger, request, payment: PAID }),
    /Tarifa expirada/,
  );
  assert.equal(ledger.rows.get("CM-1001").state, "FAILED");
  await labels.purchaseLabelOnce({ provider: carrier, ledger, request, payment: PAID });
  assert.equal(calls, 1);
});
