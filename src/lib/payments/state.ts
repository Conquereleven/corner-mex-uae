// Payment state machine.
//
// One rule set for every provider. A transition is only ever computed from a
// payment the server READ from the provider (or from a verified event followed
// by that read) — never from a browser return URL.
//
// The eight normalised states are a view over the canonical stored statuses.
// PARTIALLY_REFUNDED is stored as `paid` plus a refunded amount, exactly as the
// existing payment model already does; CREATED and PENDING are both `pending`.

import type { CanonicalPaymentStatus, PaymentState } from "./types.ts";

export function toCanonicalStatus(state: PaymentState): CanonicalPaymentStatus {
  switch (state) {
    case "CREATED":
    case "PENDING":
      return "pending";
    case "AUTHORIZED":
      return "authorized";
    case "PAID":
    case "PARTIALLY_REFUNDED":
      return "paid";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
  }
}

/** Reads a stored status (plus refunded amount) back into the normalised view. */
export function fromCanonicalStatus(
  status: CanonicalPaymentStatus,
  context: { hasProviderReference: boolean; amount: number; refundedAmount: number },
): PaymentState {
  switch (status) {
    case "pending":
    case "under_review":
      return context.hasProviderReference ? "PENDING" : "CREATED";
    case "authorized":
      return "AUTHORIZED";
    case "paid":
      return context.refundedAmount > 0 && context.refundedAmount < context.amount
        ? "PARTIALLY_REFUNDED"
        : "PAID";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "refunded":
      return "REFUNDED";
  }
}

const states = (...values: PaymentState[]): ReadonlySet<PaymentState> => new Set(values);

const ALLOWED: Readonly<Record<PaymentState, ReadonlySet<PaymentState>>> = Object.freeze({
  CREATED: states("PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED"),
  PENDING: states("AUTHORIZED", "PAID", "FAILED", "CANCELLED"),
  AUTHORIZED: states("PAID", "FAILED", "CANCELLED"),
  // Money was received: the only way out is a refund.
  PAID: states("PARTIALLY_REFUNDED", "REFUNDED"),
  PARTIALLY_REFUNDED: states("PARTIALLY_REFUNDED", "REFUNDED"),
  // A failed or cancelled attempt can still turn out paid (a late capture, a
  // cash payment made after expiry). That is real money and must be recorded;
  // the order layer flags it for a person instead of shipping automatically.
  FAILED: states("PAID"),
  CANCELLED: states("PAID"),
  REFUNDED: states(),
});

export type PaymentTransition =
  | { changed: false; state: PaymentState }
  | { changed: true; state: PaymentState; lateCapture: boolean };

/**
 * The state a payment holds after an observed provider state. A stale, repeated
 * or backwards observation changes nothing.
 */
export function nextPaymentState(
  current: PaymentState,
  observed: PaymentState | null,
): PaymentTransition {
  if (observed === null || observed === current) {
    // A further partial refund keeps the state but is still an update.
    return { changed: false, state: current };
  }
  if (!ALLOWED[current].has(observed)) return { changed: false, state: current };
  return {
    changed: true,
    state: observed,
    lateCapture: observed === "PAID" && (current === "FAILED" || current === "CANCELLED"),
  };
}

/** What the order may do once its payment is in a given state. */
export function orderEffectOf(state: PaymentState): {
  /** Stock may be handed to fulfilment and a label may be bought. */
  fulfillmentEligible: boolean;
  /** The order should be cancelled and its stock released. */
  releaseStock: boolean;
} {
  return {
    fulfillmentEligible: state === "PAID",
    releaseStock: state === "FAILED" || state === "CANCELLED",
  };
}

/** Amounts are compared in integer cents, so 0.1 + 0.2 never fails a match. */
export function amountsMatch(expected: number, actual: number | null): boolean {
  if (actual === null || !Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.round(expected * 100) === Math.round(actual * 100);
}

/** Provider amounts are sent as strings with exactly two decimals. */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("PAYMENT_AMOUNT_INVALID");
  return (Math.round(amount * 100) / 100).toFixed(2);
}
