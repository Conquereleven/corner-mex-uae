import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAvailableStock,
  calculateDaysOfCover,
  calculateDeterministicReorderPoint,
  evaluateInventoryPosition,
  roundAdvisoryReorderQuantity,
} from "../../src/lib/inventory-intelligence.ts";

function input(overrides = {}) {
  return {
    variantId: "11111111-1111-4111-8111-111111111111",
    productId: "22222222-2222-4222-8222-222222222222",
    sku: "CM-SKU-1",
    productActive: true,
    variantActive: true,
    quantityOnHand: 30,
    quantityReserved: 5,
    avgDailyDemand: 5,
    demandSource: "derived_order_history",
    demandObservationDays: 30,
    policy: {
      leadTimeDays: 3,
      safetyStock: 5,
      configuredReorderPoint: 20,
      targetStock: 40,
      minimumOrderQuantity: 12,
      casePack: 6,
    },
    ...overrides,
  };
}

function reasonCodes(result) {
  return result.reasons.map((reason) => reason.code);
}

test("available stock is on hand minus reserved and never returns a negative quantity", () => {
  assert.equal(calculateAvailableStock(20, 3), 17);
  assert.equal(calculateAvailableStock(2, 3), null);
  assert.equal(calculateAvailableStock(-1, 0), null);

  const result = evaluateInventoryPosition(input({ quantityOnHand: 2, quantityReserved: 3 }));
  assert.equal(result.status, "invalid_data");
  assert.equal(result.metrics.availableStock, null);
  assert.deepEqual(reasonCodes(result).slice(0, 2), [
    "INVALID_INVENTORY",
    "RESERVATIONS_EXCEED_ON_HAND",
  ]);
});

test("days of cover uses positive demand and is explicitly null for zero or absent demand", () => {
  assert.equal(calculateDaysOfCover(15, 3), 5);
  assert.equal(calculateDaysOfCover(15, 0), null);
  assert.equal(calculateDaysOfCover(15, null), null);

  const zero = evaluateInventoryPosition(input({ avgDailyDemand: 0 }));
  assert.equal(zero.metrics.daysOfCover, null);
  assert.equal(zero.posture, "no_demand");
  assert.ok(zero.exceptionCodes.includes("NO_DEMAND_SIGNAL"));
  assert.equal(zero.recommendation.roundedSuggestedQuantity, 0);

  const absent = evaluateInventoryPosition(
    input({ avgDailyDemand: null, demandSource: "no_history", demandObservationDays: null }),
  );
  assert.equal(absent.status, "insufficient_data");
  assert.equal(absent.metrics.avgDailyDemand, null);
  assert.ok(reasonCodes(absent).includes("NO_DEMAND_HISTORY"));
});

test("reorder point is demand during lead time plus safety stock", () => {
  assert.deepEqual(
    calculateDeterministicReorderPoint({ avgDailyDemand: 2.5, leadTimeDays: 4, safetyStock: 3 }),
    { demandDuringLeadTime: 10, reorderPoint: 13 },
  );
  const result = evaluateInventoryPosition(
    input({
      avgDailyDemand: 2.5,
      quantityOnHand: 20,
      quantityReserved: 0,
      policy: {
        ...input().policy,
        leadTimeDays: 4,
        safetyStock: 3,
        configuredReorderPoint: 13,
      },
    }),
  );
  assert.equal(result.metrics.demandDuringLeadTime, 10);
  assert.equal(result.metrics.calculatedReorderPoint, 13);
});

test("missing policy inputs remain visible and do not receive commercial defaults", () => {
  const noPolicy = evaluateInventoryPosition(input({ policy: null }));
  assert.equal(noPolicy.status, "insufficient_data");
  assert.ok(noPolicy.exceptionCodes.includes("MISSING_POLICY"));
  assert.equal(noPolicy.metrics.calculatedReorderPoint, null);
  assert.equal(noPolicy.recommendation.roundedSuggestedQuantity, null);

  for (const [field, reason] of [
    ["leadTimeDays", "MISSING_LEAD_TIME"],
    ["safetyStock", "MISSING_SAFETY_STOCK"],
    ["targetStock", "MISSING_TARGET_STOCK"],
    ["minimumOrderQuantity", "MISSING_MOQ"],
    ["casePack", "MISSING_CASE_PACK"],
  ]) {
    const result = evaluateInventoryPosition(
      input({ policy: { ...input().policy, [field]: null } }),
    );
    assert.ok(reasonCodes(result).includes(reason), `${field} should emit ${reason}`);
    assert.ok(result.quality.missingInputs.includes(field));
  }
});

test("MOQ, case pack, and the combined rule round upward deterministically", () => {
  assert.deepEqual(
    roundAdvisoryReorderQuantity({
      rawSuggestedQuantity: 7,
      minimumOrderQuantity: 10,
      casePack: 1,
    }),
    {
      roundedSuggestedQuantity: 10,
      minimumOrderQuantityApplied: true,
      casePackRoundingApplied: false,
    },
  );
  assert.deepEqual(
    roundAdvisoryReorderQuantity({
      rawSuggestedQuantity: 13,
      minimumOrderQuantity: 1,
      casePack: 6,
    }),
    {
      roundedSuggestedQuantity: 18,
      minimumOrderQuantityApplied: false,
      casePackRoundingApplied: true,
    },
  );
  assert.deepEqual(
    roundAdvisoryReorderQuantity({
      rawSuggestedQuantity: 7,
      minimumOrderQuantity: 10,
      casePack: 6,
    }),
    {
      roundedSuggestedQuantity: 12,
      minimumOrderQuantityApplied: true,
      casePackRoundingApplied: true,
    },
  );
});

test("inactive product or variant is excluded from advice", () => {
  for (const inactive of [{ productActive: false }, { variantActive: false }]) {
    const result = evaluateInventoryPosition(input(inactive));
    assert.equal(result.status, "excluded_inactive");
    assert.equal(result.posture, "inactive");
    assert.deepEqual(reasonCodes(result), ["INACTIVE_SKU"]);
    assert.equal(result.recommendation.roundedSuggestedQuantity, 0);
  }
});

test("stockout, low cover, and reorder-needed exceptions are machine-readable", () => {
  const stockout = evaluateInventoryPosition(input({ quantityOnHand: 8, quantityReserved: 8 }));
  assert.equal(stockout.posture, "stockout");
  assert.deepEqual(stockout.exceptionCodes, [
    "STOCKOUT",
    "STOCKOUT_RISK",
    "LOW_COVER",
    "REORDER_NEEDED",
  ]);
  assert.equal(stockout.recommendation.rawSuggestedQuantity, 40);
  assert.equal(stockout.recommendation.roundedSuggestedQuantity, 42);

  const lowCover = evaluateInventoryPosition(input({ quantityOnHand: 12, quantityReserved: 2 }));
  assert.equal(lowCover.metrics.daysOfCover, 2);
  assert.ok(lowCover.exceptionCodes.includes("LOW_COVER"));
  assert.ok(lowCover.exceptionCodes.includes("REORDER_NEEDED"));
});

test("overstock remains visible when current observed demand is zero", () => {
  const result = evaluateInventoryPosition(
    input({ quantityOnHand: 50, quantityReserved: 0, avgDailyDemand: 0 }),
  );
  assert.equal(result.status, "evaluated");
  assert.equal(result.posture, "overstock");
  assert.deepEqual(result.exceptionCodes, ["OVERSTOCK", "NO_DEMAND_SIGNAL"]);
  assert.equal(result.recommendation.rawSuggestedQuantity, 0);
});

test("advice records every input and is structurally unable to create a purchase order", () => {
  const result = evaluateInventoryPosition(input({ quantityOnHand: 12, quantityReserved: 2 }));
  assert.deepEqual(result.metrics, {
    quantityOnHand: 12,
    quantityReserved: 2,
    availableStock: 10,
    avgDailyDemand: 5,
    demandSource: "derived_order_history",
    demandObservationDays: 30,
    daysOfCover: 2,
    leadTimeDays: 3,
    demandDuringLeadTime: 15,
    safetyStock: 5,
    calculatedReorderPoint: 20,
    configuredReorderPoint: 20,
    targetStock: 40,
    minimumOrderQuantity: 12,
    casePack: 6,
  });
  assert.deepEqual(result.recommendation, {
    rawSuggestedQuantity: 30,
    roundedSuggestedQuantity: 30,
    minimumOrderQuantityApplied: false,
    casePackRoundingApplied: false,
    createsPurchaseOrder: false,
  });
});

test("extreme numeric values fail closed without returning unsafe derived quantities", () => {
  const invalidInventory = evaluateInventoryPosition(
    input({ quantityOnHand: Number.MAX_SAFE_INTEGER + 1 }),
  );
  assert.equal(invalidInventory.status, "invalid_data");
  assert.equal(invalidInventory.metrics.quantityOnHand, null);
  assert.ok(reasonCodes(invalidInventory).includes("EXTREME_NUMERIC_VALUE"));

  const overflow = evaluateInventoryPosition(
    input({
      avgDailyDemand: Number.MAX_SAFE_INTEGER,
      policy: { ...input().policy, leadTimeDays: 2 },
    }),
  );
  assert.equal(overflow.status, "invalid_data");
  assert.equal(overflow.metrics.calculatedReorderPoint, null);
  assert.ok(reasonCodes(overflow).includes("EXTREME_NUMERIC_VALUE"));
});

test("the same input always produces byte-for-byte deterministic output", () => {
  const value = input({ quantityOnHand: 12, quantityReserved: 2 });
  const first = evaluateInventoryPosition(value);
  const second = evaluateInventoryPosition(structuredClone(value));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
