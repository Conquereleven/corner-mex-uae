export const ORDER_STATES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const PAYMENT_STATES = [
  "pending",
  "under_review",
  "paid",
  "failed",
  "refunded",
  "cancelled",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];
export type PaymentState = (typeof PAYMENT_STATES)[number];
export type LifecycleTransitionType = "order_status" | "payment_status";

export const ORDER_TRANSITIONS: Readonly<Record<OrderState, readonly OrderState[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// CM-COM-4A supports manual Cash on Delivery lifecycle only. A COD payment can
// be reviewed, confirmed as collected, failed or cancelled. Refund is possible
// only after collection; terminal states never move backwards.
export const COD_PAYMENT_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  pending: ["under_review", "paid", "failed", "cancelled"],
  under_review: ["paid", "failed", "cancelled"],
  paid: ["refunded"],
  failed: ["under_review", "cancelled"],
  refunded: [],
  cancelled: [],
};

// Third lifecycle authority: a transition is valid only when both the
// individual state machine and this resulting COD pair allow it. Pending COD
// collection may remain open after cancellation, but it can then only move to
// a compatible failed/cancelled outcome. Collection and refund remain valid
// for fulfilled orders.
export const COD_COMBINED_STATES: Readonly<Record<OrderState, readonly PaymentState[]>> = {
  pending: ["pending", "under_review", "failed", "cancelled"],
  confirmed: ["pending", "under_review", "paid"],
  processing: ["pending", "under_review", "paid"],
  shipped: ["pending", "under_review", "paid"],
  delivered: ["paid", "refunded"],
  cancelled: ["pending", "failed", "refunded", "cancelled"],
};

export function isOrderState(value: string): value is OrderState {
  return (ORDER_STATES as readonly string[]).includes(value);
}

export function isPaymentState(value: string): value is PaymentState {
  return (PAYMENT_STATES as readonly string[]).includes(value);
}

export function allowedOrderTransitions(current: string): readonly OrderState[] {
  return isOrderState(current) ? ORDER_TRANSITIONS[current] : [];
}

export function allowedPaymentTransitions(
  current: string,
  paymentMethod: string | null,
): readonly PaymentState[] {
  if (paymentMethod !== "cod" || !isPaymentState(current)) return [];
  return COD_PAYMENT_TRANSITIONS[current];
}

export function isCodLifecyclePairCompatible(orderState: string, paymentState: string): boolean {
  return (
    isOrderState(orderState) &&
    isPaymentState(paymentState) &&
    COD_COMBINED_STATES[orderState].includes(paymentState)
  );
}

export function allowedCompatibleOrderTransitions(
  currentOrder: string,
  currentPayment: string,
  paymentMethod: string | null,
): readonly OrderState[] {
  if (paymentMethod !== "cod") return [];
  return allowedOrderTransitions(currentOrder).filter((next) =>
    isCodLifecyclePairCompatible(next, currentPayment),
  );
}

export function allowedCompatiblePaymentTransitions(
  currentOrder: string,
  currentPayment: string,
  paymentMethod: string | null,
): readonly PaymentState[] {
  return allowedPaymentTransitions(currentPayment, paymentMethod).filter((next) =>
    isCodLifecyclePairCompatible(currentOrder, next),
  );
}
