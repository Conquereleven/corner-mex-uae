import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_SHIPPING_RATES_AED,
  DEFAULT_VAT_RATE,
  FOUNDER_ATTESTED_TRN,
  computeOrderTotals,
  evaluateCommercialConfig,
  getPublicCommercialConfig,
  isCommercialActive,
  shippingForEmirate,
} from "../../src/lib/commercial-config.server.ts";
import { getAvailablePaymentMethods } from "../../src/lib/payment-methods.ts";
import {
  MANIFEST_LIMITS,
  validateActivationManifest,
} from "../../scripts/cm-com-3a/validate-activation-manifest.mjs";
import { normalizeCatalog, summarize } from "../../scripts/cm-com-3a/ingest-intermex-catalog.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p) => readFile(path.join(root, p), "utf8");
const stripSqlComments = (sql) => sql.replace(/--[^\n]*/g, "");
const stripJsComments = (code) => code.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const FULL_RATES = { DU: 15, AD: 15, SH: 20, AJ: 20, UQ: 20, RK: 20, FU: 20 };

const READY_ENV = {
  CORNERMEX_CHECKOUT_ENABLED: "true",
  CORNERMEX_COD_SHIPPING_RATES_JSON: JSON.stringify({
    DU: 15,
    AD: 15,
    SH: 20,
    AJ: 20,
    UQ: 20,
    RK: 20,
    FU: 20,
  }),
  CORNERMEX_COD_SUPPORTED_EMIRATES: "DU,SH",
  CORNERMEX_VAT_RATE: "0",
};

// --- fail-closed configuration -------------------------------------------

test("checkout disabled fails closed", () => {
  const evaluation = evaluateCommercialConfig({
    ...READY_ENV,
    CORNERMEX_CHECKOUT_ENABLED: "false",
  });
  assert.equal(evaluation.ready, false);
  assert.ok(evaluation.reasons.includes("checkout_execution_disabled"));
  assert.equal(isCommercialActive({ ...READY_ENV, CORNERMEX_CHECKOUT_ENABLED: undefined }), false);
});

test("only the exact string true can enable checkout", () => {
  for (const value of [undefined, "", "false", "1", "TRUE", "yes", "on"]) {
    assert.equal(
      isCommercialActive({ ...READY_ENV, CORNERMEX_CHECKOUT_ENABLED: value }),
      false,
      value,
    );
  }
  assert.equal(isCommercialActive(READY_ENV), true);
});

test("an incomplete per-emirate shipping table fails closed", () => {
  // Every emirate must resolve; a partial table is never silently completed.
  const evaluation = evaluateCommercialConfig({
    ...READY_ENV,
    CORNERMEX_COD_SHIPPING_RATES_JSON: JSON.stringify({ DU: 15 }),
  });
  assert.equal(evaluation.ready, false);
  assert.ok(evaluation.reasons.some((r) => r.includes("COD_SHIPPING_RATES_JSON")));
});

test("the Founder-approved per-emirate rates apply when no override is set", () => {
  const { config } = evaluateCommercialConfig({
    ...READY_ENV,
    CORNERMEX_COD_SHIPPING_RATES_JSON: undefined,
    CORNERMEX_COD_SUPPORTED_EMIRATES: "DU,AD,SH,AJ,UQ,RK,FU",
  });
  assert.deepEqual(config.shippingRates, DEFAULT_SHIPPING_RATES_AED);
  assert.equal(shippingForEmirate("DU", config), 15);
  assert.equal(shippingForEmirate("AD", config), 15);
  for (const code of ["SH", "AJ", "UQ", "RK", "FU"]) {
    assert.equal(shippingForEmirate(code, config), 20, code);
  }
});

test("shipping resolution fails closed for an unsupported emirate", () => {
  const { config } = evaluateCommercialConfig(READY_ENV);
  assert.throws(() => shippingForEmirate("FU", config), /COD_ORDER_EMIRATE_UNSUPPORTED/);
  assert.throws(() => shippingForEmirate("XX", config), /COD_ORDER_EMIRATE_UNSUPPORTED/);
});

test("VAT defaults to the Founder-attested 5% and a valid TRN", () => {
  const { config } = evaluateCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_RATE: undefined });
  assert.equal(config.vatRate, DEFAULT_VAT_RATE);
  assert.equal(config.vatRate, 0.05);
  assert.match(config.vatTrn, /^\d{15}$/);
  assert.equal(config.vatTrn, FOUNDER_ATTESTED_TRN);
  const bad = evaluateCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_TRN: "12345" });
  assert.equal(bad.ready, false);
  assert.ok(bad.reasons.includes("invalid_CORNERMEX_VAT_TRN"));
});

test("invalid commercial configuration fails closed", () => {
  for (const patch of [
    { CORNERMEX_COD_SHIPPING_RATES_JSON: JSON.stringify({ ...FULL_RATES, DU: -5 }) },
    { CORNERMEX_COD_SHIPPING_RATES_JSON: JSON.stringify({ ...FULL_RATES, DU: "twenty" }) },
    { CORNERMEX_COD_SHIPPING_RATES_JSON: "{not json" },
    { CORNERMEX_COD_SUPPORTED_EMIRATES: "" },
    { CORNERMEX_COD_SUPPORTED_EMIRATES: "XX" },
    { CORNERMEX_COD_SUPPORTED_EMIRATES: "DU,DU" },
    { CORNERMEX_VAT_RATE: "5" },
    { CORNERMEX_VAT_RATE: "abc" },
    { CORNERMEX_COMMERCE_ACTIVE_MODE: "card" },
  ]) {
    const evaluation = evaluateCommercialConfig({ ...READY_ENV, ...patch });
    assert.equal(evaluation.ready, false, JSON.stringify(patch));
    assert.ok(evaluation.reasons.length > 0);
  }
});

test("unsupported emirate is not offered to the customer", () => {
  const config = getPublicCommercialConfig(READY_ENV);
  assert.deepEqual(config.supportedEmirates, ["DU", "SH"]);
  assert.ok(!config.supportedEmirates.includes("FU"));
});

// --- money is server-authoritative ---------------------------------------

test("server shipping and tax are authoritative and per-emirate", () => {
  const { config } = evaluateCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_RATE: "0.05" });
  const dubai = computeOrderTotals(100, config, "DU");
  assert.equal(dubai.shippingAed, 15);
  assert.equal(dubai.taxAed, 5);
  assert.equal(dubai.totalAed, 120);
  const sharjah = computeOrderTotals(100, config, "SH");
  assert.equal(sharjah.shippingAed, 20);
  assert.equal(sharjah.totalAed, 125);
});

test("VAT of zero does not claim a 5% VAT label", () => {
  const zero = getPublicCommercialConfig(READY_ENV);
  assert.equal(zero.vatRate, 0);
  assert.equal(zero.taxLabel, null, "no VAT label may be shown when no tax is configured");
  const five = getPublicCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_RATE: "0.05" });
  assert.equal(five.taxLabel, "VAT (5%)");
});

test("the order input schema accepts no client-supplied money", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  const schema = source.slice(
    source.indexOf("export const PlaceCodOrderInput"),
    source.indexOf("export type PlaceCodOrderResult"),
  );
  for (const forbidden of ["price", "subtotal", "total", "shipping_aed", "tax"]) {
    assert.ok(!schema.includes(forbidden), `client must not be able to send ${forbidden}`);
  }
  assert.ok(schema.includes("variant_id") && schema.includes("qty"));
});

// --- COD-only payment surface --------------------------------------------

test("commercial-active surface offers COD only", () => {
  const methods = getAvailablePaymentMethods({ subtotal: 100, emirate: "DU", codOnly: true });
  assert.equal(methods.length, 1);
  assert.equal(methods[0].id, "cod");
  assert.equal(methods[0].enabled, true);
  for (const forbidden of ["card", "apple_pay", "google_pay", "tabby", "tamara", "bank_transfer"]) {
    assert.ok(!methods.some((m) => m.id === forbidden), `${forbidden} must not be offered`);
  }
});

test("future provider code is retained but inactive", () => {
  const legacy = getAvailablePaymentMethods({ subtotal: 100, emirate: "DU" });
  assert.ok(
    legacy.some((m) => m.id === "card"),
    "provider code must not be deleted",
  );
});

test("the server rejects a forged non-COD payment method", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  assert.match(source, /payment_method: z\.literal\("cod"\)/);
  assert.match(source, /if \(data\.payment_method !== "cod"\)/);
  assert.match(source, /COD_ORDER_METHOD_INVALID/);
});

test("the server rejects an unsupported emirate", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  assert.match(source, /shippingForEmirate\(data\.address\.emirate, config\)/);
  assert.match(source, /COD_ORDER_EMIRATE_UNSUPPORTED/);
});

test("legal acceptance is required before execution", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  assert.match(source, /COD_ORDER_LEGAL_ACCEPTANCE_REQUIRED/);
  assert.match(source, /accepted_at/);
});

// --- checkout UI ----------------------------------------------------------

test("checkout executes only the CM-COM-3A COD path", async () => {
  const raw = await read("src/routes/checkout.tsx");
  const source = stripJsComments(raw);
  assert.match(source, /placeCodOrder/);
  assert.match(source, /previewCodOrderTotals/);
  assert.match(source, /getCommercialCheckoutConfig/);
  for (const forbidden of [
    "placeOrder",
    "createStripeSession",
    "stripe",
    "tabby",
    "tamara",
    "bank_transfer",
    "apple_pay",
    "google_pay",
  ]) {
    assert.ok(!source.includes(forbidden), `checkout must not execute ${forbidden}`);
  }
  assert.match(source, /codOnly: true/, "only COD may be offered");
});

test("checkout sends no money and no unchecked legal acceptance", async () => {
  const source = stripJsComments(await read("src/routes/checkout.tsx"));
  const payload = source.slice(source.indexOf("await placeCod("), source.indexOf("clear();"));
  for (const forbidden of ["price", "subtotal", "shipping_aed", "tax", "total"]) {
    assert.ok(!payload.includes(forbidden), `checkout must not send ${forbidden}`);
  }
  assert.match(payload, /variant_id/);
  assert.match(payload, /payment_method: "cod"/);
  // Acceptance starts unchecked and gates the submit button.
  assert.match(source, /useState\(false\)/);
  assert.match(source, /readyToOrder =[\s\S]{0,160}accepted;/);
  assert.match(source, /canExecute = CHECKOUT_ENABLED && readyToOrder/);
});

test("checkout clears the cart only after a real order and guards double submit", async () => {
  const source = stripJsComments(await read("src/routes/checkout.tsx"));
  const submit = source.slice(
    source.indexOf("async function submit"),
    source.lastIndexOf("if (items.length === 0)"),
  );
  assert.match(
    submit,
    /if \(submitting \|\| !canExecute\) return;/,
    "double submit must be blocked",
  );
  const orderIndex = submit.indexOf("await placeCod(");
  const clearIndex = submit.indexOf("clear();");
  assert.ok(orderIndex > 0 && clearIndex > orderIndex, "the cart may only clear after the order");
  assert.equal(submit.split("clear();").length - 1, 1, "the cart must clear exactly once");
  const failure = submit.slice(submit.indexOf("} catch"));
  assert.ok(!failure.includes("clear();"), "a failure must never clear the cart");
  assert.ok(!failure.includes("order-confirmed"), "a failure must never fake success");
  assert.match(submit, /navigate\(\{ to: "\/order-confirmed"/);
});

// --- migration contract ---------------------------------------------------

test("the COD migration is prepared but not applied", async () => {
  const contract = JSON.parse(await read("contracts/lovable-cloud-migration-ownership-v1.json"));
  assert.ok(
    contract.pendingCanonicalMigrations.some((n) => n.includes("place_cod_order_v1")),
    "the COD migration must stay in the pending (unapplied) set",
  );
  assert.ok(
    !contract.activeCanonicalMigrations.some((n) => n.includes("place_cod_order_v1")),
    "the COD migration must not be listed as applied",
  );
});

test("the migration generates an order number and locks stock", async () => {
  const sql = await read("supabase/pending-canonical/20260809010000_place_cod_order_v1.sql");
  assert.match(sql, /for update/i, "variants must be locked");
  assert.match(sql, /order_number/);
  assert.match(sql, /unique_violation/, "order number collisions must be retried");
  assert.match(sql, /stock = stock - /, "stock must be decremented");
  assert.match(sql, /COD_ORDER_INSUFFICIENT_STOCK/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function[\s\S]{0,160}from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]{0,160}to service_role/i);
});

test("the migration has no marketplace schema dependency", async () => {
  const sql = stripSqlComments(
    await read("supabase/pending-canonical/20260809010000_place_cod_order_v1.sql"),
  );
  for (const forbidden of [
    "seller_id",
    "sellers",
    "commission",
    "shipping_zones",
    "shipping_rates",
    "coupon_id",
    "discount_aed",
  ]) {
    assert.ok(!sql.includes(forbidden), `migration must not reference ${forbidden}`);
  }
});

test("order confirmation uses A2-compatible fields only", async () => {
  const source = stripJsComments(await read("src/lib/payments.functions.ts"));
  const query = source.slice(
    source.indexOf("getOrderForConfirmation"),
    source.indexOf("getOrderForConfirmation") + 1400,
  );
  assert.ok(!query.includes("seller:sellers"), "confirmation must not join a sellers table");
  assert.ok(!query.includes("seller_id"), "order_items has no seller_id in A2");
  assert.match(query, /shipping_address/);
});

// --- activation manifest --------------------------------------------------

const VALID_MANIFEST = {
  categories: [{ slug: "salsas", names: { en: "Salsas" } }],
  products: [
    {
      slug: "example-salsa",
      sku: "EX-SALSA-450",
      category: "salsas",
      names: { en: "Example Salsa" },
      images: ["https://images.example.test/a.jpg"],
      format_label: "450 g",
      price_aed: 25.5,
      source_availability: "AVAILABLE",
      initial_stock: 1,
    },
  ],
};

test("a well-formed manifest produces a deterministic plan", () => {
  const first = validateActivationManifest(structuredClone(VALID_MANIFEST));
  const second = validateActivationManifest(structuredClone(VALID_MANIFEST));
  assert.equal(first.valid, true, JSON.stringify(first.errors));
  assert.equal(first.plan.dryRun, true);
  assert.deepEqual(first.plan, second.plan, "the plan must be deterministic");
  assert.equal(first.plan.totals.units, 1);
});

test("the manifest validator rejects malformed rows", () => {
  const cases = [
    ["duplicate slug", (m) => m.products.push({ ...m.products[0], sku: "OTHER-1" })],
    ["duplicate sku", (m) => m.products.push({ ...m.products[0], slug: "other-slug" })],
    ["negative price", (m) => (m.products[0].price_aed = -1)],
    ["negative stock", (m) => (m.products[0].initial_stock = -5)],
    ["invented stock above 1", (m) => (m.products[0].initial_stock = 12)],
    [
      "stock contradicting availability",
      (m) => {
        m.products[0].source_availability = "SOLD_OUT";
        m.products[0].initial_stock = 1;
      },
    ],
    ["non-https image", (m) => (m.products[0].images = ["http://insecure.test/a.jpg"])],
    ["empty images", (m) => (m.products[0].images = [])],
    ["unknown category", (m) => (m.products[0].category = "missing")],
    ["missing english name", (m) => delete m.products[0].names.en],
    ["invalid sku", (m) => (m.products[0].sku = "bad sku!")],
  ];
  for (const [name, mutate] of cases) {
    const manifest = structuredClone(VALID_MANIFEST);
    mutate(manifest);
    const result = validateActivationManifest(manifest);
    assert.equal(result.valid, false, `${name} should be rejected`);
    assert.equal(result.plan, null);
  }
});

test("the manifest tool never connects to or writes a database", async () => {
  const raw = await read("scripts/cm-com-3a/validate-activation-manifest.mjs");
  const source = stripJsComments(raw);
  for (const forbidden of ["createClient", "supabase", "fetch(", "writeFileSync", "insert into"]) {
    assert.ok(
      !source.toLowerCase().includes(forbidden.toLowerCase()),
      `manifest tool must not use ${forbidden}`,
    );
  }
  assert.match(raw, /DRY-RUN ONLY/i);
});

test("the manifest has no fixed catalog-size cap", () => {
  // The public catalog is dynamic (196 products observed in R2), so a large
  // manifest must validate rather than be rejected by an arbitrary limit.
  const manifest = structuredClone(VALID_MANIFEST);
  for (let i = 0; i < 250; i += 1) {
    manifest.products.push({ ...manifest.products[0], slug: `bulk-${i}`, sku: `BULK-${i}` });
  }
  const result = validateActivationManifest(manifest);
  assert.equal(result.valid, true, JSON.stringify(result.errors?.slice(0, 3)));
  assert.equal(result.plan.totals.products, 251);
  assert.equal(result.plan.totals.units, 251);
  assert.equal(MANIFEST_LIMITS.maxProducts, undefined, "no maximum product cap may exist");
});

test("intermex ingestion mirrors the effective price and never fabricates a source SKU", () => {
  const observedAt = "2026-08-09T00:00:00.000Z";
  const manifest = normalizeCatalog(
    [
      {
        id: 1,
        handle: "salsa-verde",
        title: "Salsa Verde",
        vendor: "La Costena",
        product_type: "Salsas",
        body_html: "<p>x</p>",
        images: [{ src: "https://cdn.example.test/a.jpg" }],
        variants: [
          {
            id: 11,
            sku: "REAL-SKU",
            title: "450 g",
            price: "12.00",
            compare_at_price: "15.00",
            available: true,
            grams: 450,
          },
          {
            id: 12,
            sku: "",
            title: "Default Title",
            price: "9.50",
            compare_at_price: null,
            available: false,
            grams: 0,
          },
        ],
      },
    ],
    observedAt,
  );
  const [product] = manifest.products;
  const [onSale, plain] = product.variants;
  // Pricing mirror: price_aed is exactly the effective price, sale wins.
  assert.equal(onSale.source_effective_price_aed, 12);
  assert.equal(onSale.price_aed, 12);
  assert.equal(onSale.source_regular_price_aed, 15);
  assert.equal(onSale.on_sale, true);
  assert.equal(plain.on_sale, false);
  // Source SKU preserved exactly; absent stays null with a separate CornerMex SKU.
  assert.equal(onSale.source_sku, "REAL-SKU");
  assert.equal(plain.source_sku, null);
  assert.match(plain.cornermex_sku, /^CM-/);
  // Availability is source state, never numeric stock.
  assert.equal(onSale.source_availability, "AVAILABLE");
  assert.equal(plain.source_availability, "SOLD_OUT");
  // Founder stock policy: available -> 1, everything else -> 0. Never above 1.
  assert.equal(onSale.initial_stock, 1);
  assert.equal(plain.initial_stock, 0);
  assert.equal(manifest.source_price_observed_at, observedAt);
});

test("catalog representation is separate from activation eligibility", () => {
  const manifest = normalizeCatalog(
    [
      {
        id: 2,
        handle: "sold-out-item",
        title: "Sold Out",
        vendor: "V",
        images: [{ src: "https://cdn.example.test/b.jpg" }],
        variants: [{ id: 21, sku: null, title: "Default Title", price: "5.00", available: false }],
      },
    ],
    "2026-08-09T00:00:00.000Z",
  );
  const summary = summarize(manifest);
  // A sold-out variant is still a VALID catalog row...
  assert.equal(summary.valid, true);
  assert.equal(summary.counts.validCatalogRows, 1);
  // ...carries zero stock under the Founder policy...
  assert.equal(summary.counts.variantsWithStockZero, 1);
  assert.equal(summary.counts.variantsWithStockOne, 0);
  // ...and is blocked from activation on availability.
  assert.equal(summary.counts.activationBlockedAvailability, 1);
  assert.equal(summary.counts.activationBlockedStockPolicy, undefined);
});

test("the ingestion crawler is public read-only with no fixed catalog cap", async () => {
  const source = await read("scripts/cm-com-3a/ingest-intermex-catalog.mjs");
  const code = stripJsComments(source);
  for (const forbidden of ["POST", "PUT", "DELETE", "/cart", "/checkout", "Authorization"]) {
    assert.ok(!code.includes(forbidden), `crawler must not use ${forbidden}`);
  }
  assert.match(source, /READ ONLY/i);
  // Pagination continues until exhausted; MAX_PAGES is only a loop guard.
  assert.match(code, /break;/);
  assert.ok(!/maxProducts/.test(code), "crawler must not impose a product cap");
});

test("halal is never defaulted to true", () => {
  const result = validateActivationManifest(structuredClone(VALID_MANIFEST));
  assert.equal(result.plan.products[0].is_halal, false);
});

// --- activation sequence ---------------------------------------------------

test("the activation runbook enables checkout last and rolls it back first", async () => {
  const runbook = await read("docs/program/CM-COM-3A_ACTIVATION_RUNBOOK.md");
  const enable = runbook.indexOf("CORNERMEX_CHECKOUT_ENABLED=true");
  const migration = runbook.search(/apply the exact reviewed COD/i);
  const manifest = runbook.search(/Validate the manifest and produce the dry-run plan/i);
  const deploy = runbook.search(/CHECKOUT_ENABLED` still false/i);
  assert.ok(
    migration > 0 && manifest > 0 && deploy > 0 && enable > 0,
    "runbook steps must be present",
  );
  assert.ok(
    migration < enable && manifest < enable && deploy < enable,
    "checkout must be enabled LAST",
  );
  assert.match(
    runbook,
    /CHECKOUT_ENABLED=false[\s\S]{0,160}first/i,
    "rollback must disable checkout first",
  );
});

test("the SQL contract test refuses to run against a remote database", async () => {
  const source = await read("scripts/cm-com-3a/test-cod-order-sql.mjs");
  assert.match(source, /COD_SQL_TEST_REFUSES_REMOTE_DATABASE/);
  assert.match(source, /supabase\\\.\(co\|com\)/);
});
