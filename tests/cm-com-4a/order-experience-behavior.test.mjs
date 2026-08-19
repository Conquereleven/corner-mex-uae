import assert from "node:assert/strict";
import test from "node:test";

import { resolveLifecycleAudit } from "../../src/lib/order-detail-contract.ts";
import {
  getAdminOrderDetailRouteView,
  getCustomerOrderDetailView,
  getCustomerOrderHistoryView,
  getSellerOrderDetailExperience,
  loadOwnedOrderDetail,
  loadOwnedOrderHistory,
  presentCanonicalCustomerOrder,
} from "../../src/lib/order-experience-contract.ts";

const canonicalOrder = {
  id: "33333333-3333-3333-3333-333333333333",
  order_number: "CM-COD-0001",
  status: "confirmed",
  payment_method: "cod",
  payment_status: "pending",
  subtotal_aed: 100,
  shipping_aed: 20,
  tax_aed: 6,
  total_aed: 126,
  created_at: "2026-08-19T00:00:00.000Z",
  items: [
    {
      id: "item-1",
      product_name: "Salsa verde",
      qty: 2,
      line_total_aed: 100,
      fulfillment_status: "pending",
    },
  ],
};

test("customer history executes the buyer result path without seller-era fields", async () => {
  const rows = await loadOwnedOrderHistory(async () => ({ data: [canonicalOrder], error: null }));
  const view = getCustomerOrderHistoryView({ isLoading: false, isError: false, data: rows });
  assert.equal(view.kind, "orders");
  assert.equal(view.orders[0].order_number, "CM-COD-0001");
  assert.equal("seller_id" in view.orders[0], false);

  assert.deepEqual(presentCanonicalCustomerOrder(view.orders[0]), {
    orderNumber: "CM-COD-0001",
    orderStatus: "confirmed",
    paymentMethod: "COD",
    paymentStatus: "pending",
    subtotal: "100.00 AED",
    shipping: "20.00 AED",
    tax: "6.00 AED",
    total: "126.00 AED",
  });
});

test("empty history and backend history failure are executable distinct states", async () => {
  const empty = await loadOwnedOrderHistory(async () => ({ data: [], error: null }));
  assert.equal(
    getCustomerOrderHistoryView({ isLoading: false, isError: false, data: empty }).kind,
    "empty",
  );
  await assert.rejects(
    loadOwnedOrderHistory(async () => ({ data: null, error: new Error("private host") })),
    { message: "ACCOUNT_ORDER_HISTORY_QUERY_FAILED" },
  );
  const failed = getCustomerOrderHistoryView({ isLoading: false, isError: true, data: undefined });
  assert.equal(failed.kind, "query_failed");
  assert.equal(failed.retryable, true);
  assert.notEqual(failed.message, "You have no orders yet.");
});

test("owned detail succeeds and retains canonical item, status and total behavior", async () => {
  const order = await loadOwnedOrderDetail(async () => ({ data: canonicalOrder, error: null }));
  const view = getCustomerOrderDetailView({ isLoading: false, error: null, data: order });
  assert.equal(view.kind, "order");
  assert.equal(view.order.items[0].product_name, "Salsa verde");
  assert.equal(view.order.payment_status, "pending");
  assert.equal(presentCanonicalCustomerOrder(view.order).total, "126.00 AED");
});

test("foreign and absent detail are indistinguishable while query failure is separate", async () => {
  const foreign = () => loadOwnedOrderDetail(async () => ({ data: null, error: null }));
  const absent = () => loadOwnedOrderDetail(async () => ({ data: null, error: null }));
  await assert.rejects(foreign(), { message: "ACCOUNT_ORDER_NOT_FOUND" });
  await assert.rejects(absent(), { message: "ACCOUNT_ORDER_NOT_FOUND" });
  await assert.rejects(
    loadOwnedOrderDetail(async () => ({ data: null, error: new Error("db.internal secret") })),
    { message: "ACCOUNT_ORDER_DETAIL_QUERY_FAILED" },
  );
});

test("customer detail UX truthfully separates not-found from retryable query failure", () => {
  const notFound = getCustomerOrderDetailView({
    isLoading: false,
    error: new Error("ACCOUNT_ORDER_NOT_FOUND"),
    data: undefined,
  });
  const failed = getCustomerOrderDetailView({
    isLoading: false,
    error: new Error("ACCOUNT_ORDER_DETAIL_QUERY_FAILED"),
    data: undefined,
  });
  assert.equal(notFound.kind, "not_found");
  assert.match(notFound.message, /could not be found|not available/i);
  assert.equal(failed.kind, "query_failed");
  assert.match(failed.message, /temporarily unavailable|try again/i);
  assert.doesNotMatch(failed.message, /belong|not found|ACCOUNT_|SQL|schema|host|stack/i);
  assert.equal(failed.retryable, true);
});

test("seller experience executes seller-scoped controls without admin lifecycle authority", () => {
  const experience = getSellerOrderDetailExperience({
    items: [
      { id: "pending-item", fulfillment_status: "pending" },
      { id: "shipped-item", fulfillment_status: "shipped" },
    ],
    shipments: [{ id: "shipment-1" }],
    notes: [],
    events: [],
  });
  assert.equal(experience.fulfillmentProgress, true);
  assert.equal(experience.shipmentPresentation, true);
  assert.equal(experience.internalNotes, true);
  assert.equal(experience.adminLifecycleControls, false);
  assert.deepEqual(
    experience.itemControls[0].actions.map((action) => action.nextStatus),
    ["preparing", "cancelled"],
  );
  assert.deepEqual(
    experience.itemControls[1].actions.map((action) => action.nextStatus),
    ["delivered"],
  );
  assert.deepEqual(experience.mutationAuthority, {
    item: "setOrderItemStatus",
    note: "sellerAddOrderNote",
  });
});

test("admin zero-event audit remains ready while audit failure propagates", () => {
  const zeroEvents = resolveLifecycleAudit({ data: [], error: null });
  assert.deepEqual(zeroEvents, []);
  assert.equal(
    getAdminOrderDetailRouteView({
      isLoading: false,
      error: null,
      data: { order: canonicalOrder, events: zeroEvents },
    }),
    "ready",
  );

  let propagated;
  try {
    resolveLifecycleAudit({ data: null, error: new Error("database detail") });
  } catch (error) {
    propagated = error;
  }
  assert.equal(propagated?.message, "CM_COM_4A_AUDIT_QUERY_FAILED");
  assert.equal(
    getAdminOrderDetailRouteView({ isLoading: false, error: propagated, data: undefined }),
    "query_failed",
  );
});
