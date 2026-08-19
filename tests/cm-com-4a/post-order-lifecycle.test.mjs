import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ORDER_STATES,
  PAYMENT_STATES,
  COD_COMBINED_STATES,
  COD_PAYMENT_TRANSITIONS,
  ORDER_TRANSITIONS,
  allowedOrderTransitions,
  allowedPaymentTransitions,
  allowedCompatibleOrderTransitions,
  allowedCompatiblePaymentTransitions,
  isCodLifecyclePairCompatible,
} from "../../src/lib/order-lifecycle.ts";
import {
  resolveLifecycleAudit,
  resolveOwnedOrderDetail,
} from "../../src/lib/order-detail-contract.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const account = await read("src/lib/account.functions.ts");
const accountUi = await read("src/routes/_authenticated/account.tsx");
const customerDetail = await read("src/routes/_authenticated/account.orders.$id.tsx");
const admin = await read("src/lib/admin.functions.ts");
const sellerUi = await read("src/components/site/OrderDetailView.tsx");
const adminUi = await read("src/components/site/AdminOrderLifecycleView.tsx");
const behaviorSurfaces = await read("src/components/site/OrderExperienceBehaviorSurfaces.tsx");
const adminListUi = await read("src/routes/_authenticated/admin.orders.index.tsx");
const lifecycle = await read("src/lib/order-lifecycle.ts");
const experienceContract = await read("src/lib/order-experience-contract.ts");
const migration = await read(
  "supabase/pending-canonical/20260812180442_cm_com_4a_post_order_lifecycle.sql",
);

test("canonical enum authority is exact", () => {
  assert.deepEqual(ORDER_STATES, [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]);
  assert.deepEqual(PAYMENT_STATES, [
    "pending",
    "under_review",
    "paid",
    "failed",
    "refunded",
    "cancelled",
  ]);
});

test("order transitions are explicit and terminal", () => {
  assert.deepEqual(allowedOrderTransitions("pending"), ["confirmed", "cancelled"]);
  assert.deepEqual(allowedOrderTransitions("shipped"), ["delivered"]);
  assert.deepEqual(allowedOrderTransitions("delivered"), []);
  assert.deepEqual(allowedOrderTransitions("cancelled"), []);
  assert.deepEqual(allowedOrderTransitions("preparing"), []);
});

test("COD payment transitions are separate and terminal", () => {
  assert.deepEqual(allowedPaymentTransitions("pending", "cod"), [
    "under_review",
    "paid",
    "failed",
    "cancelled",
  ]);
  assert.deepEqual(allowedPaymentTransitions("paid", "cod"), ["refunded"]);
  assert.deepEqual(allowedPaymentTransitions("refunded", "cod"), []);
  assert.deepEqual(allowedPaymentTransitions("pending", "card"), []);
  assert.deepEqual(allowedPaymentTransitions("authorized", "cod"), []);
});

test("combined COD authority filters every destination pair", () => {
  for (const order of ORDER_STATES) {
    for (const payment of PAYMENT_STATES) {
      assert.equal(
        isCodLifecyclePairCompatible(order, payment),
        COD_COMBINED_STATES[order].includes(payment),
      );
      assert.deepEqual(
        allowedCompatibleOrderTransitions(order, payment, "cod"),
        allowedOrderTransitions(order).filter((next) =>
          COD_COMBINED_STATES[next].includes(payment),
        ),
      );
      assert.deepEqual(
        allowedCompatiblePaymentTransitions(order, payment, "cod"),
        allowedPaymentTransitions(payment, "cod").filter((next) =>
          COD_COMBINED_STATES[order].includes(next),
        ),
      );
    }
  }
  assert.deepEqual(allowedCompatiblePaymentTransitions("cancelled", "pending", "cod"), [
    "failed",
    "cancelled",
  ]);
  assert.deepEqual(allowedCompatibleOrderTransitions("shipped", "pending", "cod"), []);
});

test("TypeScript and SQL lifecycle authorities have exhaustive parity", () => {
  const values = (source, state) => {
    const match = source.match(
      new RegExp(`when '${state}' then [^\\n]*?(?:in \\(([^)]*)\\)|= '([^']*)')`),
    );
    assert.ok(match, `SQL authority missing ${state}`);
    return match[2] ? [match[2]] : [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  };
  const orderSql = migration.slice(
    migration.indexOf("v_allowed := case p_expected_from"),
    migration.indexOf("elsif p_transition_type = 'payment_status'"),
  );
  const paymentSql = migration.slice(
    migration.indexOf("elsif p_transition_type = 'payment_status'"),
    migration.indexOf("else\n    raise exception 'CM_COM_4A_TRANSITION_TYPE_INVALID'"),
  );
  const combinedSql = migration.slice(migration.indexOf("v_pair_allowed := case"));
  for (const state of ORDER_STATES) {
    if (ORDER_TRANSITIONS[state].length) {
      assert.deepEqual(values(orderSql, state), [...ORDER_TRANSITIONS[state]]);
    }
    assert.deepEqual(values(combinedSql, state), [...COD_COMBINED_STATES[state]]);
  }
  for (const state of PAYMENT_STATES) {
    if (COD_PAYMENT_TRANSITIONS[state].length) {
      assert.deepEqual(values(paymentSql, state), [...COD_PAYMENT_TRANSITIONS[state]]);
    }
  }
});

test("order detail result classifiers preserve truthful non-sensitive errors", () => {
  const own = { id: "own", total_aed: 10.5 };
  assert.equal(resolveOwnedOrderDetail({ data: own, error: null }), own);
  assert.throws(
    () => resolveOwnedOrderDetail({ data: null, error: null }),
    /ACCOUNT_ORDER_NOT_FOUND/,
  );
  assert.throws(
    () => resolveOwnedOrderDetail({ data: null, error: new Error("host secret") }),
    (error) =>
      error.message === "ACCOUNT_ORDER_DETAIL_QUERY_FAILED" && !error.message.includes("secret"),
  );
  assert.deepEqual(resolveLifecycleAudit({ data: [], error: null }), []);
  assert.throws(
    () => resolveLifecycleAudit({ data: null, error: new Error("database detail") }),
    /CM_COM_4A_AUDIT_QUERY_FAILED/,
  );
});

test("account history is server-bound to authenticated buyer and canonical items", () => {
  assert.match(account, /const \{ userId \} = context/);
  assert.match(account, /\.eq\("buyer_id", userId\)/);
  const history = account.slice(
    account.indexOf("export const getMyOrders"),
    account.indexOf("export const getMyOrderDetail"),
  );
  assert.doesNotMatch(history, /seller_id|seller:/);
  assert.match(history, /subtotal_aed, shipping_aed, tax_aed/);
});

test("account failures do not masquerade as empty history", () => {
  assert.match(account, /loadOwnedOrderHistory/);
  assert.match(experienceContract, /ACCOUNT_ORDER_HISTORY_QUERY_FAILED/);
  assert.match(accountUi, /CustomerOrderHistorySurface/);
  assert.match(accountUi, /view\.kind === "query_failed"/);
  assert.match(experienceContract, /We couldn't load your orders/);
});

test("customer detail enforces ownership server-side", () => {
  const detail = account.slice(account.indexOf("export const getMyOrderDetail"));
  assert.match(detail, /\.eq\("id", orderId\)/);
  assert.match(detail, /\.eq\("buyer_id", userId\)/);
  assert.match(detail, /loadOwnedOrderDetail/);
  assert.match(experienceContract, /ACCOUNT_ORDER_NOT_FOUND/);
  assert.match(experienceContract, /ACCOUNT_ORDER_DETAIL_QUERY_FAILED/);
  assert.doesNotMatch(detail, /buyerId|buyer_id:\s*data/);
});

test("customer route renders canonical order detail without admin controls", () => {
  assert.match(customerDetail, /account\/orders\/\$id/);
  assert.match(customerDetail, /order\.items/);
  assert.match(customerDetail, /subtotal_aed/);
  assert.match(customerDetail, /payment_status/);
  assert.doesNotMatch(customerDetail, /adminTransition|Controlled lifecycle/);
});

test("admin transition requires authenticated middleware and explicit expected state", () => {
  const transition = admin.slice(
    admin.indexOf("adminTransitionOrderLifecycle"),
    admin.indexOf("adminGetOrderDetail"),
  );
  assert.match(transition, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(transition, /await assertAdmin\(context\.userId\)/);
  assert.match(transition, /p_expected_from: data\.expectedCurrent/);
  assert.match(transition, /admin_transition_order_lifecycle_v1/);
});

test("privileged state writes occur only in reviewed RPC", () => {
  const transition = admin.slice(
    admin.indexOf("adminTransitionOrderLifecycle"),
    admin.indexOf("adminGetOrderDetail"),
  );
  assert.doesNotMatch(transition, /\.from\("orders"\)\s*\.update/);
  assert.doesNotMatch(adminUi, /\.from\("orders"\)|supabase/);
  assert.match(migration, /update public\.orders/);
});

test("RPC locks, checks stale state and validates authorization", () => {
  assert.match(migration, /for update/);
  assert.match(migration, /commerce_private\.is_admin\(v_actor\)/);
  assert.match(migration, /CM_COM_4A_STALE_STATE/);
  assert.match(migration, /CM_COM_4A_TRANSITION_NOT_ALLOWED/);
  assert.match(
    migration,
    /revoke all on function public\.admin_transition_order_lifecycle_v1[\s\S]*from public, anon, service_role/,
  );
});

test("audit event is append-only and in the same RPC transaction", () => {
  assert.match(migration, /create table public\.order_lifecycle_events/);
  assert.match(migration, /insert into public\.order_lifecycle_events/);
  assert.match(migration, /previous_value text not null/);
  assert.match(migration, /new_value text not null/);
  assert.match(migration, /actor_id uuid not null/);
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete).*order_lifecycle_events.*authenticated/i,
  );
});

test("admin UX exposes allowlisted buttons and fails closed", () => {
  assert.match(adminUi, /allowedCompatibleOrderTransitions/);
  assert.match(adminUi, /allowedCompatiblePaymentTransitions/);
  assert.match(adminUi, /capabilityAvailable/);
  assert.match(adminUi, /Controls are disabled/);
  assert.doesNotMatch(adminUi, /SelectItem|free-form/);
});

test("seller detail preserves fulfillment, shipment and internal-note behavior", () => {
  assert.match(sellerUi, /role === "seller"/);
  assert.match(sellerUi, /setOrderItemStatus/);
  assert.match(sellerUi, /SellerItemControls/);
  assert.match(sellerUi, /SellerShipmentPresentation/);
  assert.match(sellerUi, /SellerInternalNotes/);
  assert.match(behaviorSurfaces, /getSellerItemActions/);
  assert.match(behaviorSurfaces, /Shipments/);
  assert.match(behaviorSurfaces, /Add note/);
  assert.match(sellerUi, /sellerAddOrderNote/);
  assert.doesNotMatch(sellerUi, /adminTransitionOrderLifecycle|Controlled lifecycle/);
  assert.doesNotMatch(adminUi, /setOrderItemStatus|sellerAddOrderNote/);
});

test("audit errors cannot masquerade as empty lifecycle history", () => {
  assert.match(admin, /resolveLifecycleAudit\(eventsRes\)/);
  assert.match(adminUi, /AdminLifecycleAudit/);
  assert.match(behaviorSurfaces, /No lifecycle transitions recorded/);
  assert.match(admin, /CM_COM_4A_AUDIT_QUERY_FAILED|resolveLifecycleAudit/);
});

test("legacy lifecycle values are absent from CM-COM-4A authority and mutation UI", () => {
  const authorityAndUi = `${lifecycle}\n${adminUi}\n${adminListUi}`;
  assert.doesNotMatch(authorityAndUi, /\bpreparing\b/);
  assert.doesNotMatch(authorityAndUi, /\bauthorized\b/);
  assert.ok(!ORDER_STATES.includes("paid"));
});
