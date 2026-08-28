/**
 * Payment-state policy shared by the Stripe adapter and its tests.
 *
 * Stripe is the payment truth.  This module deliberately never treats a
 * browser redirect as an input: only a verified provider event can return a
 * mutation.  The policy is monotonic so delayed events cannot regress a paid
 * or refunded attempt.
 */
export type CanonicalPaymentStatus =
  | "pending"
  | "under_review"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type StripeWebhookKind =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "checkout.session.expired"
  | "charge.refunded";

export type StripeWebhookProjection = {
  type: StripeWebhookKind;
  /** Checkout's signed payment_status, when the event object is a Session. */
  checkoutPaymentStatus?: "paid" | "unpaid" | "no_payment_required";
  /** Stripe reports a cumulative amount on charge.refunded. */
  refundedAmountAed?: number;
  amountAed: number;
};

export type PaymentTransition = {
  next: CanonicalPaymentStatus;
  /** A partial refund remains a paid payment with an audited refunded amount. */
  refundedAmountAed?: number;
};

const terminal = new Set<CanonicalPaymentStatus>(["refunded"]);

export function transitionFromVerifiedStripeEvent(
  current: CanonicalPaymentStatus,
  event: StripeWebhookProjection,
): PaymentTransition | null {
  // A late success/failure/expiry event must never resurrect a terminal state.
  if (terminal.has(current) && event.type !== "charge.refunded") return null;

  switch (event.type) {
    case "checkout.session.completed":
      if (event.checkoutPaymentStatus === "paid")
        return current === "paid" ? null : { next: "paid" };
      if (event.checkoutPaymentStatus === "unpaid") {
        return current === "pending" ? { next: "under_review" } : null;
      }
      return null;
    case "checkout.session.async_payment_succeeded":
      return current === "paid" ? null : { next: "paid" };
    case "checkout.session.async_payment_failed":
      // Payment success wins over a delayed failure notification.
      return current === "paid" ? null : { next: "failed" };
    case "checkout.session.expired":
      return current === "paid" ? null : { next: "cancelled" };
    case "charge.refunded": {
      if (!Number.isFinite(event.refundedAmountAed) || event.refundedAmountAed! < 0) return null;
      if (event.refundedAmountAed! >= event.amountAed) {
        return current === "refunded"
          ? null
          : { next: "refunded", refundedAmountAed: event.amountAed };
      }
      // The existing CornerMex order model has no partial_refunded status.
      // Preserve paid truth and store the cumulative provider refund amount.
      return { next: "paid", refundedAmountAed: event.refundedAmountAed };
    }
  }
}

export type PaymentReconciliationInput = {
  orderPaymentStatus: CanonicalPaymentStatus;
  orderTotalAed: number;
  paymentMethod?: string | null;
  attempts: Array<{
    provider: string;
    providerReference: string | null;
    status: CanonicalPaymentStatus;
    amountAed: number;
    refundedAmountAed?: number;
  }>;
};

export function reconcilePaymentState(input: PaymentReconciliationInput): string[] {
  const issues: string[] = [];
  const stripeAttempts = input.attempts.filter((attempt) => attempt.provider === "stripe");
  const paid = stripeAttempts.filter((attempt) => attempt.status === "paid");
  const refunded = stripeAttempts.filter((attempt) => attempt.status === "refunded");
  if (stripeAttempts.some((attempt) => !attempt.providerReference))
    issues.push("missing_provider_reference");
  if (paid.length > 1) issues.push("multiple_paid_attempts");
  if (paid.some((attempt) => Math.abs(attempt.amountAed - input.orderTotalAed) > 0.001)) {
    issues.push("paid_amount_drift");
  }
  if (paid.length > 0 && input.orderPaymentStatus !== "paid")
    issues.push("order_payment_status_drift");
  if (input.paymentMethod === "card" && input.orderPaymentStatus === "paid" && paid.length === 0) {
    issues.push("missing_paid_attempt");
  }
  if (refunded.length > 0 && input.orderPaymentStatus !== "refunded") {
    issues.push("refund_status_drift");
  }
  if (
    input.paymentMethod === "card" &&
    input.orderPaymentStatus === "refunded" &&
    refunded.length === 0
  ) {
    issues.push("missing_refunded_attempt");
  }
  if (stripeAttempts.some((attempt) => (attempt.refundedAmountAed ?? 0) > attempt.amountAed)) {
    issues.push("refund_amount_drift");
  }
  return issues;
}
