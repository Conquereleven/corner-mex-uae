export const INVENTORY_INTELLIGENCE_CONTRACT_VERSION = "cm-inventory-intelligence-v1" as const;

export const INVENTORY_REASON_CODES = [
  "INACTIVE_SKU",
  "INVALID_INVENTORY",
  "RESERVATIONS_EXCEED_ON_HAND",
  "INVALID_DEMAND_INPUT",
  "EXTREME_NUMERIC_VALUE",
  "NO_DEMAND_HISTORY",
  "NO_DEMAND_SIGNAL",
  "MISSING_POLICY",
  "MISSING_LEAD_TIME",
  "MISSING_SAFETY_STOCK",
  "MISSING_TARGET_STOCK",
  "MISSING_MOQ",
  "MISSING_CASE_PACK",
  "INVALID_POLICY",
  "TARGET_BELOW_REORDER_POINT",
  "CONFIGURED_REORDER_POINT_MISMATCH",
  "STOCKOUT",
  "STOCKOUT_RISK",
  "LOW_COVER",
  "REORDER_NEEDED",
  "OVERSTOCK",
  "MOQ_APPLIED",
  "CASE_PACK_ROUNDING_APPLIED",
] as const;

export type InventoryReasonCode = (typeof INVENTORY_REASON_CODES)[number];

export const INVENTORY_EXCEPTION_CODES = [
  "STOCKOUT",
  "STOCKOUT_RISK",
  "LOW_COVER",
  "REORDER_NEEDED",
  "OVERSTOCK",
  "NO_DEMAND_SIGNAL",
  "MISSING_POLICY",
] as const satisfies readonly InventoryReasonCode[];

export type InventoryExceptionCode = (typeof INVENTORY_EXCEPTION_CODES)[number];

const REASON_EXPLANATIONS: Record<InventoryReasonCode, string> = {
  INACTIVE_SKU: "The product or variant is inactive and is excluded from replenishment advice.",
  INVALID_INVENTORY: "On-hand or reserved inventory is invalid, so availability is not evaluated.",
  RESERVATIONS_EXCEED_ON_HAND:
    "Reserved inventory exceeds on-hand inventory; a negative available quantity is not returned.",
  INVALID_DEMAND_INPUT: "Average daily demand is negative or non-finite.",
  EXTREME_NUMERIC_VALUE: "An input or derived value exceeds JavaScript safe numeric precision.",
  NO_DEMAND_HISTORY: "No observed demand history was supplied; demand is not fabricated.",
  NO_DEMAND_SIGNAL: "Observed average daily demand is zero; days of cover is intentionally null.",
  MISSING_POLICY: "No inventory policy was supplied for this variant.",
  MISSING_LEAD_TIME: "Lead time is missing, so demand during lead time cannot be calculated.",
  MISSING_SAFETY_STOCK: "Safety stock is missing, so the calculated reorder point is unavailable.",
  MISSING_TARGET_STOCK: "Target stock is missing, so a reorder quantity cannot be calculated.",
  MISSING_MOQ: "Minimum order quantity is missing; no final rounded reorder quantity is asserted.",
  MISSING_CASE_PACK: "Case-pack size is missing; no final rounded reorder quantity is asserted.",
  INVALID_POLICY: "One or more inventory policy values are invalid.",
  TARGET_BELOW_REORDER_POINT:
    "Target stock is below the calculated reorder point and cannot support a valid recommendation.",
  CONFIGURED_REORDER_POINT_MISMATCH:
    "The stored reorder point differs from the deterministically calculated reorder point.",
  STOCKOUT: "Available stock is zero while observed demand is positive.",
  STOCKOUT_RISK: "Available stock will not cover the configured supplier lead time.",
  LOW_COVER: "Days of cover is below the configured supplier lead time.",
  REORDER_NEEDED: "Available stock is at or below the calculated reorder point.",
  OVERSTOCK: "Available stock is above target stock.",
  MOQ_APPLIED: "The minimum order quantity increased the raw suggested quantity.",
  CASE_PACK_ROUNDING_APPLIED: "The suggested quantity was rounded up to a full case pack.",
};

export type DemandSource = "explicit_input" | "derived_order_history" | "no_history";

export type InventoryPolicyInput = {
  leadTimeDays: number | null;
  safetyStock: number | null;
  configuredReorderPoint: number | null;
  targetStock: number | null;
  minimumOrderQuantity: number | null;
  casePack: number | null;
};

export type InventoryIntelligenceInput = {
  variantId: string;
  productId: string;
  sku: string | null;
  productActive: boolean;
  variantActive: boolean;
  quantityOnHand: number | null;
  quantityReserved: number | null;
  avgDailyDemand: number | null;
  demandSource: DemandSource;
  demandObservationDays: number | null;
  policy: InventoryPolicyInput | null;
};

export type InventoryQuality = {
  level: "complete" | "degraded" | "insufficient";
  missingInputs: string[];
  invalidInputs: string[];
};

export type InventoryReason = {
  code: InventoryReasonCode;
  explanation: string;
};

export type InventoryRecommendationContract = {
  rawSuggestedQuantity: number | null;
  roundedSuggestedQuantity: number | null;
  minimumOrderQuantityApplied: boolean;
  casePackRoundingApplied: boolean;
  createsPurchaseOrder: false;
};

export type InventoryIntelligenceResult = {
  contractVersion: typeof INVENTORY_INTELLIGENCE_CONTRACT_VERSION;
  variantId: string;
  productId: string;
  sku: string | null;
  status: "evaluated" | "insufficient_data" | "invalid_data" | "excluded_inactive";
  posture:
    | "healthy"
    | "stockout"
    | "low_cover"
    | "reorder_needed"
    | "overstock"
    | "no_demand"
    | "insufficient_data"
    | "invalid_inventory"
    | "inactive";
  metrics: {
    quantityOnHand: number | null;
    quantityReserved: number | null;
    availableStock: number | null;
    avgDailyDemand: number | null;
    demandSource: DemandSource;
    demandObservationDays: number | null;
    daysOfCover: number | null;
    leadTimeDays: number | null;
    demandDuringLeadTime: number | null;
    safetyStock: number | null;
    calculatedReorderPoint: number | null;
    configuredReorderPoint: number | null;
    targetStock: number | null;
    minimumOrderQuantity: number | null;
    casePack: number | null;
  };
  exceptionCodes: InventoryExceptionCode[];
  reasons: InventoryReason[];
  quality: InventoryQuality;
  recommendation: InventoryRecommendationContract;
};

function isNonnegativeSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

function finiteSafeMagnitude(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

function makeReasons(codes: Set<InventoryReasonCode>): InventoryReason[] {
  return INVENTORY_REASON_CODES.filter((code) => codes.has(code)).map((code) => ({
    code,
    explanation: REASON_EXPLANATIONS[code],
  }));
}

function makeExceptionCodes(codes: Set<InventoryReasonCode>): InventoryExceptionCode[] {
  return INVENTORY_EXCEPTION_CODES.filter((code) => codes.has(code));
}

export function calculateAvailableStock(
  quantityOnHand: number,
  quantityReserved: number,
): number | null {
  if (!isNonnegativeSafeInteger(quantityOnHand) || !isNonnegativeSafeInteger(quantityReserved)) {
    return null;
  }
  if (quantityReserved > quantityOnHand) return null;
  return quantityOnHand - quantityReserved;
}

export function calculateDaysOfCover(
  availableStock: number,
  avgDailyDemand: number | null,
): number | null {
  if (!isNonnegativeSafeInteger(availableStock)) return null;
  if (avgDailyDemand === null || !Number.isFinite(avgDailyDemand) || avgDailyDemand <= 0) {
    return null;
  }
  const days = availableStock / avgDailyDemand;
  return finiteSafeMagnitude(days) ? days : null;
}

export function calculateDeterministicReorderPoint(input: {
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
}): { demandDuringLeadTime: number; reorderPoint: number } | null {
  if (
    !Number.isFinite(input.avgDailyDemand) ||
    input.avgDailyDemand < 0 ||
    !isNonnegativeSafeInteger(input.leadTimeDays) ||
    !isNonnegativeSafeInteger(input.safetyStock)
  ) {
    return null;
  }
  const demandDuringLeadTime = input.avgDailyDemand * input.leadTimeDays;
  const reorderPoint = demandDuringLeadTime + input.safetyStock;
  if (!finiteSafeMagnitude(demandDuringLeadTime) || !finiteSafeMagnitude(reorderPoint)) return null;
  return { demandDuringLeadTime, reorderPoint };
}

export function roundAdvisoryReorderQuantity(input: {
  rawSuggestedQuantity: number;
  minimumOrderQuantity: number;
  casePack: number;
}): {
  roundedSuggestedQuantity: number;
  minimumOrderQuantityApplied: boolean;
  casePackRoundingApplied: boolean;
} | null {
  if (
    !isNonnegativeSafeInteger(input.rawSuggestedQuantity) ||
    !isPositiveSafeInteger(input.minimumOrderQuantity) ||
    !isPositiveSafeInteger(input.casePack)
  ) {
    return null;
  }
  if (input.rawSuggestedQuantity === 0) {
    return {
      roundedSuggestedQuantity: 0,
      minimumOrderQuantityApplied: false,
      casePackRoundingApplied: false,
    };
  }
  const afterMoq = Math.max(input.rawSuggestedQuantity, input.minimumOrderQuantity);
  const roundedSuggestedQuantity = Math.ceil(afterMoq / input.casePack) * input.casePack;
  if (!Number.isSafeInteger(roundedSuggestedQuantity)) return null;
  return {
    roundedSuggestedQuantity,
    minimumOrderQuantityApplied: afterMoq > input.rawSuggestedQuantity,
    casePackRoundingApplied: roundedSuggestedQuantity > afterMoq,
  };
}

function emptyRecommendation(): InventoryRecommendationContract {
  return {
    rawSuggestedQuantity: null,
    roundedSuggestedQuantity: null,
    minimumOrderQuantityApplied: false,
    casePackRoundingApplied: false,
    createsPurchaseOrder: false,
  };
}

function sanitizedMetric(value: number | null, valid: (value: number | null) => value is number) {
  return valid(value) ? value : null;
}

export function evaluateInventoryPosition(
  input: InventoryIntelligenceInput,
): InventoryIntelligenceResult {
  const reasons = new Set<InventoryReasonCode>();
  const missingInputs: string[] = [];
  const invalidInputs: string[] = [];
  const policy = input.policy;
  const quantityOnHand = sanitizedMetric(input.quantityOnHand, isNonnegativeSafeInteger);
  const quantityReserved = sanitizedMetric(input.quantityReserved, isNonnegativeSafeInteger);
  const safeDemandObservationDays = sanitizedMetric(
    input.demandObservationDays,
    isPositiveSafeInteger,
  );

  const baseMetrics: InventoryIntelligenceResult["metrics"] = {
    quantityOnHand,
    quantityReserved,
    availableStock: null,
    avgDailyDemand:
      input.avgDailyDemand !== null &&
      Number.isFinite(input.avgDailyDemand) &&
      input.avgDailyDemand >= 0
        ? input.avgDailyDemand
        : null,
    demandSource: input.demandSource,
    demandObservationDays: safeDemandObservationDays,
    daysOfCover: null,
    leadTimeDays: sanitizedMetric(policy?.leadTimeDays ?? null, isNonnegativeSafeInteger),
    demandDuringLeadTime: null,
    safetyStock: sanitizedMetric(policy?.safetyStock ?? null, isNonnegativeSafeInteger),
    calculatedReorderPoint: null,
    configuredReorderPoint: sanitizedMetric(
      policy?.configuredReorderPoint ?? null,
      isNonnegativeSafeInteger,
    ),
    targetStock: sanitizedMetric(policy?.targetStock ?? null, isNonnegativeSafeInteger),
    minimumOrderQuantity: sanitizedMetric(
      policy?.minimumOrderQuantity ?? null,
      isPositiveSafeInteger,
    ),
    casePack: sanitizedMetric(policy?.casePack ?? null, isPositiveSafeInteger),
  };

  const makeResult = (overrides: {
    status: InventoryIntelligenceResult["status"];
    posture: InventoryIntelligenceResult["posture"];
    qualityLevel: InventoryQuality["level"];
    recommendation?: InventoryRecommendationContract;
  }): InventoryIntelligenceResult => ({
    contractVersion: INVENTORY_INTELLIGENCE_CONTRACT_VERSION,
    variantId: input.variantId,
    productId: input.productId,
    sku: input.sku,
    status: overrides.status,
    posture: overrides.posture,
    metrics: baseMetrics,
    exceptionCodes: makeExceptionCodes(reasons),
    reasons: makeReasons(reasons),
    quality: {
      level: overrides.qualityLevel,
      missingInputs: [...missingInputs].sort(),
      invalidInputs: [...invalidInputs].sort(),
    },
    recommendation: overrides.recommendation ?? emptyRecommendation(),
  });

  if (!input.productActive || !input.variantActive) {
    reasons.add("INACTIVE_SKU");
    return makeResult({
      status: "excluded_inactive",
      posture: "inactive",
      qualityLevel: "complete",
      recommendation: {
        ...emptyRecommendation(),
        rawSuggestedQuantity: 0,
        roundedSuggestedQuantity: 0,
      },
    });
  }

  if (input.quantityOnHand === null) missingInputs.push("quantityOnHand");
  if (input.quantityReserved === null) missingInputs.push("quantityReserved");
  if (input.quantityOnHand !== null && quantityOnHand === null)
    invalidInputs.push("quantityOnHand");
  if (input.quantityReserved !== null && quantityReserved === null)
    invalidInputs.push("quantityReserved");
  if (quantityOnHand === null || quantityReserved === null) {
    reasons.add("INVALID_INVENTORY");
    if (
      (input.quantityOnHand !== null && !Number.isSafeInteger(input.quantityOnHand)) ||
      (input.quantityReserved !== null && !Number.isSafeInteger(input.quantityReserved))
    ) {
      reasons.add("EXTREME_NUMERIC_VALUE");
    }
    return makeResult({
      status: missingInputs.length > 0 ? "insufficient_data" : "invalid_data",
      posture: "invalid_inventory",
      qualityLevel: "insufficient",
    });
  }
  if (quantityReserved > quantityOnHand) {
    reasons.add("INVALID_INVENTORY");
    reasons.add("RESERVATIONS_EXCEED_ON_HAND");
    invalidInputs.push("quantityReserved");
    return makeResult({
      status: "invalid_data",
      posture: "invalid_inventory",
      qualityLevel: "insufficient",
    });
  }
  baseMetrics.availableStock = quantityOnHand - quantityReserved;

  if (input.avgDailyDemand === null || input.demandSource === "no_history") {
    reasons.add("NO_DEMAND_HISTORY");
    missingInputs.push("avgDailyDemand");
  } else if (
    !Number.isFinite(input.avgDailyDemand) ||
    input.avgDailyDemand < 0 ||
    input.avgDailyDemand > Number.MAX_SAFE_INTEGER
  ) {
    reasons.add("INVALID_DEMAND_INPUT");
    invalidInputs.push("avgDailyDemand");
    if (!finiteSafeMagnitude(input.avgDailyDemand)) reasons.add("EXTREME_NUMERIC_VALUE");
  }

  if (!policy) {
    reasons.add("MISSING_POLICY");
    missingInputs.push(
      "leadTimeDays",
      "safetyStock",
      "targetStock",
      "minimumOrderQuantity",
      "casePack",
    );
  } else {
    const nonnegativeFields = [
      ["leadTimeDays", policy.leadTimeDays],
      ["safetyStock", policy.safetyStock],
      ["configuredReorderPoint", policy.configuredReorderPoint],
      ["targetStock", policy.targetStock],
    ] as const;
    const positiveFields = [
      ["minimumOrderQuantity", policy.minimumOrderQuantity],
      ["casePack", policy.casePack],
    ] as const;
    for (const [name, value] of nonnegativeFields) {
      if (value !== null && !isNonnegativeSafeInteger(value)) invalidInputs.push(name);
    }
    for (const [name, value] of positiveFields) {
      if (value !== null && !isPositiveSafeInteger(value)) invalidInputs.push(name);
    }
    if (invalidInputs.some((name) => name !== "avgDailyDemand")) reasons.add("INVALID_POLICY");
    if (
      invalidInputs.some((name) => {
        const value = policy[name as keyof InventoryPolicyInput];
        return typeof value === "number" && !Number.isSafeInteger(value);
      })
    ) {
      reasons.add("EXTREME_NUMERIC_VALUE");
    }
  }

  if (baseMetrics.leadTimeDays === null && (!policy || policy.leadTimeDays === null)) {
    reasons.add("MISSING_LEAD_TIME");
    if (!missingInputs.includes("leadTimeDays")) missingInputs.push("leadTimeDays");
  }
  if (baseMetrics.safetyStock === null && (!policy || policy.safetyStock === null)) {
    reasons.add("MISSING_SAFETY_STOCK");
    if (!missingInputs.includes("safetyStock")) missingInputs.push("safetyStock");
  }
  if (baseMetrics.targetStock === null && (!policy || policy.targetStock === null)) {
    reasons.add("MISSING_TARGET_STOCK");
    if (!missingInputs.includes("targetStock")) missingInputs.push("targetStock");
  }
  if (
    baseMetrics.minimumOrderQuantity === null &&
    (!policy || policy.minimumOrderQuantity === null)
  ) {
    reasons.add("MISSING_MOQ");
    if (!missingInputs.includes("minimumOrderQuantity")) missingInputs.push("minimumOrderQuantity");
  }
  if (baseMetrics.casePack === null && (!policy || policy.casePack === null)) {
    reasons.add("MISSING_CASE_PACK");
    if (!missingInputs.includes("casePack")) missingInputs.push("casePack");
  }

  if (invalidInputs.length > 0) {
    return makeResult({
      status: "invalid_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }

  if (baseMetrics.avgDailyDemand === null) {
    return makeResult({
      status: "insufficient_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }

  if (baseMetrics.avgDailyDemand === 0) {
    reasons.add("NO_DEMAND_SIGNAL");
    const overstock =
      baseMetrics.targetStock !== null &&
      baseMetrics.availableStock !== null &&
      baseMetrics.availableStock > baseMetrics.targetStock;
    if (overstock) reasons.add("OVERSTOCK");
    const missingCritical = baseMetrics.targetStock === null;
    return makeResult({
      status: missingCritical ? "insufficient_data" : "evaluated",
      posture: overstock ? "overstock" : missingCritical ? "insufficient_data" : "no_demand",
      qualityLevel: missingInputs.length > 0 ? "degraded" : "complete",
      recommendation: {
        ...emptyRecommendation(),
        rawSuggestedQuantity: 0,
        roundedSuggestedQuantity: 0,
      },
    });
  }

  if (baseMetrics.leadTimeDays === null || baseMetrics.safetyStock === null) {
    return makeResult({
      status: "insufficient_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }

  const reorder = calculateDeterministicReorderPoint({
    avgDailyDemand: baseMetrics.avgDailyDemand,
    leadTimeDays: baseMetrics.leadTimeDays,
    safetyStock: baseMetrics.safetyStock,
  });
  if (!reorder) {
    reasons.add("EXTREME_NUMERIC_VALUE");
    invalidInputs.push("derivedReorderPoint");
    return makeResult({
      status: "invalid_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }
  baseMetrics.demandDuringLeadTime = reorder.demandDuringLeadTime;
  baseMetrics.calculatedReorderPoint = reorder.reorderPoint;
  baseMetrics.daysOfCover = calculateDaysOfCover(
    baseMetrics.availableStock!,
    baseMetrics.avgDailyDemand,
  );

  if (
    baseMetrics.configuredReorderPoint !== null &&
    baseMetrics.configuredReorderPoint !== baseMetrics.calculatedReorderPoint
  ) {
    reasons.add("CONFIGURED_REORDER_POINT_MISMATCH");
  }
  if (
    baseMetrics.targetStock !== null &&
    baseMetrics.targetStock < baseMetrics.calculatedReorderPoint
  ) {
    reasons.add("INVALID_POLICY");
    reasons.add("TARGET_BELOW_REORDER_POINT");
    invalidInputs.push("targetStock");
    return makeResult({
      status: "invalid_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }

  const available = baseMetrics.availableStock!;
  if (available === 0) reasons.add("STOCKOUT");
  if (baseMetrics.daysOfCover !== null && baseMetrics.daysOfCover < baseMetrics.leadTimeDays) {
    reasons.add("STOCKOUT_RISK");
    reasons.add("LOW_COVER");
  }
  if (available <= baseMetrics.calculatedReorderPoint) reasons.add("REORDER_NEEDED");
  if (baseMetrics.targetStock !== null && available > baseMetrics.targetStock) {
    reasons.add("OVERSTOCK");
  }

  if (baseMetrics.targetStock === null) {
    return makeResult({
      status: "insufficient_data",
      posture: "insufficient_data",
      qualityLevel: "insufficient",
    });
  }

  const reorderNeeded = reasons.has("REORDER_NEEDED");
  const rawSuggestedQuantity = reorderNeeded ? Math.max(baseMetrics.targetStock - available, 0) : 0;
  let recommendation: InventoryRecommendationContract = {
    rawSuggestedQuantity,
    roundedSuggestedQuantity: reorderNeeded ? null : 0,
    minimumOrderQuantityApplied: false,
    casePackRoundingApplied: false,
    createsPurchaseOrder: false,
  };
  if (reorderNeeded && baseMetrics.minimumOrderQuantity !== null && baseMetrics.casePack !== null) {
    const rounded = roundAdvisoryReorderQuantity({
      rawSuggestedQuantity,
      minimumOrderQuantity: baseMetrics.minimumOrderQuantity,
      casePack: baseMetrics.casePack,
    });
    if (!rounded) {
      reasons.add("EXTREME_NUMERIC_VALUE");
      invalidInputs.push("roundedSuggestedQuantity");
      return makeResult({
        status: "invalid_data",
        posture: "insufficient_data",
        qualityLevel: "insufficient",
      });
    }
    if (rounded.minimumOrderQuantityApplied) reasons.add("MOQ_APPLIED");
    if (rounded.casePackRoundingApplied) reasons.add("CASE_PACK_ROUNDING_APPLIED");
    recommendation = { ...rounded, rawSuggestedQuantity, createsPurchaseOrder: false };
  }

  const missingRoundingTerms =
    reorderNeeded && (baseMetrics.minimumOrderQuantity === null || baseMetrics.casePack === null);
  const posture: InventoryIntelligenceResult["posture"] = reasons.has("STOCKOUT")
    ? "stockout"
    : reasons.has("OVERSTOCK")
      ? "overstock"
      : reasons.has("LOW_COVER")
        ? "low_cover"
        : reasons.has("REORDER_NEEDED")
          ? "reorder_needed"
          : "healthy";

  return makeResult({
    status: missingRoundingTerms ? "insufficient_data" : "evaluated",
    posture,
    qualityLevel: missingRoundingTerms
      ? "insufficient"
      : missingInputs.length > 0 || reasons.has("CONFIGURED_REORDER_POINT_MISMATCH")
        ? "degraded"
        : "complete",
    recommendation,
  });
}
