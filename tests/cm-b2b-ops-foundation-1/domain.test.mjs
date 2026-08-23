import assert from "node:assert/strict";
import test from "node:test";

import {
  B2B_OPS_SIDE_EFFECTS,
  SavedListSchema,
  availableStock,
  calculateReorderPoint,
  canAccessSavedList,
  daysOfCover,
  recommendInventoryAction,
  resolveB2BPrice,
  roundReorderQuantity,
} from "../../src/lib/b2b-ops-foundation.ts";

test("pricing uses exact account+variant before the canonical AED sell price", () => {
  assert.deepEqual(
    resolveB2BPrice({
      exactAccountVariantOverride: {
        priceAED: 42.5,
        isActive: true,
        validFrom: "2026-08-01T00:00:00.000Z",
        validUntil: null,
      },
      defaultSellPriceAED: 50,
      at: "2026-08-23T00:00:00.000Z",
    }),
    { priceAED: 42.5, source: "exact_account_variant" },
  );
  assert.deepEqual(
    resolveB2BPrice({
      exactAccountVariantOverride: null,
      defaultSellPriceAED: 50,
      at: "2026-08-23T00:00:00.000Z",
    }),
    { priceAED: 50, source: "default_sell_price" },
  );
  assert.throws(
    () =>
      resolveB2BPrice({
        exactAccountVariantOverride: null,
        defaultSellPriceAED: null,
        at: "2026-08-23T00:00:00.000Z",
      }),
    /B2B_PRICE_UNAVAILABLE/,
  );
  assert.throws(
    () =>
      resolveB2BPrice({
        exactAccountVariantOverride: {
          priceAED: -1,
          isActive: true,
          validFrom: null,
          validUntil: null,
        },
        defaultSellPriceAED: 50,
        at: "2026-08-23T00:00:00.000Z",
      }),
    /B2B_PRICE_INVALID/,
  );
});

test("available stock subtracts reservations and rejects inconsistent inventory", () => {
  assert.deepEqual(availableStock(20, 3), { status: "ok", value: 17 });
  assert.deepEqual(availableStock(2, 3), { status: "invalid_inventory", value: null });
  assert.deepEqual(availableStock(-1, 0), { status: "invalid_inventory", value: null });
});

test("days of cover handles demand edge cases without fabricated values", () => {
  assert.deepEqual(daysOfCover({ quantityOnHand: 20, quantityReserved: 5, avgDailyDemand: 3 }), {
    status: "ok",
    days: 5,
  });
  assert.deepEqual(daysOfCover({ quantityOnHand: 20, quantityReserved: 5, avgDailyDemand: 0 }), {
    status: "zero_demand",
    days: null,
  });
  assert.deepEqual(daysOfCover({ quantityOnHand: 20, quantityReserved: 5, avgDailyDemand: null }), {
    status: "no_demand_history",
    days: null,
  });
});

test("reorder point is demand during lead time plus safety stock", () => {
  assert.deepEqual(
    calculateReorderPoint({ avgDailyDemand: 2.5, leadTimeDays: 4, safetyStock: 3 }),
    {
      status: "ok",
      demandDuringLeadTime: 10,
      reorderPoint: 13,
    },
  );
  assert.deepEqual(
    calculateReorderPoint({ avgDailyDemand: 2, leadTimeDays: null, safetyStock: 3 }),
    {
      status: "missing_lead_time",
    },
  );
  assert.deepEqual(
    calculateReorderPoint({ avgDailyDemand: 2, leadTimeDays: 4, safetyStock: null }),
    {
      status: "missing_safety_stock",
    },
  );
});

test("MOQ is applied before case-pack rounding", () => {
  assert.equal(roundReorderQuantity(7, 10, 6), 12);
  assert.equal(roundReorderQuantity(13, 10, 6), 18);
  assert.equal(roundReorderQuantity(0, 10, 6), 0);
  assert.throws(() => roundReorderQuantity(5, 0, 6), /INVALID_REORDER_TERMS/);
});

test("saved lists validate account ownership, ordered unique variants and desired quantity", () => {
  const list = {
    id: "11111111-1111-4111-8111-111111111111",
    accountId: "22222222-2222-4222-8222-222222222222",
    name: "Weekly kitchen basket",
    createdBy: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    items: [
      {
        variantId: "44444444-4444-4444-8444-444444444444",
        desiredQuantity: 4,
        sortPosition: 0,
      },
    ],
  };
  assert.equal(SavedListSchema.safeParse(list).success, true);
  assert.equal(
    canAccessSavedList({
      listAccountId: list.accountId,
      memberships: [{ accountId: list.accountId, status: "active" }],
    }),
    true,
  );
  assert.equal(
    canAccessSavedList({
      listAccountId: list.accountId,
      memberships: [{ accountId: list.accountId, status: "inactive" }],
    }),
    false,
  );
  assert.equal(
    SavedListSchema.safeParse({ ...list, items: [{ ...list.items[0], desiredQuantity: 0 }] })
      .success,
    false,
  );
});

test("inactive SKUs never produce operational recommendations", () => {
  assert.deepEqual(
    recommendInventoryAction({
      isActive: false,
      quantityOnHand: 0,
      quantityReserved: 0,
      avgDailyDemand: 5,
      leadTimeDays: 7,
      safetyStock: 10,
      reorderPoint: null,
      targetStock: 100,
      minimumOrderQuantity: 12,
      casePack: 6,
    }),
    { status: "excluded_inactive", exceptions: [] },
  );
});

test("zero demand never fabricates a reorder recommendation", () => {
  assert.deepEqual(
    recommendInventoryAction({
      isActive: true,
      quantityOnHand: 0,
      quantityReserved: 0,
      avgDailyDemand: 0,
      leadTimeDays: 7,
      safetyStock: 10,
      reorderPoint: null,
      targetStock: 100,
      minimumOrderQuantity: 12,
      casePack: 6,
    }),
    { status: "zero_demand", exceptions: [] },
  );
});

test("recommendations are deterministic advice and cannot create orders", () => {
  const recommendation = recommendInventoryAction({
    isActive: true,
    quantityOnHand: 12,
    quantityReserved: 2,
    avgDailyDemand: 5,
    leadTimeDays: 3,
    safetyStock: 5,
    reorderPoint: null,
    targetStock: 40,
    minimumOrderQuantity: 12,
    casePack: 6,
  });
  assert.deepEqual(recommendation, {
    status: "evaluated",
    availableStock: 10,
    daysOfCover: 2,
    reorderPoint: 20,
    exceptions: ["low_cover", "reorder_needed"],
    recommendedReorderQuantity: 30,
    createsPurchaseOrder: false,
  });
  assert.deepEqual(B2B_OPS_SIDE_EFFECTS, {
    createsPurchaseOrders: false,
    writesSupplierState: false,
    appliesProductionMigration: false,
    activatesMcpOrOAuth: false,
  });
});

test("invalid inventory policy inputs fail closed", () => {
  assert.deepEqual(
    recommendInventoryAction({
      isActive: true,
      quantityOnHand: 12,
      quantityReserved: 2,
      avgDailyDemand: 5,
      leadTimeDays: 3,
      safetyStock: 5,
      reorderPoint: 30,
      targetStock: 20,
      minimumOrderQuantity: 12,
      casePack: 6,
    }),
    { status: "invalid_policy", exceptions: [] },
  );
});
