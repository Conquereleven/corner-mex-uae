// Founder decision 2026-09-19: RodMor TradeCo LLC is the CornerMex seller of
// record; Intermex Pro General Trading LLC is a supplier only. New CornerMex
// customer invoices must never be issued in the supplier's Zoho organization.
import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPLIER_ORGANIZATION_FORBIDDEN,
  ZohoAccountingProvider,
  evaluateZohoActivation,
  isSupplierZohoOrganization,
} from "../../src/lib/zoho-accounting.server.ts";
import { SUPPLIER_ENTITIES } from "../../src/lib/business-identity.ts";

const INTERMEX_ORG = SUPPLIER_ENTITIES.find((e) => /Intermex/.test(e.name)).zohoOrganizationId;

const baseConfig = {
  product: "books",
  apiBaseUrl: "https://offline.invalid",
  accessToken: "offline-token",
  vatTaxId: "offline-vat",
};

function providerFor(organizationId, calls) {
  return new ZohoAccountingProvider({ ...baseConfig, organizationId }, async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(JSON.stringify({ code: 0, contacts: [], invoices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

const customer = { localId: "c1", displayName: "Buyer", email: "buyer@example.invalid" };
const invoice = {
  orderId: "o1",
  orderNumber: "CM-1",
  issuedDate: "2026-09-19",
  lines: [],
  shippingAed: 0,
  taxAed: 0,
  totalAed: 0,
};

test("the recorded Intermex organization is classified as a supplier organization", () => {
  assert.equal(INTERMEX_ORG, "773588238");
  assert.equal(isSupplierZohoOrganization("773588238"), true);
  assert.equal(isSupplierZohoOrganization(" 773588238 "), true);
  assert.equal(isSupplierZohoOrganization("some-rodmor-org"), false);
  assert.equal(isSupplierZohoOrganization(undefined), false);
});

test("activation readiness refuses a supplier organization even with everything else set", () => {
  const state = evaluateZohoActivation({
    CORNERMEX_ZOHO_LIVE_WRITES_ENABLED: "true",
    CORNERMEX_ZOHO_PRODUCT: "books",
    CORNERMEX_ZOHO_ORGANIZATION_ID: INTERMEX_ORG,
    CORNERMEX_ZOHO_API_BASE_URL: "https://offline.invalid",
    CORNERMEX_ZOHO_ACCESS_TOKEN: "t",
    CORNERMEX_ZOHO_VAT_TAX_ID: "v",
  });
  assert.equal(state.ready, false);
  assert.ok(state.reasons.includes("organization_is_supplier_entity"), state.reasons.join(","));
});

for (const [name, run] of [
  ["createCustomer", (p) => p.createCustomer(customer)],
  ["createInvoice", (p) => p.createInvoice(invoice, "ext-customer")],
  ["updateInvoice", (p) => p.updateInvoice("ext-invoice", invoice, "ext-customer")],
  [
    "recordPayment",
    (p) =>
      p.recordPayment({
        invoiceId: "i",
        customerId: "c",
        amountAed: 1,
        provider: "stripe",
        providerReference: "pi_x",
        paidOn: "2026-09-19",
      }),
  ],
]) {
  test(`${name} into the supplier organization is refused before any network call`, async () => {
    const calls = [];
    await assert.rejects(run(providerFor(INTERMEX_ORG, calls)), (error) => {
      assert.equal(error.message, SUPPLIER_ORGANIZATION_FORBIDDEN);
      assert.equal(error.category, "mapping_error");
      assert.equal(error.retryable, false);
      return true;
    });
    assert.deepEqual(calls, [], "no request may reach Zoho");
  });
}

test("read-only lookups against a supplier organization remain possible", async () => {
  const calls = [];
  await providerFor(INTERMEX_ORG, calls).findInvoiceByReference("CM-1");
  assert.ok(calls.length > 0);
  assert.ok(calls.every((c) => c.method === "GET"));
});
