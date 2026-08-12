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
