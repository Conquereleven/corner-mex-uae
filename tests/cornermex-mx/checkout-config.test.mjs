// Mexico checkout configuration is fail-closed and inherits nothing from the UAE.
import assert from "node:assert/strict";
import test from "node:test";

const config = await import("../../src/lib/mx-checkout-config.server.ts");

const RULES = JSON.stringify([
  {
    id: "nacional",
    label: "Envío nacional",
    mode: "PARCEL_SHIPPING",
    postalPrefixes: ["*"],
    price: 149,
    daysMin: 3,
    daysMax: 6,
  },
]);
const ORIGIN = JSON.stringify({
  name: "Almacén CornerMex",
  company: "CornerMex",
  phone: "5512345678",
  email: ["envios", "example.test"].join("@"),
  street: "Calle Ejemplo",
  exterior_number: "10",
  colonia: "Centro",
  municipality: "Tecámac",
  state: "MEX",
  postal_code: "55740",
});
const MX_REF = "mexicoprojectref0001";
const database = {
  CORNERMEX_MARKET: "MX",
  CORNERMEX_MX_SUPABASE_PROJECT_REF: MX_REF,
  SUPABASE_URL: `https://${MX_REF}.supabase.co`,
};
const mercadoPago = {
  MERCADO_PAGO_ENABLED: "true",
  MERCADO_PAGO_ACCESS_TOKEN: "TEST-access-token-value",
  MERCADO_PAGO_WEBHOOK_SECRET: "mp-webhook-secret-value",
};
const ready = {
  ...database,
  ...mercadoPago,
  CORNERMEX_CHECKOUT_ENABLED: "true",
  CORNERMEX_QUOTE_SIGNING_SECRET: "q".repeat(48),
  CORNERMEX_MX_MANUAL_SHIPPING_JSON: RULES,
};

test("an unconfigured deployment is inert and says exactly why", () => {
  const evaluation = config.evaluateMxCheckout({});
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.reasons, [
    "checkout_execution_disabled",
    "missing_CORNERMEX_QUOTE_SIGNING_SECRET",
    "no_shipping_source_configured",
    "market_database:CORNERMEX_MARKET_must_be_MX",
    "market_database:missing_CORNERMEX_MX_SUPABASE_PROJECT_REF",
    "market_database:SUPABASE_URL_project_unreadable",
    "no_payment_method_enabled",
  ]);
});

test("checkout never runs against a UAE database, however complete the rest is", () => {
  const evaluation = config.evaluateMxCheckout({
    ...ready,
    SUPABASE_URL: "https://wlrfknmrhowldygmvtvn.supabase.co",
  });
  assert.equal(evaluation.ready, false);
  assert.ok(
    evaluation.reasons.includes("market_database:SUPABASE_URL_points_at_a_non_mexico_database"),
  );
});

test("the UAE's cash-on-delivery configuration enables nothing in Mexico", () => {
  const uaeStyle = {
    ...ready,
    ...Object.fromEntries(Object.keys(mercadoPago).map((key) => [key, undefined])),
    CORNERMEX_COMMERCE_ACTIVE_MODE: "cod",
    CORNERMEX_COD_SUPPORTED_EMIRATES: "DU,AD",
    CORNERMEX_MX_COD_ENABLED: "true",
  };
  const evaluation = config.evaluateMxCheckout(uaeStyle);
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.reasons, ["no_payment_method_enabled"]);
  assert.deepEqual(config.getPublicMxCheckoutConfig(uaeStyle).paymentOptions, []);
});

test("launch payments are the providers; cash on delivery is off by default", () => {
  const evaluation = config.evaluateMxCheckout(ready);
  assert.equal(evaluation.ready, true);
  assert.deepEqual(evaluation.config.paymentOptions, [
    { id: "mercado_pago", localDeliveryOnly: false },
  ]);
  assert.deepEqual(
    evaluation.config.paymentProviders.map((provider) => provider.id),
    ["mercado_pago"],
  );
  assert.equal(evaluation.config.addedTaxRate, 0);
  assert.equal(evaluation.config.rankingPolicy, "BEST_VALUE");

  const both = config.evaluateMxCheckout({
    ...ready,
    CLIP_ENABLED: "true",
    CLIP_ENVIRONMENT: "production",
    CLIP_API_KEY: "k",
    CLIP_API_SECRET: "s",
    CLIP_WEBHOOK_SECRET: "w".repeat(40),
  });
  // Mercado Pago is primary, Clip secondary.
  assert.deepEqual(
    both.config.paymentOptions.map((option) => option.id),
    ["mercado_pago", "clip"],
  );
});

test("cash on delivery, when enabled, is local-delivery only — never national", () => {
  const evaluation = config.evaluateMxCheckout({
    ...ready,
    CORNERMEX_MX_COD_LOCAL_ENABLED: "true",
  });
  const cod = evaluation.config.paymentOptions.find((option) => option.id === "cod");
  assert.deepEqual(cod, { id: "cod", localDeliveryOnly: true });
  assert.equal(config.paymentAllowedFor(cod, "LOCAL_DELIVERY"), true);
  assert.equal(config.paymentAllowedFor(cod, "PARCEL_SHIPPING"), false);
  assert.equal(config.paymentAllowedFor(cod, "PICKUP"), false);
  const provider = evaluation.config.paymentOptions[0];
  assert.equal(config.paymentAllowedFor(provider, "PARCEL_SHIPPING"), true);
  assert.equal(config.paymentAllowedFor(undefined, "LOCAL_DELIVERY"), false);
  // On its own, local cash on delivery is a valid configuration for a local pilot.
  const codOnly = {
    ...ready,
    ...Object.fromEntries(Object.keys(mercadoPago).map((key) => [key, undefined])),
    CORNERMEX_MX_COD_LOCAL_ENABLED: "true",
  };
  assert.deepEqual(config.evaluateMxCheckout(codOnly).config.paymentOptions, [
    { id: "cod", localDeliveryOnly: true },
  ]);
});

test("the public checkout view is MXN, shows no tax line and leaks no secret", () => {
  const view = config.getPublicMxCheckoutConfig(ready);
  assert.deepEqual(view.market, { country: "MX", currency: "MXN", locale: "es-MX" });
  assert.equal(view.taxLabel, null);
  const text = JSON.stringify(view);
  assert.doesNotMatch(text, /q{48}|TEST-access-token-value|mp-webhook-secret-value/);
  assert.doesNotMatch(text, /AED|emirate|TRN|VAT/i);
});

test("a carrier provider needs an origin address before it may quote", () => {
  const withCarrier = {
    ...ready,
    CORNERMEX_MX_MANUAL_SHIPPING_JSON: undefined,
    SKYDROPX_ENABLED: "true",
    SKYDROPX_CLIENT_ID: "id",
    SKYDROPX_CLIENT_SECRET: "secret",
  };
  const missing = config.evaluateMxCheckout(withCarrier);
  assert.equal(missing.ready, false);
  assert.ok(missing.reasons.includes("CORNERMEX_MX_ORIGIN_JSON:origin_not_configured"));
  assert.ok(missing.reasons.includes("no_shipping_source_configured"));

  const complete = config.evaluateMxCheckout({ ...withCarrier, CORNERMEX_MX_ORIGIN_JSON: ORIGIN });
  assert.equal(complete.ready, true);
  assert.deepEqual(
    complete.config.providers.map((provider) => provider.id),
    ["skydropx"],
  );
  assert.equal(complete.config.origin.name, "CornerMex MX - Tecámac");
});

test("malformed shipping rules and an unknown ranking policy fail closed", () => {
  assert.ok(
    config
      .evaluateMxCheckout({ ...ready, CORNERMEX_MX_MANUAL_SHIPPING_JSON: "[oops" })
      .reasons.includes("invalid_CORNERMEX_MX_MANUAL_SHIPPING_JSON"),
  );
  assert.ok(
    config
      .evaluateMxCheckout({ ...ready, CORNERMEX_MX_SHIPPING_RANKING: "RANDOM" })
      .reasons.includes("invalid_CORNERMEX_MX_SHIPPING_RANKING"),
  );
  assert.equal(
    config.evaluateMxCheckout({ ...ready, CORNERMEX_MX_SHIPPING_RANKING: "CHEAPEST" }).config
      .rankingPolicy,
    "CHEAPEST",
  );
});

test("production refuses orders until the Mexico legal documents are published", () => {
  const production = { ...ready, CORNERMEX_APPLICATION_ENV: "production" };
  assert.deepEqual(config.evaluateMxCheckout(production).reasons, [
    "mx_legal_documents_not_published",
  ]);
  assert.equal(
    config.evaluateMxCheckout({ ...production, CORNERMEX_MX_LEGAL_DOCS_PUBLISHED: "true" }).ready,
    true,
  );
});

test("payment integration health never exposes a credential", () => {
  const health = config.getPaymentIntegrationHealth(ready);
  assert.deepEqual(
    health.map((entry) => [entry.provider, entry.state]),
    [
      ["mercado_pago", "SANDBOX"],
      ["clip", "NOT_CONFIGURED"],
    ],
  );
  assert.doesNotMatch(JSON.stringify(health), /TEST-access-token-value|mp-webhook-secret-value/);
});

test("shipping integration health never exposes a credential", () => {
  const health = config.getShippingIntegrationHealth({
    SKYDROPX_CLIENT_ID: "the-id",
    SKYDROPX_CLIENT_SECRET: "the-secret",
    SKYDROPX_ENABLED: "true",
  });
  assert.deepEqual(
    health.map((entry) => [entry.provider, entry.state]),
    [
      ["skydropx", "SANDBOX"],
      ["solo_envios", "NOT_CONFIGURED"],
    ],
  );
  assert.doesNotMatch(JSON.stringify(health), /the-id|the-secret/);
});

test("totals are computed on the server and round to centavos", () => {
  assert.deepEqual(config.computeMxTotals(199.999, 149, 0), {
    subtotal: 200,
    shipping: 149,
    tax: 0,
    total: 349,
  });
  assert.deepEqual(config.computeMxTotals(100, 50, 0.16), {
    subtotal: 100,
    shipping: 50,
    tax: 16,
    total: 166,
  });
});
