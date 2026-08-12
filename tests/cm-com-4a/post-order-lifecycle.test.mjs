import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ORDER_STATES,
  PAYMENT_STATES,
  allowedOrderTransitions,
  allowedPaymentTransitions,
} from "../../src/lib/order-lifecycle.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const account = await read("src/lib/account.functions.ts");
const accountUi = await read("src/routes/_authenticated/account.tsx");
const customerDetail = await read("src/routes/_authenticated/account.orders.$id.tsx");
const admin = await read("src/lib/admin.functions.ts");
const adminUi = await read("src/components/site/OrderDetailView.tsx");
const adminListUi = await read("src/routes/_authenticated/admin.orders.index.tsx");
const lifecycle = await read("src/lib/order-lifecycle.ts");
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
  assert.match(account, /ACCOUNT_ORDER_HISTORY_QUERY_FAILED/);
  assert.match(accountUi, /orders\.isError/);
  assert.match(accountUi, /We couldn't load your orders/);
});

test("customer detail enforces ownership server-side", () => {
  const detail = account.slice(account.indexOf("export const getMyOrderDetail"));
  assert.match(detail, /\.eq\("id", data\.orderId\)/);
  assert.match(detail, /\.eq\("buyer_id", context\.userId\)/);
  assert.match(detail, /ACCOUNT_ORDER_NOT_FOUND/);
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
  assert.match(adminUi, /allowedOrderTransitions/);
  assert.match(adminUi, /allowedPaymentTransitions/);
  assert.match(adminUi, /capabilityAvailable/);
  assert.match(adminUi, /Controls are disabled/);
  assert.doesNotMatch(adminUi, /SelectItem|free-form/);
});

test("legacy lifecycle values are absent from CM-COM-4A authority and mutation UI", () => {
  const authorityAndUi = `${lifecycle}\n${adminUi}\n${adminListUi}`;
  assert.doesNotMatch(authorityAndUi, /\bpreparing\b/);
  assert.doesNotMatch(authorityAndUi, /\bauthorized\b/);
  assert.ok(!ORDER_STATES.includes("paid"));
});
