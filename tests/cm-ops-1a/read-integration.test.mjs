import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAverageDailyDemand,
  evaluateInventoryCatalog,
} from "../../src/lib/inventory-intelligence.service.ts";

test("average daily demand is derived only from explicit observed history", () => {
  assert.deepEqual(
    deriveAverageDailyDemand({
      variantId: "v1",
      totalDemandUnits: 45,
      observedDays: 30,
      hasHistoricalDemand: true,
      source: "derived_order_history",
    }),
    { avgDailyDemand: 1.5, source: "derived_order_history", observationDays: 30 },
  );
  assert.deepEqual(deriveAverageDailyDemand(undefined), {
    avgDailyDemand: null,
    source: "no_history",
    observationDays: null,
  });
});

test("catalog evaluation reads each source once in batches and returns deterministic order", async () => {
  const calls = { catalog: 0, inventory: 0, policy: 0, demand: 0 };
  const receivedIds = [];
  const repository = {
    async readCatalogVariants() {
      calls.catalog += 1;
      return [
        {
          variantId: "v2",
          productId: "p2",
          sku: "SKU-2",
          productActive: true,
          variantActive: false,
        },
        {
          variantId: "v1",
          productId: "p1",
          sku: "SKU-1",
          productActive: true,
          variantActive: true,
        },
      ];
    },
    async readInventoryBatch(ids) {
      calls.inventory += 1;
      receivedIds.push([...ids]);
      return [{ variantId: "v1", quantityOnHand: 12, quantityReserved: 2 }];
    },
    async readInventoryPoliciesBatch(ids) {
      calls.policy += 1;
      receivedIds.push([...ids]);
      return [
        {
          variantId: "v1",
          leadTimeDays: 3,
          safetyStock: 5,
          configuredReorderPoint: 20,
          targetStock: 40,
          minimumOrderQuantity: 12,
          casePack: 6,
        },
      ];
    },
    async readDemandAggregatesBatch(ids, window) {
      calls.demand += 1;
      receivedIds.push([...ids]);
      assert.deepEqual(window, {
        startInclusive: "2026-07-01T00:00:00.000Z",
        endExclusive: "2026-07-31T00:00:00.000Z",
      });
      return [
        {
          variantId: "v1",
          totalDemandUnits: 150,
          observedDays: 30,
          hasHistoricalDemand: true,
          source: "derived_order_history",
        },
      ];
    },
  };

  const result = await evaluateInventoryCatalog(repository, {
    evaluatedAt: "2026-08-23T00:00:00.000Z",
    demandWindow: {
      startInclusive: "2026-07-01T00:00:00.000Z",
      endExclusive: "2026-07-31T00:00:00.000Z",
    },
  });

  assert.deepEqual(calls, { catalog: 1, inventory: 1, policy: 1, demand: 1 });
  assert.deepEqual(receivedIds, [
    ["v1", "v2"],
    ["v1", "v2"],
    ["v1", "v2"],
  ]);
  assert.deepEqual(
    result.results.map(({ variantId }) => variantId),
    ["v1", "v2"],
  );
  assert.equal(result.results[0].metrics.avgDailyDemand, 5);
  assert.equal(result.results[1].status, "excluded_inactive");
  assert.equal(result.createsPurchaseOrders, false);
});

test("invalid demand windows fail before any repository read", async () => {
  let reads = 0;
  const repository = {
    async readCatalogVariants() {
      reads += 1;
      return [];
    },
    async readInventoryBatch() {
      return [];
    },
    async readInventoryPoliciesBatch() {
      return [];
    },
    async readDemandAggregatesBatch() {
      return [];
    },
  };
  await assert.rejects(
    evaluateInventoryCatalog(repository, {
      evaluatedAt: "2026-08-23T00:00:00.000Z",
      demandWindow: {
        startInclusive: "2026-08-01T00:00:00.000Z",
        endExclusive: "2026-07-01T00:00:00.000Z",
      },
    }),
    /CM_INVENTORY_INTELLIGENCE_INVALID_DEMAND_WINDOW/,
  );
  assert.equal(reads, 0);
});
