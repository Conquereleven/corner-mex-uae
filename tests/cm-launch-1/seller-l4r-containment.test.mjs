import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SELLER_CAPABILITY_ENABLED,
  SELLER_CAPABILITY_UNAVAILABLE,
  assertSellerCapabilityServerFnAllowed,
  isSellerCapabilityServerFn,
} from "../../src/lib/seller-capability-policy.ts";

const meta = (name, filename) => ({ id: "test-id", name, filename });

test("L4R seller authority is code-disabled and cannot be environment-enabled", async () => {
  assert.equal(SELLER_CAPABILITY_ENABLED, false);
  assert.equal(SELLER_CAPABILITY_UNAVAILABLE, "CM_SELLER_CAPABILITY_UNAVAILABLE");

  const source = await readFile("src/lib/seller-capability-policy.ts", "utf8");
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /import\.meta\.env/);
  assert.doesNotMatch(source, /from\(["']sellers["']\)/);
});

test("L4R contains every server function exported from legacy seller.functions", () => {
  assert.equal(
    isSellerCapabilityServerFn(meta("getSellerOverview", "/workspace/src/lib/seller.functions.ts")),
    true,
  );
  assert.equal(
    isSellerCapabilityServerFn(meta("setOrderItemStatus", "C:\\repo\\src\\lib\\seller.functions.ts")),
    true,
  );
  assert.equal(
    isSellerCapabilityServerFn(meta("getCurrencyRates", "src/lib/seller.functions.js")),
    true,
  );
});

test("L4R contains seller entry points living in shared modules", () => {
  assert.equal(
    isSellerCapabilityServerFn(meta("becomeSeller", "/workspace/src/lib/account.functions.ts")),
    true,
  );
  assert.equal(
    isSellerCapabilityServerFn(meta("sellerCreateShipment", "/workspace/src/lib/shipments.functions.ts")),
    true,
  );
  assert.equal(
    isSellerCapabilityServerFn(meta("sellerUpdateShipment", "/workspace/src/lib/shipments.functions.ts")),
    true,
  );
});

test("L4R does not block canonical customer/admin server functions", () => {
  assert.equal(
    isSellerCapabilityServerFn(meta("getMyOrders", "/workspace/src/lib/account.functions.ts")),
    false,
  );
  assert.equal(
    isSellerCapabilityServerFn(meta("adminListOrders", "/workspace/src/lib/admin.functions.ts")),
    false,
  );
  assert.equal(isSellerCapabilityServerFn(undefined), false);
});

test("L4R throws before dormant seller handlers can execute", () => {
  assert.throws(
    () =>
      assertSellerCapabilityServerFnAllowed(
        meta("upsertSellerProduct", "/workspace/src/lib/seller.functions.ts"),
      ),
    (error) => error instanceof Error && error.message === SELLER_CAPABILITY_UNAVAILABLE,
  );

  assert.throws(
    () =>
      assertSellerCapabilityServerFnAllowed(
        meta("becomeSeller", "/workspace/src/lib/account.functions.ts"),
      ),
    (error) => error instanceof Error && error.message === SELLER_CAPABILITY_UNAVAILABLE,
  );

  assert.doesNotThrow(() =>
    assertSellerCapabilityServerFnAllowed(
      meta("getMyOrders", "/workspace/src/lib/account.functions.ts"),
    ),
  );
});

test("L4R global function middleware enforces seller authority before Supabase auth", async () => {
  const source = await readFile("src/start.ts", "utf8");
  assert.match(source, /createMiddleware\(\{ type: "function" \}\)/);
  assert.match(source, /assertSellerCapabilityServerFnAllowed\(serverFnMeta\)/);

  const gateIndex = source.indexOf("sellerCapabilityGuard");
  const authIndex = source.indexOf("attachSupabaseAuth]", gateIndex);
  assert.notEqual(gateIndex, -1);
  assert.notEqual(authIndex, -1);
  assert.ok(gateIndex < authIndex, "seller authority must precede Supabase auth middleware");
});

test("L4R keeps route and account UI fail-closed and truthful", async () => {
  const sellerRoute = await readFile("src/routes/_authenticated/seller.tsx", "utf8");
  const accountRoute = await readFile("src/routes/_authenticated/account.index.tsx", "utf8");

  assert.match(sellerRoute, /redirect\(\{ to: "\/account" \}\)/);
  assert.match(accountRoute, /Seller applications are not active during this launch stage/);
  assert.match(accountRoute, /Applications coming soon/);
});

test("L4R preserves explicit shipment seller fail-closed handlers as defense in depth", async () => {
  const shipments = await readFile("src/lib/shipments.functions.ts", "utf8");
  for (const fn of [
    "sellerListShipments",
    "sellerCreateShipment",
    "sellerUpdateShipment",
    "sellerMarkDelivered",
  ]) {
    assert.match(shipments, new RegExp(`export const ${fn}`));
  }
  assert.match(shipments, /throw new Error\(SELLER_CAPABILITY_UNAVAILABLE\)/);
});
