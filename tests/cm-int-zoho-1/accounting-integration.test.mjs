import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  AccountingIntegrationError,
  processOrderToInvoice,
  reconcileInvoice,
  retryDelayMs,
  validateCanonicalInvoice,
} from "../../src/lib/accounting-integration.ts";
import {
  ZohoAccountingProvider,
  evaluateZohoActivation,
} from "../../src/lib/zoho-accounting.server.ts";

const order = (overrides = {}) => ({
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "CM-1001",
  orderStatus: "confirmed",
  paymentStatus: "pending",
  paymentProvider: null,
  paymentReference: null,
  customer: {
    localId: "22222222-2222-4222-8222-222222222222",
    displayName: "Test Customer",
    email: "customer@example.invalid",
  },
  lines: [
    { localId: "line-1", name: "Tortillas", quantity: 3, unitPriceAed: 10.01, lineTotalAed: 30.03 },
    { localId: "line-2", name: "Salsa", quantity: 1, unitPriceAed: 19.97, lineTotalAed: 19.97 },
  ],
  subtotalAed: 50,
  shippingAed: 10,
  discountAed: 5,
  taxAed: 2.75,
  totalAed: 57.75,
  currency: "AED",
  createdAt: "2026-08-28T12:00:00.000Z",
  ...overrides,
});

class MemoryStore {
  mappings = new Map();
  audits = [];
  async getMapping(type, local) {
    return this.mappings.get(`${type}:${local}`) ?? null;
  }
  async saveMapping(mapping) {
    this.mappings.set(`${mapping.entityType}:${mapping.localEntityId}`, mapping);
  }
  async audit(event) {
    this.audits.push(event);
  }
}

class FakeProvider {
  product = "books";
  customers = [];
  invoices = [];
  payments = [];
  createCustomerCalls = 0;
  createInvoiceCalls = 0;
  updateInvoiceCalls = 0;
  recordPaymentCalls = 0;
  async findCustomer() {
    return this.customers;
  }
  async createCustomer() {
    this.createCustomerCalls += 1;
    const customer = { id: `customer-${this.createCustomerCalls}` };
    this.customers = [customer];
    return customer;
  }
  async findInvoiceByReference(reference) {
    return this.invoices.filter((x) => x.reference === reference);
  }
  async createInvoice(input) {
    this.createInvoiceCalls += 1;
    const invoice = {
      id: `invoice-${this.createInvoiceCalls}`,
      number: `INV-${this.createInvoiceCalls}`,
      status: "draft",
      url: "https://example.invalid/invoice",
      pdfSupported: true,
      totalAed: input.totalAed,
      reference: input.orderNumber,
    };
    this.invoices.push(invoice);
    return invoice;
  }
  async updateInvoice(id, input) {
    this.updateInvoiceCalls += 1;
    return { ...this.invoices.find((x) => x.id === id), id, totalAed: input.totalAed };
  }
  async recordPayment() {
    this.recordPaymentCalls += 1;
    const payment = { id: `payment-${this.recordPaymentCalls}`, status: "paid" };
    this.payments.push(payment);
    return payment;
  }
  async getInvoice(id) {
    return this.invoices.find((x) => x.id === id);
  }
}

test("duplicate event does not duplicate customer, invoice or payment", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  const paid = order({
    paymentStatus: "paid",
    paymentProvider: "stripe",
    paymentReference: "pi_1",
  });
  await processOrderToInvoice({ correlationId: "c1", order: paid, provider, store });
  await processOrderToInvoice({ correlationId: "c2", order: paid, provider, store });
  assert.equal(provider.createCustomerCalls, 1);
  assert.equal(provider.createInvoiceCalls, 1);
  assert.equal(provider.recordPaymentCalls, 1);
  assert.equal(provider.updateInvoiceCalls, 1);
});

test("timeout then retry recovers provider invoice by canonical reference", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  provider.createInvoice = async function (input) {
    this.createInvoiceCalls += 1;
    this.invoices.push({
      id: "invoice-accepted-before-timeout",
      number: "INV-1",
      status: "draft",
      url: null,
      pdfSupported: true,
      totalAed: input.totalAed,
      reference: input.orderNumber,
    });
    throw new Error("network timeout");
  };
  await assert.rejects(
    processOrderToInvoice({ correlationId: "timeout", order: order(), provider, store }),
    /ACCOUNTING_PROVIDER_UNAVAILABLE/,
  );
  const result = await processOrderToInvoice({
    correlationId: "retry",
    order: order(),
    provider,
    store,
  });
  assert.equal(result.invoice.id, "invoice-accepted-before-timeout");
  assert.equal(provider.createInvoiceCalls, 1);
});

test("rate limit remains retryable and honors bounded backoff", () => {
  const error = new AccountingIntegrationError("rate_limit", true, "ZOHO_RATE_LIMITED", {
    retryAfterMs: 125_000,
  });
  assert.equal(error.category, "rate_limit");
  assert.equal(error.retryable, true);
  assert.equal(retryDelayMs(1, error.retryAfterMs), 125_000);
  assert.equal(retryDelayMs(99), 1_800_000);
});

test("official Zoho HTTP 429 is classified as retryable rate limit", async () => {
  const provider = new ZohoAccountingProvider(
    {
      product: "books",
      organizationId: "org-test",
      apiBaseUrl: "https://example.invalid",
      accessToken: "secret-test-token",
      vatTaxId: "tax-test",
    },
    async () =>
      new Response(JSON.stringify({ code: 44 }), {
        status: 429,
        headers: { "retry-after": "120" },
      }),
  );
  await assert.rejects(
    provider.findInvoiceByReference("CM-1001"),
    (error) => error.category === "rate_limit" && error.retryable && error.retryAfterMs === 120_000,
  );
});

test("credentials and flags cannot override repository activation gate", () => {
  const state = evaluateZohoActivation({
    CORNERMEX_ZOHO_LIVE_WRITES_ENABLED: "true",
    CORNERMEX_ZOHO_PRODUCT: "books",
    CORNERMEX_ZOHO_ORGANIZATION_ID: "org-test",
    CORNERMEX_ZOHO_API_BASE_URL: "https://example.invalid",
    CORNERMEX_ZOHO_ACCESS_TOKEN: "secret-test-token",
    CORNERMEX_ZOHO_VAT_TAX_ID: "tax-test",
  });
  assert.equal(state.ready, false);
  assert.ok(state.reasons.includes("repository_activation_not_authorized"));
});

test("missing tax data fails closed before provider writes", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  await assert.rejects(
    processOrderToInvoice({
      correlationId: "tax",
      order: order({ taxAed: null }),
      provider,
      store,
    }),
    /ACCOUNTING_TAX_DATA_REQUIRED/,
  );
  assert.equal(provider.createCustomerCalls, 0);
  assert.equal(provider.createInvoiceCalls, 0);
});

test("existing mapped customer is reused", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  await store.saveMapping({
    entityType: "customer",
    localEntityId: order().customer.localId,
    externalId: "existing",
  });
  await processOrderToInvoice({ correlationId: "mapped", order: order(), provider, store });
  assert.equal(provider.createCustomerCalls, 0);
});

test("provider conflicts require attention instead of choosing an invoice", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  provider.invoices = [
    { id: "a", reference: "CM-1001", totalAed: 57.75 },
    { id: "b", reference: "CM-1001", totalAed: 57.75 },
  ];
  await assert.rejects(
    processOrderToInvoice({ correlationId: "conflict", order: order(), provider, store }),
    (error) => error.category === "conflict" && !error.retryable,
  );
});

test("payment before or after invoice never changes canonical payment authority", async () => {
  const provider = new FakeProvider();
  const store = new MemoryStore();
  const pending = order();
  await processOrderToInvoice({ correlationId: "before", order: pending, provider, store });
  assert.equal(provider.recordPaymentCalls, 0);
  const paid = order({
    paymentStatus: "paid",
    paymentProvider: "stripe",
    paymentReference: "pi_after",
  });
  await processOrderToInvoice({ correlationId: "after", order: paid, provider, store });
  assert.equal(provider.recordPaymentCalls, 1);
  assert.equal(paid.paymentStatus, "paid");
});

test("AED rounding and line totals use integer-cent equality", () => {
  assert.doesNotThrow(() => validateCanonicalInvoice(order()));
  assert.throws(
    () =>
      validateCanonicalInvoice(
        order({
          lines: [
            { localId: "bad", name: "Bad", quantity: 3, unitPriceAed: 10.01, lineTotalAed: 30.04 },
          ],
        }),
      ),
    /ACCOUNTING_LINE_TOTAL_INVALID/,
  );
});

test("reconciliation reports total drift", () => {
  assert.deepEqual(
    reconcileInvoice(order(), {
      id: "z",
      number: "INV",
      status: "sent",
      url: null,
      pdfSupported: true,
      totalAed: 58,
    }),
    { matches: false, reasons: ["total_mismatch"] },
  );
});

test("server-only secrets and structured logs cannot leak credentials or PII", async () => {
  const [provider, migration, route] = await Promise.all([
    readFile("src/lib/zoho-accounting.server.ts", "utf8"),
    readFile(
      "supabase/migrations/20260828170741_cm_int_zoho_1_zero_touch_order_invoice.sql",
      "utf8",
    ),
    readFile("src/routes/_authenticated/admin.integrations.tsx", "utf8"),
  ]);
  assert.doesNotMatch(provider, /VITE_.*ZOHO|console\.(log|warn|error).*accessToken/i);
  assert.doesNotMatch(route, /ACCESS_TOKEN|ORGANIZATION_ID|VAT_TAX_ID/);
  assert.match(provider, /ZOHO_LIVE_ACTIVATION_AUTHORIZED = false/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /unique \(provider, entity_type, local_entity_id\)/);
  assert.match(migration, /correlation_id/);
});
