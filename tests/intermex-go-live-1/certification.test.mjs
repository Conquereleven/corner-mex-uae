/** Offline component certification. No network, real credentials, database or production writes. */
import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { verifyStripeWebhookEvent } from "../../src/lib/stripe-webhook-verification.ts";
import {
  transitionFromVerifiedStripeEvent,
  reconcilePaymentState,
} from "../../src/lib/payment-state.ts";
import {
  processOrderToInvoice,
  reconcileInvoice,
  validateCanonicalInvoice,
} from "../../src/lib/accounting-integration.ts";
import { evaluateZohoActivation } from "../../src/lib/zoho-accounting.server.ts";
import { assertCheckoutExecutionEnabled } from "../../src/lib/checkout-execution.server.ts";

const orderFixture = () => ({
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "CM-OFFLINE-1",
  orderStatus: "confirmed",
  paymentStatus: "pending",
  paymentProvider: "stripe",
  paymentReference: "cs_test_offline",
  paymentPaidAt: "2026-09-12T00:00:00Z",
  customer: {
    localId: "buyer-offline",
    displayName: "Offline fixture",
    email: ["fixture", "example.invalid"].join("@"),
  },
  lines: [
    { localId: "line-1", name: "Offline product", quantity: 2, unitPriceAed: 20, lineTotalAed: 40 },
  ],
  subtotalAed: 40,
  shippingAed: 0,
  discountAed: 0,
  taxAed: 2,
  totalAed: 42,
  currency: "AED",
  createdAt: "2026-09-12T00:00:00Z",
});

test("TEST 1 offline: valid canonical fixture, disabled execution, no provider effects", () => {
  assert.doesNotThrow(() => validateCanonicalInvoice(orderFixture()));
  assert.throws(() => assertCheckoutExecutionEnabled("false"), /CHECKOUT_EXECUTION_DISABLED/);
  assert.equal(evaluateZohoActivation({}).ready, false);
});

test("TEST 2 + 3 offline: real signature verifier → payment policy → invoice reconciliation; replay creates once", async () => {
  const stripe = new Stripe("sk_webhook_verification_only");
  const secret = "offline-fixture-signing-key";
  const order = orderFixture();
  const body = JSON.stringify({
    id: "evt_offline_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: order.paymentReference,
        payment_status: "paid",
        amount_total: 4200,
        currency: "aed",
      },
    },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const constructEvent = (raw, sig, key) => stripe.webhooks.constructEvent(raw, sig, key);
  assert.equal(
    verifyStripeWebhookEvent({
      rawBody: body + " ",
      signature,
      webhookSecret: secret,
      constructEvent,
    }).ok,
    false,
  );
  const verified = verifyStripeWebhookEvent({
    rawBody: body,
    signature,
    webhookSecret: secret,
    constructEvent,
  });
  assert.equal(verified.ok, true);
  const projection = {
    type: verified.event.type,
    checkoutPaymentStatus: verified.event.data.object.payment_status,
    amountAed: verified.event.data.object.amount_total / 100,
  };
  order.paymentStatus = transitionFromVerifiedStripeEvent(order.paymentStatus, projection).next;
  assert.equal(transitionFromVerifiedStripeEvent(order.paymentStatus, projection), null);
  assert.equal(
    transitionFromVerifiedStripeEvent(order.paymentStatus, {
      type: "checkout.session.async_payment_failed",
      amountAed: 42,
    }),
    null,
  );
  assert.deepEqual(
    reconcilePaymentState({
      orderPaymentStatus: order.paymentStatus,
      orderTotalAed: 42,
      paymentMethod: "card",
      attempts: [
        {
          provider: "stripe",
          providerReference: order.paymentReference,
          status: "paid",
          amountAed: 42,
        },
      ],
    }),
    [],
  );
  const mappings = new Map();
  const invoices = [];
  const payments = [];
  let creates = 0;
  const store = {
    async getMapping(t, id) {
      return mappings.get(`${t}:${id}`) ?? null;
    },
    async saveMapping(m) {
      mappings.set(`${m.entityType}:${m.localEntityId}`, m);
    },
    async audit() {},
  };
  const provider = {
    product: "books",
    async findCustomer() {
      return [{ id: "customer-offline" }];
    },
    async createCustomer() {
      throw Error("unexpected customer create");
    },
    async findInvoiceByReference() {
      return invoices;
    },
    async createInvoice(input) {
      creates++;
      const invoice = {
        id: "invoice-offline",
        referenceNumber: input.orderNumber,
        currency: "AED",
        number: "INV-OFFLINE",
        status: "draft",
        url: "https://example.invalid/invoice",
        pdfSupported: true,
        totalAed: input.totalAed,
      };
      invoices.push(invoice);
      return invoice;
    },
    async updateInvoice() {
      return invoices[0];
    },
    async getInvoice() {
      return invoices[0];
    },
    async findPaymentByReference() {
      return payments;
    },
    async recordPayment() {
      const p = { id: "payment-offline", status: "paid" };
      payments.push(p);
      return p;
    },
  };
  for (let i = 0; i < 2; i++)
    await processOrderToInvoice({ correlationId: `offline-${i}`, order, provider, store });
  assert.equal(creates, 1);
  assert.equal(payments.length, 1);
  assert.deepEqual(reconcileInvoice(order, invoices[0]), { matches: true, reasons: [] });
  assert.equal(mappings.get(`invoice:${order.orderId}`).externalId, "invoice-offline");
  assert.equal(order.paymentStatus, "paid");
  // This does not prove route execution, durable jobs, account UI, or a provider sandbox.
});
