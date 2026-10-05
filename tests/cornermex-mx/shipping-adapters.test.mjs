// Skydropx and Solo Envíos adapters against their published contract.
import assert from "node:assert/strict";
import test from "node:test";

import {
  destination,
  fakeClock,
  fakeTransport,
  origin,
  parcels,
  person,
  quotation,
  rate,
  shipment,
  tokenResponse,
} from "./shipping-fixtures.mjs";

const { createSkydropxPlatformProvider } =
  await import("../../src/lib/shipping/skydropx-platform.ts");
const providers = await import("../../src/lib/shipping/providers.ts");
const { ShippingError } = await import("../../src/lib/shipping/types.ts");

const TOKEN = "POST /api/v1/oauth/token";
const QUOTE = "POST /api/v1/quotations";
const SHIP = "POST /api/v1/shipments";

function build(id, routes, extra = {}) {
  const transport = fakeTransport(routes);
  const clock = fakeClock();
  const provider = createSkydropxPlatformProvider({
    id,
    environment: "sandbox",
    baseUrl: id === "skydropx" ? "https://sb-pro.skydropx.com" : "https://sb-app.soloenvios.com",
    clientId: "client-id",
    clientSecret: "client-secret",
    fetch: transport.fetchImpl,
    now: clock.now,
    sleep: clock.sleep,
    ...extra,
  });
  return { provider, transport, clock };
}

const shipmentRequest = {
  orderReference: "CM-1001",
  providerRateId: "rate-1",
  origin: person(origin),
  destination: person(destination),
  parcels: [{ ...parcels[0], consignmentNote: "50181700", packageType: "4G" }],
};

for (const id of ["skydropx", "solo_envios"]) {
  test(`${id}: a quotation is normalised into CornerMex quotes`, async () => {
    const { provider, transport } = build(id, {
      [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
      [QUOTE]: () => ({
        status: 201,
        body: quotation([
          rate(),
          rate({
            id: "rate-2",
            provider_name: "estafeta",
            provider_display_name: "Estafeta",
            total: 98.5,
            days: 4,
            insurable: false,
            pickup: false,
          }),
          // A carrier that could not price the parcel is not an option.
          rate({ id: "rate-3", success: false, total: null, currency_code: null, days: null }),
        ]),
      }),
    });

    const quotes = await provider.quote({ origin, destination, parcels });
    assert.equal(quotes.length, 2);
    const [fedex, estafeta] = quotes;
    assert.deepEqual(
      {
        provider: fedex.provider,
        carrier: fedex.carrier,
        carrierName: fedex.carrierName,
        service: fedex.service,
        price: fedex.price,
        currency: fedex.currency,
        min: fedex.estimatedDaysMin,
        max: fedex.estimatedDaysMax,
        estimate: fedex.deliveryEstimate,
        mode: fedex.fulfillmentMode,
        pickup: fedex.pickupSupported,
        insurance: fedex.insurance.available,
        quoteId: fedex.providerQuoteId,
        rateId: fedex.providerRateId,
      },
      {
        provider: id,
        carrier: "fedex",
        carrierName: "FedEx",
        service: "Standard Overnight",
        price: 150,
        currency: "MXN",
        min: 2,
        max: 2,
        estimate: "2 días hábiles",
        mode: "PARCEL_SHIPPING",
        pickup: true,
        insurance: true,
        quoteId: "quotation-1",
        rateId: "rate-1",
      },
    );
    assert.equal(estafeta.price, 98.5);
    assert.equal(estafeta.pickupSupported, false);
    assert.deepEqual(fedex.package, { count: 1, totalWeightKg: 2.4 });
    // "Los rates son válidos por 24 horas."
    assert.equal(Date.parse(fedex.expiresAt) - 1_760_000_000_000 >= 24 * 3600 * 1000 - 5000, true);

    // The request follows the documented body, and carries the bearer token.
    const sent = transport.calls.find((call) => call.key === QUOTE);
    assert.deepEqual(sent.body.quotation.address_to, {
      country_code: "MX",
      postal_code: "64000",
      area_level1: "Nuevo León",
      area_level2: "Monterrey",
      area_level3: "Monterrey Centro",
    });
    assert.deepEqual(sent.body.quotation.parcels, [
      { length: 30, width: 20, height: 15, weight: 2.4 },
    ]);
    assert.equal(sent.headers.Authorization, "Bearer test-access-token");
  });
}

test("credentials are exchanged with the documented client-credentials body", async () => {
  const { provider, transport } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
  });
  await provider.authenticate();
  assert.deepEqual(transport.calls[0].body, {
    grant_type: "client_credentials",
    client_id: "client-id",
    client_secret: "client-secret",
  });
  assert.equal(transport.calls[0].url, "https://sb-pro.skydropx.com/api/v1/oauth/token");
});

test("the token is cached and reused across calls", async () => {
  const { provider, transport } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [QUOTE]: () => ({ status: 201, body: quotation([rate()]) }),
  });
  await provider.quote({ origin, destination, parcels });
  await provider.quote({ origin, destination, parcels });
  await Promise.all([provider.authenticate(), provider.authenticate()]);
  assert.equal(transport.count(TOKEN), 1);
});

test("an expired token is refreshed before the next call", async () => {
  const { provider, transport, clock } = build("solo_envios", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [QUOTE]: () => ({ status: 201, body: quotation([rate()]) }),
  });
  await provider.quote({ origin, destination, parcels });
  // "El token expira en 2 horas": just short of two hours it is already renewed.
  clock.advance(2 * 3600 * 1000 - 60_000);
  await provider.quote({ origin, destination, parcels });
  assert.equal(transport.count(TOKEN), 2);
});

test("a 401 on a call drops the token and retries once with a new one", async () => {
  const { provider, transport } = build("skydropx", {
    [TOKEN]: [
      () => ({ status: 200, body: tokenResponse({ access_token: "stale" }) }),
      () => ({ status: 200, body: tokenResponse({ access_token: "fresh" }) }),
    ],
    [QUOTE]: [
      () => ({ status: 401, body: { error: "unauthorized" } }),
      () => ({ status: 201, body: quotation([rate()]) }),
    ],
  });
  const quotes = await provider.quote({ origin, destination, parcels });
  assert.equal(quotes.length, 1);
  assert.equal(transport.count(TOKEN), 2);
  const attempts = transport.calls.filter((call) => call.key === QUOTE);
  assert.deepEqual(
    attempts.map((call) => call.headers.Authorization),
    ["Bearer stale", "Bearer fresh"],
  );
});

test("rejected credentials fail as AUTH_FAILED without echoing the response", async () => {
  const { provider } = build("skydropx", {
    [TOKEN]: () => ({
      status: 401,
      body: { error: "invalid_client", error_description: "client-secret" },
    }),
  });
  await assert.rejects(provider.authenticate(), (error) => {
    assert.ok(error instanceof ShippingError);
    assert.equal(error.code, "AUTH_FAILED");
    assert.doesNotMatch(error.message, /client-secret/);
    return true;
  });
});

test("requests are spaced to respect the documented two per second", async () => {
  const { provider, transport, clock } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [QUOTE]: () => ({ status: 201, body: quotation([rate()]) }),
  });
  const started = clock.now();
  await Promise.all([
    provider.quote({ origin, destination, parcels }),
    provider.quote({ origin, destination, parcels }),
    provider.quote({ origin, destination, parcels }),
  ]);
  // token + three quotations = four requests, at least 500 ms apart.
  assert.equal(transport.calls.length, 4);
  assert.ok(clock.now() - started >= 3 * 500);
});

test("an asynchronous quotation is polled until is_completed", async () => {
  const { provider, transport } = build("solo_envios", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [QUOTE]: () => ({ status: 201, body: quotation([], { is_completed: false }) }),
    "GET /api/v1/quotations/quotation-1": [
      () => ({ status: 200, body: quotation([], { is_completed: false }) }),
      () => ({ status: 200, body: quotation([rate()]) }),
    ],
  });
  const quotes = await provider.quote({ origin, destination, parcels });
  assert.equal(quotes.length, 1);
  assert.equal(transport.count("GET /api/v1/quotations/quotation-1"), 2);
});

test("a quotation that never completes fails as QUOTE_INCOMPLETE", async () => {
  const { provider } = build(
    "skydropx",
    {
      [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
      [QUOTE]: () => ({ status: 201, body: quotation([], { is_completed: false }) }),
      "GET /api/v1/quotations/quotation-1": () => ({
        status: 200,
        body: quotation([], { is_completed: false }),
      }),
    },
    { quotePollTimeoutMs: 5_000 },
  );
  await assert.rejects(provider.quote({ origin, destination, parcels }), (error) => {
    assert.equal(error.code, "QUOTE_INCOMPLETE");
    return true;
  });
});

test("a provider timeout on a quote is a retryable TIMEOUT, not a crash", async () => {
  const { provider } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [QUOTE]: () => {
      throw new Error("socket hang up");
    },
  });
  await assert.rejects(provider.quote({ origin, destination, parcels }), (error) => {
    assert.equal(error.code, "TIMEOUT");
    assert.equal(error.retryable, true);
    return true;
  });
});

test("reads are retried on 429 and 5xx; a rate limit is reported as RATE_LIMITED", async () => {
  const { provider, transport } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    "GET /api/v1/shipments/shipment-1": [
      () => ({ status: 429, body: { error: "too_many_requests" } }),
      () => ({ status: 503, body: {} }),
      () => ({ status: 200, body: shipment() }),
    ],
  });
  const found = await provider.getShipment("shipment-1");
  assert.equal(found.providerShipmentId, "shipment-1");
  assert.equal(transport.count("GET /api/v1/shipments/shipment-1"), 3);

  const limited = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    "GET /api/v1/shipments/shipment-1": () => ({ status: 429, body: {} }),
  });
  await assert.rejects(limited.provider.getShipment("shipment-1"), (error) => {
    assert.equal(error.code, "RATE_LIMITED");
    return true;
  });
});

test("creating a shipment sends the rate, asks for idempotency and normalises the label", async () => {
  const { provider, transport } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [SHIP]: () => ({ status: 201, body: shipment() }),
  });
  const created = await provider.createShipment(shipmentRequest);
  assert.deepEqual(
    {
      id: created.providerShipmentId,
      status: created.status,
      raw: created.rawStatus,
      master: created.masterTrackingNumber,
      price: created.price,
      replayed: created.replayed,
      packages: created.packages,
    },
    {
      id: "shipment-1",
      status: "LABEL_CREATED",
      raw: "success",
      master: "794874381730",
      price: 150,
      replayed: false,
      packages: [
        {
          trackingNumber: "794874381730",
          trackingUrl: "https://carrier.example.test/track/794874381730",
          labelUrl: "https://labels.example.test/794874381730.pdf",
          status: "LABEL_CREATED",
          rawStatus: "created",
        },
      ],
    },
  );
  const body = transport.calls.find((call) => call.key === SHIP).body.shipment;
  assert.equal(body.rate_id, "rate-1");
  assert.equal(body.unique_shipment, true, "provider-side idempotency must always be requested");
  assert.deepEqual(body.packages, [
    {
      package_number: "1",
      consignment_note: "50181700",
      package_type: "4G",
      package_protected: false,
    },
  ]);
  assert.equal(body.address_to.street1, "Calle Ejemplo 10");
});

test("a label purchase is never retried, and an unknown outcome is AMBIGUOUS_WRITE", async () => {
  for (const failure of [
    () => {
      throw new Error("timeout");
    },
    () => ({ status: 502, body: {} }),
    () => ({ status: 409, body: { error: "conflict" } }),
  ]) {
    const { provider, transport } = build("solo_envios", {
      [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
      [SHIP]: failure,
    });
    await assert.rejects(provider.createShipment(shipmentRequest), (error) => {
      assert.equal(error.code, "AMBIGUOUS_WRITE");
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(transport.count(SHIP), 1, "exactly one purchase attempt");
  }
});

test("a definite rejection of a shipment is INVALID_REQUEST, not ambiguous", async () => {
  const { provider } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [SHIP]: () => ({
      status: 422,
      body: { error: "unprocessable_entity", error_description: "Tarifa expirada" },
    }),
  });
  await assert.rejects(provider.createShipment(shipmentRequest), (error) => {
    assert.equal(error.code, "INVALID_REQUEST");
    return true;
  });
});

test("a replayed shipment response (200) is flagged as a replay", async () => {
  const { provider } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [SHIP]: () => ({ status: 200, body: shipment() }),
  });
  assert.equal((await provider.createShipment(shipmentRequest)).replayed, true);
});

test("cancellation reports acceptance, and a refusal is an answer rather than an error", async () => {
  const path = "POST /api/v1/shipments/shipment-1/cancellations";
  const accepted = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [path]: () => ({
      status: 201,
      body: { data: { id: "c-1", attributes: { status: "reviewing" } } },
    }),
  });
  const ok = await accepted.provider.cancelShipment("shipment-1", "Pedido cancelado");
  assert.deepEqual([ok.accepted, ok.rawStatus], [true, "reviewing"]);
  assert.deepEqual(accepted.transport.calls.at(-1).body, { reason: "Pedido cancelado" });

  const refused = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    [path]: () => ({ status: 422, body: { error_description: "El envío no se puede cancelar" } }),
  });
  const no = await refused.provider.cancelShipment("shipment-1", "Pedido cancelado");
  assert.deepEqual([no.accepted, no.rawStatus], [false, "El envío no se puede cancelar"]);
});

test("tracking events are normalised and the raw provider status is preserved", async () => {
  const { provider, transport } = build("solo_envios", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    "GET /api/v1/shipments/tracking": () => ({
      status: 200,
      body: {
        data: [
          {
            id: "e1",
            attributes: {
              status: "picked_up",
              date: "2026-10-01T10:00:00-06:00",
              location: "Tecámac",
            },
          },
          {
            id: "e2",
            attributes: {
              status: "last_mile",
              date: "2026-10-02T09:00:00-06:00",
              event_description: "En ruta",
            },
          },
          { id: "e3", attributes: { status: "something_new", date: "2026-10-01T12:00:00-06:00" } },
        ],
      },
    }),
  });
  const tracking = await provider.getTracking("794874381730", "fedex");
  assert.equal(tracking.status, "OUT_FOR_DELIVERY");
  assert.equal(tracking.rawStatus, "last_mile");
  assert.deepEqual(
    tracking.events.map((event) => event.rawStatus),
    ["picked_up", "last_mile", "something_new"],
  );
  assert.equal(transport.calls.at(-1).search, "?tracking_number=794874381730&carrier_name=fedex");
});

test("label URLs come from the shipment's packages", async () => {
  const { provider } = build("skydropx", {
    [TOKEN]: () => ({ status: 200, body: tokenResponse() }),
    "GET /api/v1/shipments/shipment-1": () => ({ status: 200, body: shipment() }),
  });
  assert.deepEqual(await provider.getLabel("shipment-1"), [
    "https://labels.example.test/794874381730.pdf",
  ]);
});

test("provider configuration defaults to sandbox and reports missing names, never values", () => {
  const [skydropx, solo] = providers.SHIPPING_PROVIDER_DEFINITIONS;
  assert.deepEqual(providers.providerConfigHealth(skydropx, {}), {
    provider: "skydropx",
    state: "NOT_CONFIGURED",
    environment: null,
    missing: ["SKYDROPX_CLIENT_ID", "SKYDROPX_CLIENT_SECRET"],
  });

  const env = { SOLO_ENVIOS_CLIENT_ID: "id-value", SOLO_ENVIOS_CLIENT_SECRET: "secret-value" };
  // Credentials alone do not enable a provider.
  assert.equal(providers.providerConfigHealth(solo, env).state, "NOT_CONFIGURED");
  assert.equal(providers.configuredShippingProviders(env).length, 0);

  const enabled = { ...env, SOLO_ENVIOS_ENABLED: "true" };
  const health = providers.providerConfigHealth(solo, enabled);
  assert.deepEqual([health.state, health.environment], ["SANDBOX", "sandbox"]);
  assert.equal(
    providers.resolveProviderConfig(solo, enabled).config.baseUrl,
    "https://sb-app.soloenvios.com",
  );
  assert.doesNotMatch(
    JSON.stringify(providers.shippingConfigHealth(enabled)),
    /secret-value|id-value/,
  );

  // Production credentials are never reported CONNECTED or LIVE from config alone.
  const production = providers.providerConfigHealth(solo, {
    ...enabled,
    SOLO_ENVIOS_ENVIRONMENT: "production",
  });
  assert.equal(production.state, "NOT_CONFIGURED");
  assert.deepEqual(production.missing, ["PRODUCTION_VERIFICATION"]);
  assert.equal(
    providers.resolveProviderConfig(skydropx, {
      SKYDROPX_CLIENT_ID: "a",
      SKYDROPX_CLIENT_SECRET: "b",
      SKYDROPX_ENVIRONMENT: "production",
    }).config.baseUrl,
    "https://api-pro.skydropx.com",
  );
  // A non-https override is refused.
  assert.equal(
    providers.resolveProviderConfig(skydropx, {
      SKYDROPX_CLIENT_ID: "a",
      SKYDROPX_CLIENT_SECRET: "b",
      SKYDROPX_BASE_URL: "http://evil.example.test",
    }).config,
    null,
  );
});
