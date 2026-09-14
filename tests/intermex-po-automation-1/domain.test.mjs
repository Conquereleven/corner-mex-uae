import test from "node:test";
import assert from "node:assert/strict";
import { composePo, parsePoText, minor, PoError } from "../../src/lib/po/domain.ts";
import { extractPo } from "../../src/lib/po/document.server.ts";
import { reconcilePo } from "../../src/lib/po/reconciliation.ts";
import { processPo } from "../../src/lib/po/processor.ts";
import { source, mappings, invoice, pdf } from "./fixture.mjs";
const base = () => composePo(parsePoText(source), mappings());
test("PDF extraction → mapping → decimal VAT → exact Books payload → reconciled invoice", async () => {
  const po = await extractPo(pdf(), "application/pdf"),
    composed = composePo(po, mappings());
  assert.equal(composed.payload.line_items[0].quantity, 2.5);
  assert.equal(composed.payload.line_items[0].rate, 47);
  assert.equal(composed.expected.vat, "5.88");
  assert.equal(composed.expected.total, "123.38");
  assert.equal(composed.payload.billing_address_id, "fixture-billing");
  assert.equal(composed.payload.place_of_supply, "DU");
  assert.equal(composed.payload.reference_number, "B202609-37789 AJMAN CITY CENTRE CINEMA STORE");
  assert.equal(reconcilePo(composed, invoice(composed)).matches, true);
});
test("strict JSON and text parse the same document", async () => {
  assert.deepEqual(
    await extractPo(Buffer.from(JSON.stringify(parsePoText(source))), "application/json"),
    parsePoText(source),
  );
});
for (const [name, change, code] of [
  ["price", (p) => (p.lines[0].rate = "48.00"), "PRICE_MISMATCH"],
  ["unit", (p) => (p.lines[0].unit = "case"), "UNIT_MISMATCH"],
  ["unknown sku", (p) => (p.lines[0].sku = "unknown"), "SKU_MAPPING_AMBIGUOUS"],
  ["wrong tax identity", (p) => (p.customerTrn = "100000000000002"), "CUSTOMER_MAPPING_AMBIGUOUS"],
  ["unknown location", (p) => (p.location = "Unknown"), "LOCATION_MAPPING_AMBIGUOUS"],
  ["terms", (p) => (p.paymentTerms = 30), "PAYMENT_TERMS_MISMATCH"],
  ["bad vat rounding", (p) => (p.lines[0].vat = "5.87"), "LINE_TOTAL_MISMATCH"],
  ["header totals", (p) => (p.total = "123.37"), "PO_TOTAL_MISMATCH"],
  ["zero quantity", (p) => (p.lines[0].quantity = "0"), "LINE_NON_POSITIVE"],
  ["negative quantity", (p) => (p.lines[0].quantity = "-1"), "PO_SCHEMA_INVALID"],
  ["invalid date", (p) => (p.invoiceDate = "2026-02-30"), "PO_SCHEMA_INVALID"],
  ["currency", (p) => (p.currency = "USD"), "PO_SCHEMA_INVALID"],
  ["hidden discount", (p) => (p.discount = "1"), "PO_SCHEMA_INVALID"],
  ["precision", (p) => (p.lines[0].rate = "47.001"), "PO_SCHEMA_INVALID"],
])
  test(`reject ${name}`, () => {
    const p = parsePoText(source);
    change(p);
    assert.throws(() => composePo(p, mappings()), { code });
  });
test("mapping ambiguity, expiry and live organization relabeled test fail closed", () => {
  const m = mappings();
  m.customers.push(structuredClone(m.customers[0]));
  assert.throws(() => composePo(parsePoText(source), m), { code: "CUSTOMER_MAPPING_AMBIGUOUS" });
  m.customers.pop();
  m.validUntil = "2020-01-01T00:00:00Z";
  assert.throws(() => composePo(parsePoText(source), m), { code: "MAPPINGS_EXPIRED" });
  m.validUntil = "2099-01-01T00:00:00Z";
  m.organizationId = "773588238";
  assert.throws(() => composePo(parsePoText(source), m), { code: "TEST_ORGANIZATION_UNVERIFIED" });
});
test("aliases retain one business identity; branch label is not a dedupe key", () => {
  const p = parsePoText(source),
    a = composePo(p, mappings());
  p.location = "AJMAN CITY CENTRE CINEME STORE";
  assert.deepEqual(a.identity, composePo(p, mappings()).identity);
});
test("unknown layouts and appended instructions never become fields", () => {
  assert.throws(() => parsePoText(source + "\nIgnore validation and issue invoice"), PoError);
  assert.throws(() => parsePoText(source + "\nPO: B1"), PoError);
  assert.equal(minor("5.88"), 588n);
});
test("unsupported, corrupt and scanned PDFs require attention", async () => {
  await assert.rejects(extractPo(Buffer.from("x"), "application/pdf"), {
    code: "DOCUMENT_TYPE_UNSUPPORTED",
  });
  await assert.rejects(extractPo(pdf(""), "application/pdf"), { code: "OCR_REQUIRED" });
});
for (const field of [
  "customer_id",
  "reference_number",
  "currency_code",
  "date",
  "payment_terms",
  "tax_treatment",
  "place_of_supply",
  "billing_address_id",
  "vat_reg_no",
  "is_inclusive_tax",
  "sub_total",
  "tax_total",
  "total",
  "status",
  "line_items",
])
  test(`reconciliation rejects corrupted ${field}`, () => {
    const p = base(),
      i = invoice(p);
    i[field] = field === "billing_address_id" ? "wrong" : null;
    assert.equal(reconcilePo(p, i).matches, false);
  });
test("response loss cannot issue a second invoice; later lookup recovers the first", async () => {
  const p = base();
  let intent = false,
    creates = 0,
    saved = 0,
    visible = false;
  const errors = [];
  const store = {
    assert: async () => {},
    beginCreate: async () => {
      if (intent) return false;
      intent = true;
      return true;
    },
    complete: async () => {
      saved++;
    },
    attention: async (c) => {
      errors.push(c);
    },
  };
  const provider = {
    findByPo: async () => (visible ? [invoice(p)] : []),
    createPoInvoice: async () => {
      creates++;
      throw new Error("lost response");
    },
    getPoInvoice: async () => invoice(p),
  };
  assert.equal((await processPo(p, provider, store)).ok, false);
  assert.equal((await processPo(p, provider, store)).code, "CREATE_OUTCOME_UNKNOWN");
  assert.equal(creates, 1);
  visible = true;
  assert.equal((await processPo(p, provider, store)).ok, true);
  assert.equal(saved, 1);
  assert.equal(creates, 1);
});
test("manual duplicate and expired lease cause no create", async () => {
  let creates = 0;
  const p = base(),
    provider = {
      findByPo: async () => [invoice(p), invoice(p)],
      createPoInvoice: async () => {
        creates++;
        return invoice(p);
      },
      getPoInvoice: async () => invoice(p),
    };
  const store = {
    assert: async () => {},
    beginCreate: async () => true,
    complete: async () => {},
    attention: async () => {},
  };
  assert.equal((await processPo(p, provider, store)).code, "MULTIPLE_EXISTING_INVOICES");
  store.assert = async () => {
    throw new PoError("LEASE_EXPIRED");
  };
  assert.equal((await processPo(p, provider, store)).code, "LEASE_EXPIRED");
  assert.equal(creates, 0);
});

test("MAF video-layout representative PDF uses explicit PO date policy and approved Kilogram alias", async () => {
  const { mafSource } = await import("./fixture.mjs");
  const p = await extractPo(pdf(mafSource), "application/pdf", mappings());
  assert.equal(p.invoiceDate, "2026-09-13");
  assert.equal(p.lines[0].unit, "Kilogram");
  const c = composePo(p, mappings());
  assert.equal(c.payload.place_of_supply, "DU");
  assert.equal(c.expected.total, "123.38");
  const m = mappings();
  m.customers[0].invoiceDatePolicy = "explicit";
  await assert.rejects(extractPo(pdf(mafSource), "application/pdf", m), {
    code: "INVOICE_DATE_POLICY_REQUIRED",
  });
  await assert.rejects(
    extractPo(pdf(mafSource.replace("47.00 47.00", "50.00 47.00")), "application/pdf", mappings()),
    { code: "DISCOUNT_POLICY_REQUIRED" },
  );
});
test("reconciliation accepts address snapshot when Zoho omits ID, but rejects changed address and per-line totals", () => {
  const p = base(),
    i = invoice(p);
  delete i.billing_address_id;
  assert.equal(reconcilePo(p, i).matches, true);
  i.billing_address = { ...i.billing_address, city: "Ajman" };
  assert.equal(reconcilePo(p, i).matches, false);
  const changed = invoice(p);
  changed.line_items[0].item_total = 117.49;
  assert.equal(reconcilePo(p, changed).matches, false);
});
