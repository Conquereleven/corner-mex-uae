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
  email: "envios@example.test",
  street: "Calle Ejemplo 10",
  colonia: "Centro",
  municipality: "Tecámac",
  state: "MEX",
  postal_code: "55740",
});
const ready = {
  CORNERMEX_CHECKOUT_ENABLED: "true",
  CORNERMEX_QUOTE_SIGNING_SECRET: "q".repeat(48),
  CORNERMEX_MX_MANUAL_SHIPPING_JSON: RULES,
  CORNERMEX_MX_COD_ENABLED: "true",
};

test("an unconfigured deployment is inert and says exactly why", () => {
  const evaluation = config.evaluateMxCheckout({});
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.reasons, [
    "checkout_execution_disabled",
    "missing_CORNERMEX_QUOTE_SIGNING_SECRET",
    "no_shipping_source_configured",
    "no_payment_method_enabled",
  ]);
});

test("cash on delivery is not inherited from the UAE: it needs its own Mexico flag", () => {
  const uaeStyle = {
    ...ready,
    CORNERMEX_MX_COD_ENABLED: undefined,
    CORNERMEX_COMMERCE_ACTIVE_MODE: "cod",
    CORNERMEX_COD_SUPPORTED_EMIRATES: "DU,AD",
  };
  const evaluation = config.evaluateMxCheckout(uaeStyle);
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.reasons, ["no_payment_method_enabled"]);
  assert.deepEqual(config.getPublicMxCheckoutConfig(uaeStyle).paymentMethods, []);
});

test("a complete configuration is ready, in MXN, with no tax line while tax is undetermined", () => {
  const evaluation = config.evaluateMxCheckout(ready);
  assert.equal(evaluation.ready, true);
  assert.deepEqual(evaluation.config.paymentMethods, ["cod"]);
  assert.equal(evaluation.config.addedTaxRate, 0);
  assert.equal(evaluation.config.rankingPolicy, "BEST_VALUE");

  const view = config.getPublicMxCheckoutConfig(ready);
  assert.deepEqual(view.market, { country: "MX", currency: "MXN", locale: "es-MX" });
  assert.equal(view.taxLabel, null);
  assert.doesNotMatch(JSON.stringify(view), /q{48}/, "the signing secret never reaches the client");
  assert.doesNotMatch(JSON.stringify(view), /AED|emirate|TRN|VAT/i);
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
