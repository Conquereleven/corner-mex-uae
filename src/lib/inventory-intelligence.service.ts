import {
  evaluateInventoryPosition,
  type DemandSource,
  type InventoryIntelligenceResult,
  type InventoryPolicyInput,
} from "./inventory-intelligence.ts";

export type CatalogVariantRead = {
  variantId: string;
  productId: string;
  sku: string | null;
  productActive: boolean;
  variantActive: boolean;
};

export type InventoryRead = {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
};

export type InventoryPolicyRead = InventoryPolicyInput & { variantId: string };

export type DemandAggregateRead = {
  variantId: string;
  totalDemandUnits: number;
  observedDays: number;
  hasHistoricalDemand: boolean;
  source: Exclude<DemandSource, "explicit_input">;
};

export type InventoryIntelligenceReadRepository = {
  readCatalogVariants(): Promise<CatalogVariantRead[]>;
  readInventoryBatch(variantIds: readonly string[]): Promise<InventoryRead[]>;
  readInventoryPoliciesBatch(variantIds: readonly string[]): Promise<InventoryPolicyRead[]>;
  readDemandAggregatesBatch(
    variantIds: readonly string[],
    window: { startInclusive: string; endExclusive: string },
  ): Promise<DemandAggregateRead[]>;
};

export type InventoryCatalogEvaluation = {
  evaluatedAt: string;
  demandWindow: { startInclusive: string; endExclusive: string };
  createsPurchaseOrders: false;
  results: InventoryIntelligenceResult[];
};

export function deriveAverageDailyDemand(aggregate: DemandAggregateRead | undefined): {
  avgDailyDemand: number | null;
  source: DemandSource;
  observationDays: number | null;
} {
  if (!aggregate || !aggregate.hasHistoricalDemand || aggregate.source === "no_history") {
    return { avgDailyDemand: null, source: "no_history", observationDays: null };
  }
  if (
    !Number.isSafeInteger(aggregate.totalDemandUnits) ||
    aggregate.totalDemandUnits < 0 ||
    !Number.isSafeInteger(aggregate.observedDays) ||
    aggregate.observedDays <= 0
  ) {
    return {
      avgDailyDemand: Number.NaN,
      source: "derived_order_history",
      observationDays: aggregate.observedDays,
    };
  }
  return {
    avgDailyDemand: aggregate.totalDemandUnits / aggregate.observedDays,
    source: "derived_order_history",
    observationDays: aggregate.observedDays,
  };
}

function assertValidWindow(window: { startInclusive: string; endExclusive: string }) {
  const start = Date.parse(window.startInclusive);
  const end = Date.parse(window.endExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("CM_INVENTORY_INTELLIGENCE_INVALID_DEMAND_WINDOW");
  }
}

export async function evaluateInventoryCatalog(
  repository: InventoryIntelligenceReadRepository,
  options: {
    evaluatedAt: string;
    demandWindow: { startInclusive: string; endExclusive: string };
  },
): Promise<InventoryCatalogEvaluation> {
  if (!Number.isFinite(Date.parse(options.evaluatedAt))) {
    throw new Error("CM_INVENTORY_INTELLIGENCE_INVALID_EVALUATED_AT");
  }
  assertValidWindow(options.demandWindow);

  const catalog = await repository.readCatalogVariants();
  const variantIds = [...new Set(catalog.map((row) => row.variantId))].sort();
  const [inventory, policies, demand] = await Promise.all([
    repository.readInventoryBatch(variantIds),
    repository.readInventoryPoliciesBatch(variantIds),
    repository.readDemandAggregatesBatch(variantIds, options.demandWindow),
  ]);
  const inventoryByVariant = new Map(inventory.map((row) => [row.variantId, row]));
  const policyByVariant = new Map(policies.map((row) => [row.variantId, row]));
  const demandByVariant = new Map(demand.map((row) => [row.variantId, row]));

  const results = catalog
    .map((variant) => {
      const inventoryRow = inventoryByVariant.get(variant.variantId);
      const policyRow = policyByVariant.get(variant.variantId);
      const demandInput = deriveAverageDailyDemand(demandByVariant.get(variant.variantId));
      return evaluateInventoryPosition({
        ...variant,
        quantityOnHand: inventoryRow?.quantityOnHand ?? null,
        quantityReserved: inventoryRow?.quantityReserved ?? null,
        avgDailyDemand: demandInput.avgDailyDemand,
        demandSource: demandInput.source,
        demandObservationDays: demandInput.observationDays,
        policy: policyRow
          ? {
              leadTimeDays: policyRow.leadTimeDays,
              safetyStock: policyRow.safetyStock,
              configuredReorderPoint: policyRow.configuredReorderPoint,
              targetStock: policyRow.targetStock,
              minimumOrderQuantity: policyRow.minimumOrderQuantity,
              casePack: policyRow.casePack,
            }
          : null,
      });
    })
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  return {
    evaluatedAt: options.evaluatedAt,
    demandWindow: options.demandWindow,
    createsPurchaseOrders: false,
    results,
  };
}
