import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { evaluateInventoryPosition } from "../../src/lib/inventory-intelligence.ts";
import {
  aggregateInventoryKpis,
  filterAndSortInventoryResults,
  primaryException,
} from "../../src/lib/inventory-control-tower.ts";

const base = (overrides = {}) =>
  evaluateInventoryPosition({
    variantId: overrides.variantId ?? "11111111-1111-4111-8111-111111111111",
    productId: "22222222-2222-4222-8222-222222222222",
    sku: overrides.sku ?? "CM-SKU-1",
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
  });

test("Control Tower KPIs aggregate deterministic engine outputs", () => {
  const results = [
    base({ quantityOnHand: 0, quantityReserved: 0 }),
    base({ quantityOnHand: 50, quantityReserved: 0, avgDailyDemand: 0 }),
    base({
      avgDailyDemand: null,
      demandSource: "no_history",
      demandObservationDays: null,
      variantId: "33333333-3333-4333-8333-333333333333",
    }),
  ];
  assert.deepEqual(aggregateInventoryKpis(results), {
    activeSkusEvaluated: 3,
    stockout: 1,
    stockoutRisk: 1,
    lowCover: 1,
    reorderNeeded: 1,
    overstock: 1,
    insufficientData: 1,
    invalidData: 0,
  });
});

test("filters and sorting remain deterministic, including data quality and status", () => {
  const stockout = base({ sku: "B-SKU", quantityOnHand: 0, quantityReserved: 0 });
  const healthy = base({
    sku: "A-SKU",
    variantId: "33333333-3333-4333-8333-333333333333",
    quantityOnHand: 100,
    quantityReserved: 0,
  });
  const insufficient = base({
    sku: "C-SKU",
    variantId: "44444444-4444-4444-8444-444444444444",
    policy: null,
    avgDailyDemand: null,
    demandSource: "no_history",
    demandObservationDays: null,
  });
  const filter = { status: "all", exception: "all", quality: "all" };
  assert.deepEqual(
    filterAndSortInventoryResults([stockout, healthy, insufficient], filter, {
      key: "sku",
      direction: "asc",
    }).map((result) => result.sku),
    ["A-SKU", "B-SKU", "C-SKU"],
  );
  assert.deepEqual(
    filterAndSortInventoryResults(
      [stockout, healthy, insufficient],
      { ...filter, status: "stockout" },
      { key: "availableStock", direction: "asc" },
    ).map((result) => result.sku),
    ["B-SKU"],
  );
  assert.deepEqual(
    filterAndSortInventoryResults(
      [stockout, healthy, insufficient],
      { ...filter, quality: "insufficient" },
      { key: "sku", direction: "asc" },
    ).map((result) => result.sku),
    ["C-SKU"],
  );
  assert.equal(primaryException(stockout), "Stockout");
  assert.equal(primaryException(insufficient), "Insufficient data");
});

test("zero demand and overstock remain visible without an executable action", () => {
  const result = base({ quantityOnHand: 50, quantityReserved: 0, avgDailyDemand: 0 });
  assert.equal(result.posture, "overstock");
  assert.equal(result.metrics.daysOfCover, null);
  assert.equal(result.recommendation.createsPurchaseOrder, false);
  assert.equal(result.recommendation.roundedSuggestedQuantity, 0);
});

test("Control Tower has no browser private-table or purchase-order side effect", async () => {
  const route = await readFile("src/routes/_authenticated/admin.inventory.tsx", "utf8");
  const server = await readFile("src/lib/inventory-intelligence.functions.ts", "utf8");
  assert.doesNotMatch(
    route,
    /service_role|commerce_private|purchase.?order.*create|insert\s+into/i,
  );
  assert.match(server, /schema\("commerce_private"\)/);
  assert.match(server, /evaluateInventoryCatalog/);
});
