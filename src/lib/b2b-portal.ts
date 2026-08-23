export const B2B_PORTAL_MAX_QUANTITY = 100000;

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
