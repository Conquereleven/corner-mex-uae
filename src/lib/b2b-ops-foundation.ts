import { z } from "zod";

export type MetricResult =
  | { status: "ok"; value: number }
  | { status: "invalid_inventory"; value: null };

export function availableStock(quantityOnHand: number, quantityReserved: number): MetricResult {
  if (
    !Number.isInteger(quantityOnHand) ||
    !Number.isInteger(quantityReserved) ||
    quantityOnHand < 0 ||
    quantityReserved < 0 ||
    quantityReserved > quantityOnHand
  ) {
    return { status: "invalid_inventory", value: null };
  }
  return { status: "ok", value: quantityOnHand - quantityReserved };
}

export type DaysOfCoverResult =
  | { status: "ok"; days: number }
  | { status: "zero_demand" | "no_demand_history" | "invalid_inventory"; days: null };

export function daysOfCover(input: {
  quantityOnHand: number;
  quantityReserved: number;
  avgDailyDemand: number | null;
}): DaysOfCoverResult {
  const available = availableStock(input.quantityOnHand, input.quantityReserved);
  if (available.status !== "ok") return { status: "invalid_inventory", days: null };
  if (input.avgDailyDemand === null) return { status: "no_demand_history", days: null };
  if (!Number.isFinite(input.avgDailyDemand) || input.avgDailyDemand < 0) {
    return { status: "no_demand_history", days: null };
  }
  if (input.avgDailyDemand === 0) return { status: "zero_demand", days: null };
  return { status: "ok", days: available.value / input.avgDailyDemand };
}

export type ReorderPointResult =
  | { status: "ok"; demandDuringLeadTime: number; reorderPoint: number }
  | { status: "missing_lead_time" | "missing_safety_stock" | "no_demand_history" };

export function calculateReorderPoint(input: {
  avgDailyDemand: number | null;
  leadTimeDays: number | null;
  safetyStock: number | null;
}): ReorderPointResult {
  if (
    input.avgDailyDemand === null ||
    !Number.isFinite(input.avgDailyDemand) ||
    input.avgDailyDemand < 0
  ) {
    return { status: "no_demand_history" };
  }
  if (
    input.leadTimeDays === null ||
    !Number.isInteger(input.leadTimeDays) ||
    input.leadTimeDays < 0
  ) {
    return { status: "missing_lead_time" };
  }
  if (input.safetyStock === null || !Number.isInteger(input.safetyStock) || input.safetyStock < 0) {
    return { status: "missing_safety_stock" };
  }
  const demandDuringLeadTime = input.avgDailyDemand * input.leadTimeDays;
  return {
    status: "ok",
    demandDuringLeadTime,
    reorderPoint: Math.ceil(demandDuringLeadTime + input.safetyStock),
  };
}

export function roundReorderQuantity(
  rawQuantity: number,
  minimumOrderQuantity: number | null,
  casePack: number | null,
): number {
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) return 0;
  const moq = minimumOrderQuantity ?? 1;
  const pack = casePack ?? 1;
  if (!Number.isInteger(moq) || moq <= 0 || !Number.isInteger(pack) || pack <= 0) {
    throw new Error("INVALID_REORDER_TERMS");
  }
  return Math.ceil(Math.max(rawQuantity, moq) / pack) * pack;
}

export type InventoryException = "stockout_risk" | "low_cover" | "overstock" | "reorder_needed";

export type InventoryRecommendation =
  | {
      status: "excluded_inactive" | "invalid_inventory" | "no_demand_history" | "zero_demand";
      exceptions: [];
    }
  | { status: "invalid_policy"; exceptions: [] }
  | { status: "incomplete_policy"; exceptions: InventoryException[] }
  | {
      status: "evaluated";
      availableStock: number;
      daysOfCover: number | null;
      reorderPoint: number;
      exceptions: InventoryException[];
      recommendedReorderQuantity: number;
      createsPurchaseOrder: false;
    };

export function recommendInventoryAction(input: {
  isActive: boolean;
  quantityOnHand: number;
  quantityReserved: number;
  avgDailyDemand: number | null;
  leadTimeDays: number | null;
  safetyStock: number | null;
  reorderPoint: number | null;
  targetStock: number | null;
  minimumOrderQuantity: number | null;
  casePack: number | null;
}): InventoryRecommendation {
  if (!input.isActive) return { status: "excluded_inactive", exceptions: [] };
  const available = availableStock(input.quantityOnHand, input.quantityReserved);
  if (available.status !== "ok") return { status: "invalid_inventory", exceptions: [] };
  const invalidNonnegativeInteger = (value: number | null) =>
    value !== null && (!Number.isInteger(value) || value < 0);
  const invalidPositiveInteger = (value: number | null) =>
    value !== null && (!Number.isInteger(value) || value <= 0);
  if (
    invalidNonnegativeInteger(input.leadTimeDays) ||
    invalidNonnegativeInteger(input.safetyStock) ||
    invalidNonnegativeInteger(input.reorderPoint) ||
    invalidNonnegativeInteger(input.targetStock) ||
    invalidPositiveInteger(input.minimumOrderQuantity) ||
    invalidPositiveInteger(input.casePack) ||
    (input.reorderPoint !== null &&
      input.targetStock !== null &&
      input.targetStock < input.reorderPoint)
  ) {
    return { status: "invalid_policy", exceptions: [] };
  }
  if (
    input.avgDailyDemand === null ||
    !Number.isFinite(input.avgDailyDemand) ||
    input.avgDailyDemand < 0
  ) {
    return { status: "no_demand_history", exceptions: [] };
  }
  if (input.avgDailyDemand === 0) return { status: "zero_demand", exceptions: [] };

  const cover = daysOfCover(input);
  const derivedPoint =
    input.reorderPoint === null
      ? calculateReorderPoint(input)
      : { status: "ok" as const, reorderPoint: input.reorderPoint };
  const preliminary: InventoryException[] = [];
  if (available.value === 0 && input.avgDailyDemand > 0) preliminary.push("stockout_risk");
  if (cover.status === "ok" && input.leadTimeDays !== null && cover.days < input.leadTimeDays) {
    preliminary.push("low_cover");
  }
  if (input.targetStock !== null && available.value > input.targetStock)
    preliminary.push("overstock");
  if (derivedPoint.status !== "ok" || input.targetStock === null) {
    return { status: "incomplete_policy", exceptions: preliminary };
  }
  if (available.value <= derivedPoint.reorderPoint) preliminary.push("reorder_needed");
  const shouldReorder = preliminary.includes("reorder_needed");
  return {
    status: "evaluated",
    availableStock: available.value,
    daysOfCover: cover.status === "ok" ? cover.days : null,
    reorderPoint: derivedPoint.reorderPoint,
    exceptions: [...new Set(preliminary)],
    recommendedReorderQuantity: shouldReorder
      ? roundReorderQuantity(
          input.targetStock - available.value,
          input.minimumOrderQuantity,
          input.casePack,
        )
      : 0,
    createsPurchaseOrder: false,
  };
}

export type ResolvedB2BPrice = {
  priceAED: number;
  source: "exact_account_variant" | "default_sell_price";
};

export type B2BVariantPriceOverride = {
  priceAED: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
};

function validAedAmount(value: number | null): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    value >= 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  );
}

export function resolveB2BPrice(input: {
  exactAccountVariantOverride: B2BVariantPriceOverride | null;
  defaultSellPriceAED: number | null;
  at: string;
}): ResolvedB2BPrice {
  const at = Date.parse(input.at);
  if (!Number.isFinite(at)) throw new Error("B2B_PRICE_TIME_INVALID");
  const override = input.exactAccountVariantOverride;
  const from = override?.validFrom === null ? null : Date.parse(override?.validFrom ?? "");
  const until = override?.validUntil === null ? null : Date.parse(override?.validUntil ?? "");
  if (
    override &&
    ((from !== null && !Number.isFinite(from)) ||
      (until !== null && !Number.isFinite(until)) ||
      (from !== null && until !== null && until <= from))
  ) {
    throw new Error("B2B_PRICE_OVERRIDE_WINDOW_INVALID");
  }
  const applicable =
    override?.isActive === true && (from === null || from <= at) && (until === null || until > at);
  if (applicable) {
    if (!validAedAmount(override.priceAED)) throw new Error("B2B_PRICE_INVALID");
    return { priceAED: override.priceAED, source: "exact_account_variant" };
  }
  if (validAedAmount(input.defaultSellPriceAED)) {
    return { priceAED: input.defaultSellPriceAED, source: "default_sell_price" };
  }
  throw new Error("B2B_PRICE_UNAVAILABLE");
}

const SavedListItemSchema = z
  .object({
    variantId: z.string().uuid(),
    desiredQuantity: z.number().int().min(1).max(100000),
    sortPosition: z.number().int().min(0),
  })
  .strict();

export const SavedListSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    createdBy: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    items: z.array(SavedListItemSchema).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.items.map((item) => item.variantId)).size !== value.items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate variant" });
    }
    if (new Set(value.items.map((item) => item.sortPosition)).size !== value.items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate sort position" });
    }
  });

export function canAccessSavedList(input: {
  listAccountId: string;
  memberships: Array<{ accountId: string; status: "active" | "inactive" }>;
}): boolean {
  return input.memberships.some(
    (membership) => membership.accountId === input.listAccountId && membership.status === "active",
  );
}

export const B2B_OPS_SIDE_EFFECTS = Object.freeze({
  createsPurchaseOrders: false,
  writesSupplierState: false,
  appliesProductionMigration: false,
  activatesMcpOrOAuth: false,
});
