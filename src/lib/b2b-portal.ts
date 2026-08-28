export const B2B_PORTAL_MAX_QUANTITY = 100000;

export const B2B_PRICE_STATUSES = ["default", "special_account", "expired_override"] as const;

export type B2bPriceStatus = (typeof B2B_PRICE_STATUSES)[number];

export function hasSpecialAccountPrice(status: B2bPriceStatus) {
  return status === "special_account";
}

export function resolveB2bPricePresentation(input: {
  catalogPriceAed: number;
  overridePriceAed?: number | null;
  overrideActive?: boolean;
  validFrom?: Date | null;
  validUntil?: Date | null;
  now?: Date;
}): {
  catalogPriceAed: number;
  effectivePriceAed: number;
  priceStatus: B2bPriceStatus;
} {
  if (!Number.isFinite(input.catalogPriceAed) || input.catalogPriceAed < 0)
    throw new Error("CM_B2B_CATALOG_PRICE_REQUIRED");

  const now = input.now ?? new Date();
  const hasOverride = input.overridePriceAed !== null && input.overridePriceAed !== undefined;
  const applicable =
    hasOverride &&
    input.overrideActive === true &&
    (!input.validFrom || input.validFrom <= now) &&
    (!input.validUntil || input.validUntil > now);
  const expired =
    hasOverride &&
    (input.overrideActive === false || (!!input.validUntil && input.validUntil <= now));

  return {
    catalogPriceAed: input.catalogPriceAed,
    effectivePriceAed: applicable ? input.overridePriceAed : input.catalogPriceAed,
    priceStatus: applicable ? "special_account" : expired ? "expired_override" : "default",
  };
}

export type B2bAvailabilityStatus = "available" | "partial" | "out_of_stock" | "unavailable";

export function getB2bAvailabilityStatus(input: {
  availableStock: number;
  requestedQuantity?: number;
  sellable?: boolean;
}): B2bAvailabilityStatus {
  if (input.sellable === false) return "unavailable";
  if (!Number.isInteger(input.availableStock) || input.availableStock <= 0) return "out_of_stock";
  if (
    input.requestedQuantity !== undefined &&
    isB2bPortalQuantity(input.requestedQuantity) &&
    input.availableStock < input.requestedQuantity
  )
    return "partial";
  return "available";
}

export function isB2bPortalQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= B2B_PORTAL_MAX_QUANTITY
  );
}

export function canAccessB2bPortalAccount(input: {
  accountId: string;
  memberships: Array<{
    accountId: string;
    membershipStatus: "active" | "inactive";
    accountStatus: "active" | "inactive";
  }>;
}) {
  return input.memberships.some(
    (membership) =>
      membership.accountId === input.accountId &&
      membership.membershipStatus === "active" &&
      membership.accountStatus === "active",
  );
}

export function filterQuickOrderVariants<T extends { active: boolean; productActive: boolean }>(
  variants: T[],
) {
  return variants.filter((variant) => variant.active && variant.productActive);
}

export type ReorderCandidate = {
  variantId: string | null;
  active: boolean;
  productActive: boolean;
  availableStock: number;
  quantity: number;
};

export function buildEligibleReorderIntent(candidates: ReorderCandidate[]) {
  return candidates.filter(
    (candidate) =>
      candidate.variantId !== null &&
      candidate.active &&
      candidate.productActive &&
      Number.isInteger(candidate.availableStock) &&
      candidate.availableStock > 0 &&
      isB2bPortalQuantity(candidate.quantity),
  );
}
