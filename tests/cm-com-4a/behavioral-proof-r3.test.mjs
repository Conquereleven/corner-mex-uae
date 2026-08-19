import assert from "node:assert/strict";
import { after, test } from "node:test";

import reactPlugin from "@vitejs/plugin-react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import {
  getAdminOrderDetailRouteView,
  getCustomerOrderDetailView,
  getCustomerOrderHistoryView,
} from "../../src/lib/order-experience-contract.ts";

const vite = await createServer({
  configFile: false,
  plugins: [reactPlugin(), tsconfigPaths()],
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true },
});

after(() => vite.close());

const accountModule = await vite.ssrLoadModule("/src/routes/_authenticated/account.index.tsx");
const detailModule = await vite.ssrLoadModule("/src/routes/_authenticated/account.orders.$id.tsx");
const behaviorModule = await vite.ssrLoadModule(
  "/src/components/site/OrderExperienceBehaviorSurfaces.tsx",
);
const accountHandlers = await vite.ssrLoadModule("/src/lib/account.functions.ts");
const adminHandlers = await vite.ssrLoadModule("/src/lib/admin.functions.ts");
const sellerHandlers = await vite.ssrLoadModule("/src/lib/seller.functions.ts");
const adminRoute = await vite.ssrLoadModule("/src/routes/_authenticated/admin.orders.$id.tsx");

const canonicalOrder = {
  id: "33333333-3333-4333-8333-333333333333",
  order_number: "CM-COD-0001",
  created_at: "2026-08-19T00:00:00.000Z",
  status: "confirmed",
  payment_method: "cod",
  payment_status: "pending",
  subtotal_aed: 100,
  shipping_aed: 20,
  tax_aed: 6,
  total_aed: 126,
  shipping_address: { recipient_name: "Customer", area: "Marina", emirate: "Dubai" },
  items: [
    {
      id: "item-1",
      product_name: "Salsa verde",
      variant_label: "250 g",
      qty: 2,
      line_total_aed: 100,
      fulfillment_status: "pending",
    },
  ],
};

function html(Component, props) {
  return renderToStaticMarkup(React.createElement(Component, props));
}

function findElement(node, predicate, seen = new Set()) {
  if (node == null || typeof node === "boolean" || typeof node === "string") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate, seen);
      if (match) return match;
    }
    return null;
  }
  if (typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  if (node.props && predicate(node)) return node;
  for (const value of Object.values(node.props ?? {})) {
    const match = findElement(value, predicate, seen);
    if (match) return match;
  }
  return null;
}

function queryClient(response, observed) {
  const builder = {
    select() {
      return this;
    },
    eq(column, value) {
      observed.push([column, value]);
      return this;
    },
    order() {
      return Promise.resolve(response);
    },
    maybeSingle() {
      return Promise.resolve(response);
    },
  };
  return { from: () => builder };
}

test("customer history mounts canonical content, empty state, failure state and retry", () => {
  const ordersView = getCustomerOrderHistoryView({
    isLoading: false,
    isError: false,
    data: [canonicalOrder],
  });
  const rendered = html(accountModule.CustomerOrderHistorySurface, {
    view: ordersView,
    onRetry() {},
    renderOrderLink: () => React.createElement("span", null, "View order"),
  });
  for (const value of [
    "CM-COD-0001",
    new Date(canonicalOrder.created_at).toLocaleString(),
    "confirmed",
    "COD",
    "pending",
    "100.00 AED",
    "20.00 AED",
    "6.00 AED",
    "126.00 AED",
  ]) {
    assert.ok(rendered.includes(value), `history must render ${value}`);
  }
  assert.equal(rendered.includes("seller_id"), false);

  const empty = html(accountModule.CustomerOrderHistorySurface, {
    view: getCustomerOrderHistoryView({ isLoading: false, isError: false, data: [] }),
    onRetry() {},
    renderShopLink: () => React.createElement("span", null, "Start shopping"),
  });
  assert.match(empty, /You have no orders yet/);

  let retries = 0;
  const failedView = getCustomerOrderHistoryView({
    isLoading: false,
    isError: true,
    data: undefined,
  });
  const failed = html(accountModule.CustomerOrderHistorySurface, {
    view: failedView,
    onRetry: () => retries++,
  });
  assert.match(failed, /We couldn&#x27;t load your orders/);
  assert.doesNotMatch(failed, /You have no orders yet/);
  const tree = accountModule.CustomerOrderHistorySurface({
    view: failedView,
    onRetry: () => retries++,
  });
  findElement(
    tree,
    (element) => element.props["data-testid"] === "customer-history-retry",
  ).props.onClick();
  assert.equal(retries, 1);
});

test("customer history handler derives the buyer filter from server context input", async () => {
  const observed = [];
  const rows = await accountHandlers.executeGetMyOrders(
    "authenticated-buyer",
    queryClient({ data: [canonicalOrder], error: null }, observed),
  );
  assert.equal(rows[0].order_number, "CM-COD-0001");
  assert.deepEqual(observed, [["buyer_id", "authenticated-buyer"]]);
});

test("customer detail handler preserves own, foreign, absent and backend outcomes", async () => {
  for (const [response, expected] of [
    [{ data: null, error: null }, "ACCOUNT_ORDER_NOT_FOUND"],
    [{ data: null, error: null }, "ACCOUNT_ORDER_NOT_FOUND"],
    [
      { data: null, error: new Error("database.internal host") },
      "ACCOUNT_ORDER_DETAIL_QUERY_FAILED",
    ],
  ]) {
    const observed = [];
    await assert.rejects(
      accountHandlers.executeGetMyOrderDetail(
        canonicalOrder.id,
        "authenticated-buyer",
        queryClient(response, observed),
      ),
      { message: expected },
    );
    assert.deepEqual(observed, [
      ["id", canonicalOrder.id],
      ["buyer_id", "authenticated-buyer"],
    ]);
  }

  const own = await accountHandlers.executeGetMyOrderDetail(
    canonicalOrder.id,
    "authenticated-buyer",
    queryClient({ data: canonicalOrder, error: null }, []),
  );
  assert.equal(own, canonicalOrder);
});

test("customer detail mounts canonical fields and distinct safe retryable failures", () => {
  const rendered = html(detailModule.CustomerOrderDetailSurface, {
    view: getCustomerOrderDetailView({ isLoading: false, error: null, data: canonicalOrder }),
    onRetry() {},
  });
  for (const value of [
    "CM-COD-0001",
    new Date(canonicalOrder.created_at).toLocaleString(),
    "confirmed",
    "COD",
    "pending",
    "Salsa verde",
    "Qty 2",
    "100.00 AED",
    "20.00 AED",
    "6.00 AED",
    "126.00 AED",
  ]) {
    assert.ok(rendered.includes(value), `detail must render ${value}`);
  }

  for (const [code, state, expected, rejected] of [
    ["ACCOUNT_ORDER_NOT_FOUND", "not_found", /Order unavailable/, /temporarily unavailable/],
    [
      "ACCOUNT_ORDER_DETAIL_QUERY_FAILED",
      "query_failed",
      /temporarily unavailable/,
      /does not belong|database\.internal|ACCOUNT_/,
    ],
  ]) {
    let retries = 0;
    const view = getCustomerOrderDetailView({
      isLoading: false,
      error: new Error(code),
      data: undefined,
    });
    const output = html(detailModule.CustomerOrderDetailSurface, {
      view,
      onRetry: () => retries++,
    });
    assert.match(output, expected);
    assert.doesNotMatch(output, rejected);
    assert.match(output, new RegExp(`data-state="${state}"`));
    const tree = detailModule.CustomerOrderDetailSurface({ view, onRetry: () => retries++ });
    findElement(
      tree,
      (element) => element.props["data-testid"] === "customer-detail-retry",
    ).props.onClick();
    assert.equal(retries, 1);
  }
});

test("seller components mount fulfillment, controls, shipment and internal notes", () => {
  const fulfillment = html(behaviorModule.FulfillmentTimeline, {
    status: "preparing",
    shipments: [],
  });
  assert.match(fulfillment, /pending/);
  assert.match(fulfillment, /preparing/);
  assert.match(fulfillment, /shipped/);
  assert.match(fulfillment, /delivered/);

  const controls = html(behaviorModule.SellerItemControls, {
    item: { id: "item-1", fulfillment_status: "pending" },
    onSelect() {},
  });
  assert.match(controls, /Start preparing/);
  assert.match(controls, /Cancel item/);
  assert.doesNotMatch(controls, /Controlled lifecycle|admin_transition_order_lifecycle_v1/);

  const shipment = html(behaviorModule.SellerShipmentPresentation, {
    shipments: [
      { id: "shipment-1", carrier: "DHL", tracking_number: "TRACK-1", status: "shipped" },
    ],
  });
  assert.match(shipment, /Shipments/);
  assert.match(shipment, /DHL/);
  assert.match(shipment, /TRACK-1/);

  const notes = html(behaviorModule.SellerInternalNotes, {
    notes: [
      {
        id: "note-1",
        author_role: "seller",
        body: "Packed carefully",
        created_at: canonicalOrder.created_at,
      },
    ],
    events: [],
    noteText: "Ready for courier",
    notePending: false,
    onNoteTextChange() {},
    onAddNote() {},
  });
  assert.match(notes, /seller note/);
  assert.match(notes, /Packed carefully/);
  assert.match(notes, /Add note/);
});

test("seller component actions invoke seller-scoped behavior and never the admin RPC", async () => {
  const selected = [];
  const controls = behaviorModule.SellerItemControls({
    item: { id: "item-1", fulfillment_status: "pending" },
    onSelect: (status) => selected.push(status),
  });
  findElement(
    controls,
    (element) => element.props["data-testid"] === "seller-item-preparing",
  ).props.onClick();
  assert.deepEqual(selected, ["preparing"]);

  const calls = [];
  const result = await sellerHandlers.executeSellerItemStatus(
    { itemId: "item-1", status: selected[0] },
    {
      rpc: async (name, args) => {
        calls.push([name, args]);
        return { error: null };
      },
    },
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    ["seller_update_order_item_fulfillment", { p_item_id: "item-1", p_status: "preparing" }],
  ]);
  assert.notEqual(calls[0][0], "admin_transition_order_lifecycle_v1");

  const noteWrites = [];
  const sellerLookups = [];
  const client = {
    from(table) {
      if (table === "order_items") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          limit: async () => ({ data: [{ id: "item-1" }] }),
        };
        return chain;
      }
      return {
        insert: async (payload) => {
          noteWrites.push([table, payload]);
          return { error: null };
        },
      };
    },
  };
  let notePromise;
  const notes = behaviorModule.SellerInternalNotes({
    notes: [],
    events: [],
    noteText: "Ready",
    notePending: false,
    onNoteTextChange() {},
    onAddNote: () => {
      notePromise = sellerHandlers.executeSellerAddOrderNote(
        { orderId: canonicalOrder.id, body: "Ready" },
        "seller-user-1",
        async (userId) => {
          sellerLookups.push(userId);
          return { id: "seller-1" };
        },
        client,
      );
    },
  });
  findElement(
    notes,
    (element) => element.props["data-testid"] === "seller-add-note",
  ).props.onClick();
  assert.deepEqual(await notePromise, { ok: true });
  assert.deepEqual(sellerLookups, ["seller-user-1"]);
  assert.deepEqual(noteWrites, [
    [
      "order_notes",
      {
        order_id: canonicalOrder.id,
        author_id: "seller-user-1",
        author_role: "seller",
        body: "Ready",
      },
    ],
    [
      "order_events",
      {
        order_id: canonicalOrder.id,
        actor_id: "seller-user-1",
        actor_role: "seller",
        kind: "note_added",
        message: "Seller note added",
        payload: {},
      },
    ],
  ]);
});

test("audit query success, events and failure traverse the server/query/UI seams", async () => {
  const related = (eventsResult) =>
    adminHandlers.loadAdminOrderDetailRelated({
      order: canonicalOrder,
      itemsQuery: Promise.resolve({ data: canonicalOrder.items, error: null }),
      eventsQuery: Promise.resolve(eventsResult),
      capabilityQuery: Promise.resolve({ data: true, error: null }),
    });

  const empty = await related({ data: [], error: null });
  assert.equal(
    getAdminOrderDetailRouteView({ isLoading: false, error: null, data: empty }),
    "ready",
  );
  assert.match(
    html(behaviorModule.AdminLifecycleAudit, { events: empty.events }),
    /No lifecycle transitions recorded/,
  );

  const event = {
    id: "event-1",
    transition_type: "order_status",
    previous_value: "pending",
    new_value: "confirmed",
    actor_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    created_at: canonicalOrder.created_at,
  };
  const populated = await related({ data: [event], error: null });
  const audit = html(behaviorModule.AdminLifecycleAudit, { events: populated.events });
  assert.match(audit, /order status/);
  assert.match(audit, /pending/);
  assert.match(audit, /confirmed/);

  let failure;
  try {
    await related({ data: null, error: new Error("raw database host secret") });
  } catch (error) {
    failure = error;
  }
  assert.equal(failure?.message, "CM_COM_4A_AUDIT_QUERY_FAILED");
  const failedView = getAdminOrderDetailRouteView({
    isLoading: false,
    error: failure,
    data: undefined,
  });
  assert.equal(failedView, "query_failed");
  const failureHtml = html(adminRoute.AdminOrderDetailQuerySurface, {
    view: failedView,
    data: undefined,
    onRetry() {},
    invalidateKey: ["admin-order", canonicalOrder.id],
    backAction: React.createElement("span", null, "Back to orders"),
  });
  assert.match(failureHtml, /temporarily unavailable/);
  assert.doesNotMatch(failureHtml, /raw database|host secret|CM_COM_4A_AUDIT_QUERY_FAILED/);
});
