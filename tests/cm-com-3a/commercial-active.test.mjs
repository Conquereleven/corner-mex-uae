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
  PreviewInput,
  acceptPreview,
  beginPreview,
  buildPreviewLines,
  hasCurrentPreview,
  previewInputKey,
  previewSubtotal,
  rejectPreview,
} from "../../src/lib/cod-preview.ts";
import {
  MANIFEST_LIMITS,
  validateActivationManifest,
} from "../../scripts/cm-com-3a/validate-activation-manifest.mjs";
import {
  ACTIVATION_MANIFEST_VERSION,
  FALLBACK_CATEGORY,
  categoryForProduct,
  normalizeCatalog,
  parseArgs,
  summarize,
  toActivationManifest,
} from "../../scripts/cm-com-3a/ingest-intermex-catalog.mjs";
import {
  DATABASE_URL_ENV,
  planLoad,
  renderPlanSql,
  parseArgs as parseLoaderArgs,
} from "../../scripts/cm-com-3a/load-activation-plan.mjs";

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

// --- preview money is server-authoritative --------------------------------

const trustedRow = (overrides = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  format_label: "450 g",
  price_aed: 25,
  is_active: true,
  product: { status: "active", translations: [{ lang: "en", name: "Contract Salsa" }] },
  ...overrides,
});

test("the preview input cannot carry any monetary value", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const good = PreviewInput.parse({ items: [{ variant_id: id, qty: 2 }], emirate: "DU" });
  assert.deepEqual(Object.keys(good).sort(), ["emirate", "items"]);
  assert.deepEqual(Object.keys(good.items[0]).sort(), ["qty", "variant_id"]);
  // Every field a tampered browser could use to assert money is rejected.
  for (const forged of [
    { subtotal_aed: 0.01 },
    { unit_price: 0.01 },
    { line_total: 0.01 },
    { shipping_aed: 0 },
    { tax_aed: 0 },
    { total_aed: 0.01 },
  ]) {
    assert.throws(
      () => PreviewInput.parse({ items: [{ variant_id: id, qty: 1 }], emirate: "DU", ...forged }),
      Object.keys(forged)[0],
    );
  }
  assert.throws(() =>
    PreviewInput.parse({
      items: [{ variant_id: id, qty: 1, unit_price_aed: 0.01 }],
      emirate: "DU",
    }),
  );
});

test("a tampered browser price cannot influence the preview", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const rows = new Map([[id, trustedRow({ price_aed: 25 })]]);
  // The browser claims AED 0.01; the database says AED 25.00.
  const lines = buildPreviewLines([{ variant_id: id, qty: 2 }], rows);
  assert.equal(lines[0].unit_price_aed, 25);
  assert.equal(lines[0].line_total_aed, 50);
  assert.equal(lines[0].product_name, "Contract Salsa");
  assert.equal(previewSubtotal(lines), 50);

  // A stale high cart price is equally powerless: the server price still wins.
  const cheaper = new Map([[id, trustedRow({ price_aed: "9.50" })]]);
  assert.equal(previewSubtotal(buildPreviewLines([{ variant_id: id, qty: 1 }], cheaper)), 9.5);
});

test("server-derived subtotal flows into shipping, VAT and total", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const { config } = evaluateCommercialConfig({ ...READY_ENV, CORNERMEX_VAT_RATE: "0.05" });
  const subtotal = previewSubtotal(
    buildPreviewLines([{ variant_id: id, qty: 4 }], new Map([[id, trustedRow({ price_aed: 25 })]])),
  );
  assert.equal(subtotal, 100);
  assert.deepEqual(computeOrderTotals(subtotal, config, "DU"), {
    subtotalAed: 100,
    shippingAed: 15,
    taxAed: 5,
    totalAed: 120,
  });
  assert.equal(computeOrderTotals(subtotal, config, "SH").shippingAed, 20);
});

test("the preview refuses variants it cannot trust", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const cases = [
    ["missing variant", new Map()],
    ["inactive variant", new Map([[id, trustedRow({ is_active: false })]])],
    [
      "non-active product",
      new Map([[id, trustedRow({ product: { status: "draft", translations: [] } })]]),
    ],
  ];
  for (const [name, rows] of cases) {
    assert.throws(
      () => buildPreviewLines([{ variant_id: id, qty: 1 }], rows),
      /COD_ORDER_VARIANT_UNAVAILABLE/,
      name,
    );
  }
});

test("checkout renders server money, not cart-local money", async () => {
  const source = stripJsComments(await read("src/routes/checkout.tsx"));
  assert.ok(!source.includes("cartTotals"), "cart totals must not drive checkout money");
  assert.ok(!source.includes("item.unitPrice"), "cart unit price must not be displayed");
  assert.match(source, /preview\.lines\.map/);
  assert.match(source, /line\.line_total_aed/);
  assert.match(source, /preview \? `AED \$\{preview\.subtotalAed/);
  // The preview request carries identities and the emirate only.
  const previewCall = source.indexOf("loadPreview({");
  const request = source.slice(previewCall, source.indexOf(").then(", previewCall));
  assert.match(request, /items: previewItems/);
  assert.match(
    source,
    /items\.map\(\(item\) => \(\{ variant_id: item\.variantId, qty: item\.qty \}\)\)/,
  );
  for (const forbidden of ["price", "subtotal", "total", "tax"]) {
    assert.ok(!request.includes(forbidden), `preview request must not send ${forbidden}`);
  }
});

test("checkout execution requires the successful preview for the exact current input", async () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const duKey = previewInputKey([{ variant_id: id, qty: 1 }], "DU");
  const shKey = previewInputKey([{ variant_id: id, qty: 1 }], "SH");
  const qtyKey = previewInputKey([{ variant_id: id, qty: 2 }], "DU");
  const value = { totalAed: 41.25 };

  assert.equal(hasCurrentPreview({ status: "idle" }, duKey), false);
  let state = beginPreview(duKey, 1);
  assert.equal(hasCurrentPreview(state, duKey), false, "loading must not execute");
  state = acceptPreview(state, duKey, 1, value);
  assert.equal(hasCurrentPreview(state, duKey), true);
  assert.equal(hasCurrentPreview(state, shKey), false, "emirate change invalidates immediately");
  assert.equal(hasCurrentPreview(state, qtyKey), false, "quantity change invalidates immediately");

  state = beginPreview(shKey, 2);
  state = rejectPreview(state, shKey, 2);
  assert.equal(hasCurrentPreview(state, shKey), false, "error must not execute");

  const source = stripJsComments(await read("src/routes/checkout.tsx"));
  assert.match(source, /hasCurrentPreview\(previewState, currentPreviewKey\)/);
  assert.match(source, /hasCurrentPreview\(previewState, submitKey\)/);
  assert.match(source, /submitKey !== currentPreviewKey/);
});

test("a stale preview response cannot replace the latest request", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const oldKey = previewInputKey([{ variant_id: id, qty: 1 }], "DU");
  const currentKey = previewInputKey([{ variant_id: id, qty: 1 }], "SH");
  let state = beginPreview(oldKey, 1);
  state = beginPreview(currentKey, 2);
  state = acceptPreview(state, currentKey, 2, { totalAed: 45 });
  const afterStaleSuccess = acceptPreview(state, oldKey, 1, { totalAed: 40 });
  const afterStaleError = rejectPreview(afterStaleSuccess, oldKey, 1);
  assert.deepEqual(afterStaleSuccess, state);
  assert.deepEqual(afterStaleError, state);
  assert.equal(hasCurrentPreview(state, currentKey), true);
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
  assert.match(source, /readyToOrder =[\s\S]{0,220}accepted &&[\s\S]{0,80}hasCurrentPreview/);
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
    /if \([\s\S]{0,100}submitting \|\|[\s\S]{0,100}!canExecute[\s\S]{0,180}\)\s+return;/,
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

test("the COD migration is recorded as active after canonical application", async () => {
  const contract = JSON.parse(await read("contracts/lovable-cloud-migration-ownership-v1.json"));
  assert.ok(
    !contract.pendingCanonicalMigrations.some((n) => n.includes("place_cod_order_v1")),
    "the COD migration must no longer be pending",
  );
  assert.ok(
    contract.activeCanonicalMigrations.some((n) => n.includes("place_cod_order_v1")),
    "the COD migration must be listed as active",
  );
});

test("the migration generates an order number and locks stock", async () => {
  const sql = await read("supabase/migrations/20260809010000_place_cod_order_v1.sql");
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
    await read("supabase/migrations/20260809010000_place_cod_order_v1.sql"),
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
  manifestVersion: "cm-com-3a-activation-manifest-v1",
  source: "https://source.example.test",
  source_price_observed_at: "2026-08-09T00:00:00.000Z",
  categories: [{ slug: "salsas", names: { en: "Salsas" } }],
  products: [
    {
      slug: "example-salsa",
      category: "salsas",
      names: { en: "Example Salsa" },
      description: "A salsa.",
      brand: "Example Brand",
      images: ["https://images.example.test/a.jpg"],
      source_product_id: "1",
      source_product_url: "https://source.example.test/products/example-salsa",
      source_handle: "example-salsa",
      source_product_title: "Example Salsa",
      source_availability: "AVAILABLE",
      variants: [
        {
          sku: "CM-EXAMPLESALSA-000011",
          source_variant_id: "11",
          source_sku: "EX-SALSA-450",
          format_label: "450 g",
          weight_grams: 450,
          source_availability: "AVAILABLE",
          source_regular_price_aed: 30,
          source_effective_price_aed: 25.5,
          price_aed: 25.5,
          initial_stock: 1,
          is_default: true,
        },
      ],
    },
  ],
};

const cloneWithProducts = (count) => {
  const manifest = structuredClone(VALID_MANIFEST);
  for (let i = 0; i < count; i += 1) {
    const product = structuredClone(manifest.products[0]);
    product.slug = `bulk-${i}`;
    product.source_product_id = `bulk-${i}`;
    product.source_product_url = `https://source.example.test/products/bulk-${i}`;
    product.source_handle = `bulk-${i}`;
    product.variants[0].sku = `CM-BULK-${i}`;
    product.variants[0].source_variant_id = `bulk-v-${i}`;
    product.variants[0].source_sku = null;
    manifest.products.push(product);
  }
  return manifest;
};

test("a well-formed manifest produces a deterministic plan", () => {
  const first = validateActivationManifest(structuredClone(VALID_MANIFEST));
  const second = validateActivationManifest(structuredClone(VALID_MANIFEST));
  assert.equal(first.valid, true, JSON.stringify(first.errors));
  assert.equal(first.plan.dryRun, true);
  assert.deepEqual(first.plan, second.plan, "the plan must be deterministic");
  assert.equal(first.plan.totals.units, 1);
  // The plan separates the A2 writes it describes.
  assert.deepEqual(first.plan.categories, [
    { slug: "salsas", name_en: "Salsas", is_active: true, sort_order: 0 },
  ]);
  assert.equal(first.plan.products[0].category_slug, "salsas");
  assert.equal(first.plan.products[0].status, "active");
  assert.deepEqual(first.plan.translations[0], {
    product_slug: "example-salsa",
    lang: "en",
    name: "Example Salsa",
    description: "A salsa.",
  });
  assert.equal(first.plan.images[0].product_slug, "example-salsa");
  const variant = first.plan.variants[0];
  assert.equal(variant.product_slug, "example-salsa", "variant must stay bound to its product");
  assert.equal(variant.price_aed, 25.5);
  assert.equal(variant.compare_at_price_aed, 30);
  assert.equal(variant.stock, 1);
  assert.equal(variant.source_variant_id, "11");
  assert.equal(variant.source_sku, "EX-SALSA-450");
  assert.deepEqual(first.plan.inventory[0], { sku: variant.sku, quantity_on_hand: 1 });
  // No marketplace concepts leak into the plan.
  assert.ok(!JSON.stringify(first.plan).includes("seller"));
});

test("the manifest validator rejects malformed rows", () => {
  const v = (m) => m.products[0].variants[0];
  const cases = [
    ["duplicate slug", (m) => m.products.push(structuredClone(m.products[0]))],
    ["negative price", (m) => (v(m).price_aed = -1)],
    [
      "marked-up price",
      (m) => {
        v(m).price_aed = 30;
      },
    ],
    ["negative stock", (m) => (v(m).initial_stock = -5)],
    ["invented stock above 1", (m) => (v(m).initial_stock = 12)],
    [
      "stock contradicting availability",
      (m) => {
        v(m).source_availability = "SOLD_OUT";
        v(m).initial_stock = 1;
      },
    ],
    ["non-https image", (m) => (m.products[0].images = ["http://insecure.test/a.jpg"])],
    ["empty images", (m) => (m.products[0].images = [])],
    ["unknown category", (m) => (m.products[0].category = "missing")],
    ["missing english name", (m) => delete m.products[0].names.en],
    ["invalid sku", (m) => (v(m).sku = "bad sku!")],
    ["missing source provenance", (m) => delete m.products[0].source_product_id],
    ["missing variant provenance", (m) => delete v(m).source_variant_id],
    ["source sku equal to the generated sku", (m) => (v(m).source_sku = v(m).sku)],
    ["no variants", (m) => (m.products[0].variants = [])],
    ["no default variant", (m) => (v(m).is_default = false)],
    ["unknown availability state", (m) => (v(m).source_availability = "MAYBE")],
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
  const result = validateActivationManifest(cloneWithProducts(250));
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

// --- end-to-end catalog pipeline ------------------------------------------

const SOURCE_FIXTURE = [
  {
    id: 1,
    handle: "salsa-verde",
    title: "Salsa Verde",
    vendor: "La Costena",
    product_type: "Salsas",
    body_html: "<p>x</p>",
    images: [{ src: "https://cdn.example.test/a.jpg" }, { src: "https://cdn.example.test/b.jpg" }],
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
        title: "900 g",
        price: "20.50",
        compare_at_price: null,
        available: false,
        grams: 900,
      },
    ],
  },
  {
    id: 2,
    handle: "untyped-item",
    title: "Untyped Item",
    vendor: "Other",
    product_type: "",
    images: [{ src: "https://cdn.example.test/c.jpg" }],
    variants: [
      { id: 21, sku: null, title: "Default Title", price: "9.00", available: true, grams: 0 },
    ],
  },
];

const pipeline = () => {
  const normalized = normalizeCatalog(structuredClone(SOURCE_FIXTURE), "2026-08-09T00:00:00.000Z");
  const manifest = toActivationManifest(normalized);
  const result = validateActivationManifest(manifest);
  return { normalized, manifest, result };
};

test("source -> normalized -> canonical manifest -> validator -> plan all agree", () => {
  const { manifest, result } = pipeline();
  assert.equal(manifest.manifestVersion, ACTIVATION_MANIFEST_VERSION);
  assert.equal(result.valid, true, JSON.stringify(result.errors));

  // Product identity and variant identity both survive the whole pipeline.
  const salsa = manifest.products.find((product) => product.slug === "salsa-verde");
  assert.equal(salsa.source_product_id, "1");
  assert.equal(salsa.source_product_url, "https://intermexuae.com/products/salsa-verde");
  assert.equal(salsa.source_handle, "salsa-verde");
  assert.equal(salsa.variants.length, 2, "variants must not collapse into the product");
  assert.deepEqual(
    salsa.variants.map((variant) => variant.source_variant_id),
    ["11", "12"],
  );
  // Source SKU provenance is preserved and kept separate from the generated one.
  assert.equal(salsa.variants[0].source_sku, "REAL-SKU");
  assert.equal(salsa.variants[1].source_sku, null);
  assert.match(salsa.variants[0].sku, /^CM-/);
  assert.notEqual(salsa.variants[0].sku, salsa.variants[0].source_sku);
  // Price mirror, availability and stock rule all survive.
  assert.equal(salsa.variants[0].price_aed, 12);
  assert.equal(salsa.variants[0].source_effective_price_aed, 12);
  assert.equal(salsa.variants[0].source_availability, "AVAILABLE");
  assert.equal(salsa.variants[0].initial_stock, 1);
  assert.equal(salsa.variants[1].source_availability, "SOLD_OUT");
  assert.equal(salsa.variants[1].initial_stock, 0);

  // The plan keeps every variant bound to its own product.
  const planVariants = result.plan.variants.filter((v) => v.product_slug === "salsa-verde");
  assert.equal(planVariants.length, 2);
  assert.equal(planVariants.filter((v) => v.is_default).length, 1);
  assert.equal(result.plan.totals.units, 2);
  assert.equal(result.plan.images.filter((i) => i.product_slug === "salsa-verde").length, 2);
});

test("categories are derived deterministically from observed source metadata", () => {
  const { manifest } = pipeline();
  assert.deepEqual(
    manifest.categories.map((category) => category.slug).sort(),
    ["salsas", FALLBACK_CATEGORY.slug].sort(),
  );
  assert.equal(manifest.products.find((p) => p.slug === "salsa-verde").category, "salsas");
  // Exactly one documented neutral fallback when the source states no type.
  assert.equal(
    manifest.products.find((p) => p.slug === "untyped-item").category,
    FALLBACK_CATEGORY.slug,
  );
  assert.deepEqual(categoryForProduct({ product_type: "Salsas" }), {
    slug: "salsas",
    name: "Salsas",
  });
  assert.deepEqual(
    categoryForProduct({ product_type: "Salsas" }),
    categoryForProduct({ product_type: "Salsas" }),
  );
  assert.deepEqual(categoryForProduct({}), { ...FALLBACK_CATEGORY });
});

test("the same source produces byte-identical manifest and plan", () => {
  const first = pipeline();
  const second = pipeline();
  assert.equal(JSON.stringify(first.manifest), JSON.stringify(second.manifest));
  assert.equal(JSON.stringify(first.result.plan), JSON.stringify(second.result.plan));
});

test("rows the storefront cannot sell are excluded with a stated reason", () => {
  const normalized = normalizeCatalog(
    [
      { id: 3, handle: "no-image", title: "No Image", images: [], variants: [] },
      {
        id: 4,
        handle: "no-price",
        title: "No Price",
        images: [{ src: "https://cdn.example.test/d.jpg" }],
        variants: [{ id: 41, sku: null, title: "Default Title", price: null, available: true }],
      },
    ],
    "2026-08-09T00:00:00.000Z",
  );
  const manifest = toActivationManifest(normalized);
  assert.equal(manifest.products.length, 0);
  assert.deepEqual(manifest.excluded.map((row) => row.source_handle).sort(), [
    "no-image",
    "no-price",
  ]);
  assert.ok(manifest.excluded.every((row) => row.reasons.length > 0));
});

test("the ingestion CLI parses its documented arguments", () => {
  assert.deepEqual(parseArgs(["--out", "a.json"]), { out: "a.json", raw: null, report: false });
  assert.deepEqual(parseArgs(["--out", "a.json", "--raw", "b.json", "--report"]), {
    out: "a.json",
    raw: "b.json",
    report: true,
  });
  assert.throws(() => parseArgs(["--out"]), /requires a file path/);
  assert.throws(() => parseArgs(["--nope"]), /unknown argument/);
});

test("--out writes a real manifest the validator accepts", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, readFile: readJson, rm } = await import("node:fs/promises");
  const os = await import("node:os");
  const dir = await mkdtemp(path.join(os.tmpdir(), "cm-com-3a-"));
  const out = path.join(dir, "nested", "manifest.json");
  try {
    // The CLI is exercised end to end, including the live public crawl, so the
    // documented --out semantics cannot drift from the implementation.
    await promisify(execFile)(
      process.execPath,
      [path.join(root, "scripts/cm-com-3a/ingest-intermex-catalog.mjs"), "--out", out],
      { cwd: root, timeout: 300_000 },
    );
    const manifest = JSON.parse(await readJson(out, "utf8"));
    const result = validateActivationManifest(manifest);
    assert.equal(result.valid, true, JSON.stringify(result.errors?.slice(0, 5)));
    assert.ok(result.plan.products.length > 0);
    assert.ok(result.plan.variants.length >= result.plan.products.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the loader refuses unvalidated input and defaults to not writing", async () => {
  assert.throws(() => planLoad({ products: [] }), /ACTIVATION_MANIFEST_INVALID/);
  const { plan, sql } = planLoad(structuredClone(VALID_MANIFEST));
  assert.equal(plan.dryRun, true);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /on conflict \(slug\) do update/);
  assert.match(sql, /insert into public\.product_variants/);
  assert.match(sql, /insert into public\.inventory /);
  assert.ok(!/do update set[^;]*stock\s*=\s*excluded\.stock/.test(sql));
  assert.match(sql, /on conflict \(variant_id\) do nothing/);
  assert.match(sql, /cm_com_3a/);
  assert.ok(!sql.includes("seller"), "the loader must not touch marketplace tables");

  const source = stripJsComments(await read("scripts/cm-com-3a/load-activation-plan.mjs"));
  // Writing requires BOTH an explicit flag and an operator-supplied database
  // URL; no connection string or credential is defaulted or embedded.
  assert.match(source, /options\.execute/);
  assert.match(source, /if \(!options\.execute\)/);
  assert.equal(DATABASE_URL_ENV, "CORNERMEX_ACTIVATION_DATABASE_URL");
  assert.ok(!/postgres(ql)?:\/\//.test(source), "no connection string may be embedded");
  assert.ok(!source.includes("supabase.co"), "no production host may be embedded");
  assert.deepEqual(parseLoaderArgs(["m.json"]), { manifest: "m.json", sql: null, execute: false });
  assert.throws(() => parseLoaderArgs([]), /manifest path is required/);
});

test("the generated SQL escapes source text rather than interpolating it", () => {
  const manifest = structuredClone(VALID_MANIFEST);
  manifest.products[0].names.en = "O'Brien's \"Salsa\"";
  const { sql } = planLoad(manifest);
  assert.match(sql, /'O''Brien''s "Salsa"'/);
});

// --- activation sequence ---------------------------------------------------

test("the activation runbook proves the catalog first and enables checkout last", async () => {
  const runbook = await read("docs/program/CM-COM-3A_ACTIVATION_RUNBOOK.md");
  const crawl = runbook.search(/Fresh Intermex public crawl/i);
  const validate = runbook.search(/Validate the canonical manifest/i);
  const plan = runbook.search(/Generate the deterministic activation plan/i);
  const migration = runbook.search(/apply the exact reviewed COD/i);
  const load = runbook.search(/Execute the exact reviewed loader/i);
  const deploy = runbook.search(/CHECKOUT_ENABLED` still false/i);
  const enable = runbook.indexOf("CORNERMEX_CHECKOUT_ENABLED=true");
  assert.ok(
    [crawl, validate, plan, migration, load, deploy, enable].every((index) => index > 0),
    "runbook steps must be present",
  );
  // Catalog validity is proved while the database is still untouched.
  assert.ok(crawl < validate, "the crawl must precede validation");
  assert.ok(validate < plan, "validation must precede plan generation");
  assert.ok(plan < migration, "the catalog plan must be proved before the migration");
  assert.ok(migration < load, "the migration must precede the catalog load");
  assert.ok(
    load < deploy && deploy < enable,
    "checkout must be enabled LAST, after the catalog is loaded and deployed",
  );
  assert.match(
    runbook,
    /CHECKOUT_ENABLED=false[\s\S]{0,160}first/i,
    "rollback must disable checkout first",
  );
  // The non-blocking confirmation-gate debt is recorded, not silently dropped.
  assert.match(runbook, /CM-COM-3A-P3-CONFIRMATION-GATE/);
});

test("the SQL contract test refuses to run against a remote database", async () => {
  const source = await read("scripts/cm-com-3a/test-cod-order-sql.mjs");
  assert.match(source, /COD_SQL_TEST_REFUSES_REMOTE_DATABASE/);
  assert.match(source, /supabase\\\.\(co\|com\)/);
});
