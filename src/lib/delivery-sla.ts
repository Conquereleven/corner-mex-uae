// Delivery timeframes shown to customers. These mirror what the Terms &
// Conditions already promise (src/lib/legal-docs.ts, terms-and-conditions
// §1a: "standard UAE 2-5 business days, remote areas +1-3 business days,
// subject to courier capacity and force majeure"). A test keeps the two in
// agreement, so the storefront can never promise something the Terms do not.
//
// The Terms also mention an express 1-2 day service. Checkout offers no express
// option, so it is deliberately not displayed.
export const STANDARD_DELIVERY_BUSINESS_DAYS = Object.freeze({ min: 2, max: 5 });
export const REMOTE_AREA_EXTRA_BUSINESS_DAYS = Object.freeze({ min: 1, max: 3 });

const range = ({ min, max }: { min: number; max: number }) => `${min}–${max}`;

/** e.g. "Estimated delivery: 2–5 business days (remote areas +1–3), subject to courier capacity." */
export function deliveryEstimateText(): string {
  return `Estimated delivery: ${range(STANDARD_DELIVERY_BUSINESS_DAYS)} business days (remote areas +${range(
    REMOTE_AREA_EXTRA_BUSINESS_DAYS,
  )}), subject to courier capacity.`;
}
