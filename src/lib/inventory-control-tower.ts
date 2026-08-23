import type { InventoryExceptionCode, InventoryIntelligenceResult } from "./inventory-intelligence";

export type InventoryTowerFilter = {
  status: "all" | InventoryIntelligenceResult["posture"];
  exception: "all" | InventoryExceptionCode;
  quality: "all" | "complete" | "degraded" | "insufficient";
};

export type InventoryTowerSortKey =
  | "sku"
  | "availableStock"
  | "avgDailyDemand"
  | "daysOfCover"
  | "reorderPoint"
  | "targetStock"
  | "recommendedQuantity";

export type InventoryTowerSort = { key: InventoryTowerSortKey; direction: "asc" | "desc" };

const POSTURE_PRIORITY: Record<InventoryIntelligenceResult["posture"], number> = {
  stockout: 0,
  invalid_inventory: 1,
  insufficient_data: 2,
  low_cover: 3,
  reorder_needed: 4,
  overstock: 5,
  no_demand: 6,
  healthy: 7,
  inactive: 8,
};

export function primaryException(result: InventoryIntelligenceResult): string {
  if (result.posture === "stockout") return "Stockout";
  if (result.posture === "invalid_inventory") return "Invalid inventory";
  if (result.status === "insufficient_data") return "Insufficient data";
  if (result.posture === "low_cover") return "Low cover";
  if (result.posture === "reorder_needed") return "Reorder needed";
  if (result.posture === "overstock") return "Overstock";
  if (result.posture === "no_demand") return "No demand signal";
  if (result.posture === "inactive") return "Inactive SKU";
  return "Healthy";
}

export function aggregateInventoryKpis(results: readonly InventoryIntelligenceResult[]) {
  const active = results.filter((result) => result.posture !== "inactive");
  const has = (code: InventoryExceptionCode) =>
    results.filter((result) => result.exceptionCodes.includes(code)).length;
  return {
    activeSkusEvaluated: active.length,
    stockout: has("STOCKOUT"),
    stockoutRisk: has("STOCKOUT_RISK"),
    lowCover: has("LOW_COVER"),
    reorderNeeded: has("REORDER_NEEDED"),
    overstock: has("OVERSTOCK"),
    insufficientData: results.filter((result) => result.status === "insufficient_data").length,
    invalidData: results.filter((result) => result.status === "invalid_data").length,
  };
}

function numericValue(result: InventoryIntelligenceResult, key: InventoryTowerSortKey): number {
  if (key === "availableStock") return result.metrics.availableStock ?? Number.POSITIVE_INFINITY;
  if (key === "avgDailyDemand") return result.metrics.avgDailyDemand ?? Number.POSITIVE_INFINITY;
  if (key === "daysOfCover") return result.metrics.daysOfCover ?? Number.POSITIVE_INFINITY;
  if (key === "reorderPoint")
    return result.metrics.calculatedReorderPoint ?? Number.POSITIVE_INFINITY;
  if (key === "targetStock") return result.metrics.targetStock ?? Number.POSITIVE_INFINITY;
  return result.recommendation.roundedSuggestedQuantity ?? Number.POSITIVE_INFINITY;
}

export function filterAndSortInventoryResults(
  results: readonly InventoryIntelligenceResult[],
  filter: InventoryTowerFilter,
  sort: InventoryTowerSort,
): InventoryIntelligenceResult[] {
  return [...results]
    .filter((result) => filter.status === "all" || result.posture === filter.status)
    .filter(
      (result) => filter.exception === "all" || result.exceptionCodes.includes(filter.exception),
    )
    .filter((result) => filter.quality === "all" || result.quality.level === filter.quality)
    .sort((a, b) => {
      let comparison = 0;
      if (sort.key === "sku")
        comparison = (a.sku ?? a.variantId).localeCompare(b.sku ?? b.variantId);
      else comparison = numericValue(a, sort.key) - numericValue(b, sort.key);
      if (comparison === 0) comparison = a.variantId.localeCompare(b.variantId);
      return sort.direction === "asc" ? comparison : -comparison;
    });
}

export function formatPosture(posture: InventoryIntelligenceResult["posture"]): string {
  return posture.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function posturePriority(posture: InventoryIntelligenceResult["posture"]): number {
  return POSTURE_PRIORITY[posture];
}
