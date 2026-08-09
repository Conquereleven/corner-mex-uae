import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  computeOrderTotals,
  evaluateCommercialConfig,
  getPublicCommercialConfig,
  isCommercialActive,
} from "../../src/lib/commercial-config.server.ts";
import { getAvailablePaymentMethods } from "../../src/lib/payment-methods.ts";
import { validateActivationManifest } from "../../scripts/cm-com-3a/validate-activation-manifest.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p) => readFile(path.join(root, p), "utf8");
const stripSqlComments = (sql) => sql.replace(/--[^\n]*/g, "");
const stripJsComments = (code) => code.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const READY_ENV = {
  CORNERMEX_CHECKOUT_ENABLED: "true",
  CORNERMEX_COD_SHIPPING_AED: "20",
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

test("missing shipping configuration fails closed", () => {
  const evaluation = evaluateCommercialConfig({
    ...READY_ENV,
    CORNERMEX_COD_SHIPPING_AED: undefined,
  });
  assert.equal(evaluation.ready, false);
  assert.ok(evaluation.reasons.some((r) => r.includes("COD_SHIPPING_AED")));
});

test("invalid commercial configuration fails closed", () => {
  for (const patch of [
    { CORNERMEX_COD_SHIPPING_AED: "-5" },
    { CORNERMEX_COD_SHIPPING_AED: "twenty" },
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

test("server shipping and tax are authoritative", () => {
  const { config } = evaluateCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_RATE: "0.05" });
  const totals = computeOrderTotals(100, config);
  assert.equal(totals.shippingAed, 20);
  assert.equal(totals.taxAed, 5);
  assert.equal(totals.totalAed, 125);
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
  assert.match(source, /supportedEmirates\.includes/);
  assert.match(source, /COD_ORDER_EMIRATE_UNSUPPORTED/);
});

test("legal acceptance is required before execution", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  assert.match(source, /COD_ORDER_LEGAL_ACCEPTANCE_REQUIRED/);
  assert.match(source, /accepted_at/);
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
      initial_stock: 12,
    },
  ],
};

test("a well-formed manifest produces a deterministic plan", () => {
  const first = validateActivationManifest(structuredClone(VALID_MANIFEST));
  const second = validateActivationManifest(structuredClone(VALID_MANIFEST));
  assert.equal(first.valid, true, JSON.stringify(first.errors));
  assert.equal(first.plan.dryRun, true);
  assert.deepEqual(first.plan, second.plan, "the plan must be deterministic");
  assert.equal(first.plan.totals.units, 12);
});

test("the manifest validator rejects malformed rows", () => {
  const cases = [
    ["duplicate slug", (m) => m.products.push({ ...m.products[0], sku: "OTHER-1" })],
    ["duplicate sku", (m) => m.products.push({ ...m.products[0], slug: "other-slug" })],
    ["negative price", (m) => (m.products[0].price_aed = -1)],
    ["negative stock", (m) => (m.products[0].initial_stock = -5)],
    ["non-https image", (m) => (m.products[0].images = ["http://insecure.test/a.jpg"])],
    ["empty images", (m) => (m.products[0].images = [])],
    ["unknown category", (m) => (m.products[0].category = "missing")],
    ["missing english name", (m) => delete m.products[0].names.en],
    ["invalid sku", (m) => (m.products[0].sku = "bad sku!")],
    [
      "too many products",
      (m) => {
        for (let i = 0; i < 12; i += 1) {
          m.products.push({ ...m.products[0], slug: `p-${i}`, sku: `SKU-${i}` });
        }
      },
    ],
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

test("halal is never defaulted to true", () => {
  const result = validateActivationManifest(structuredClone(VALID_MANIFEST));
  assert.equal(result.plan.products[0].is_halal, false);
});

// --- activation sequence ---------------------------------------------------

test("the activation runbook enables checkout last and rolls it back first", async () => {
  const runbook = await read("docs/program/CM-COM-3A_ACTIVATION_RUNBOOK.md");
  const enable = runbook.indexOf("CORNERMEX_CHECKOUT_ENABLED=true");
  const migration = runbook.search(/apply the exact reviewed COD/i);
  const manifest = runbook.search(/approved 5–10 SKU manifest/i);
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
