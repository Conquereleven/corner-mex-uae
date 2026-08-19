import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveRouteAccess } from "../../src/lib/route-auth.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("canonical My Orders index is a first-class authenticated route", async () => {
  const route = await read("src/routes/_authenticated/account.orders.index.tsx");
  assert.match(route, /createFileRoute\("\/_authenticated\/account\/orders\/"\)/);
  assert.match(route, /useServerFn\(getMyOrders\)/);
  assert.match(route, /queryKey: \["my-orders"\]/);
  assert.match(route, /CustomerOrderHistorySurface/);
  assert.match(route, /Order history/);
});

test("account navigation exposes canonical My Orders beside secondary account surfaces", async () => {
  const nav = await read("src/components/account/AccountNavigation.tsx");
  assert.match(nav, /to="\/account\/orders"[^>]*>My Orders/);
  assert.match(nav, /to="\/account\/notifications"/);
  assert.match(nav, /to="\/account\/wishlist"/);
  assert.match(nav, /to="\/account\/loyalty"/);
  assert.match(nav, /to="\/account\/returns"/);
});

test("account overview links to complete order history and shares one presentation surface", async () => {
  const [account, history] = await Promise.all([
    read("src/routes/_authenticated/account.index.tsx"),
    read("src/components/account/CustomerOrderHistory.tsx"),
  ]);
  assert.match(account, /<AccountNavigation includeHome=\{false\} \/>/);
  assert.match(account, /to="\/account\/orders">View all orders/);
  assert.match(account, /CustomerOrderHistorySurface view=\{ordersView\}/);
  assert.match(history, /getCustomerOrderHistoryView|CustomerOrderHistoryView/);
  assert.match(history, /presentCanonicalCustomerOrder/);
  assert.match(history, /to="\/account\/orders\/\$id"/);
  assert.match(history, /customer-history-retry/);
  assert.match(history, /Start shopping/);
});

test("order detail returns to canonical My Orders instead of account overview", async () => {
  const detail = await read("src/routes/_authenticated/account.orders.$id.tsx");
  assert.match(detail, /to="\/account\/orders"/);
  assert.match(detail, /> My Orders/);
  assert.doesNotMatch(detail, /<Link to="\/account">\s*<ArrowLeft[^>]*> My orders/);
});

test("customer order queries preserve buyer ownership for history and detail", async () => {
  const accountFns = await read("src/lib/account.functions.ts");
  assert.match(accountFns, /export const getMyOrders = createServerFn\(\{ method: "GET" \}\)/);
  assert.match(accountFns, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(accountFns, /\.eq\("buyer_id", userId\)/);
  assert.match(
    accountFns,
    /\.eq\("id", orderId\)[\s\S]*\.eq\("buyer_id", userId\)[\s\S]*\.maybeSingle\(\)/,
  );
});

test("logged-out My Orders requests fail closed through the shared authenticated gate", () => {
  assert.equal(
    resolveRouteAccess("/account/orders", { authenticated: false, admin: false }),
    "login",
  );
  assert.equal(
    resolveRouteAccess("/account/orders/order-id", { authenticated: false, admin: false }),
    "login",
  );
  assert.equal(
    resolveRouteAccess("/account/orders", { authenticated: true, admin: false }),
    "allow",
  );
});
