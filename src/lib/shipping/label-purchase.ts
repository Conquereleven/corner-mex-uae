// Buying a label exactly once.
//
// A label costs money and cannot be un-bought by retrying harder. Three rules:
//
//   1. No label before payment. `purchaseLabelOnce` refuses unless the caller
//      asserts the order is paid (or that a business rule — e.g. an approved
//      cash-on-delivery order — explicitly permits shipping first).
//   2. One label per order. A reservation is recorded BEFORE the provider is
//      called; a second attempt for the same order finds it and stops.
//   3. An unknown outcome is not a failure. If the provider call times out or
//      answers 5xx/409, the reservation stays `LABEL_PENDING` and the order is
//      flagged for reconciliation. It is resolved by asking the provider, never
//      by buying again with a fresh rate.
//
// Reconciliation uses the provider's own idempotency: both Skydropx and Solo
// Envíos document `unique_shipment: true`, which replays the original response
// for a repeated `rate_id` ("evitando envíos duplicados", cache 96 h). Repeating
// the identical request is therefore the provider-sanctioned lookup; when a
// provider shipment id is already known, GET /shipments/{id} is used instead.

import {
  ShippingError,
  type CreateShipmentRequest,
  type NormalizedShipment,
  type ShippingProvider,
  type ShippingProviderId,
} from "./types.ts";

export type LabelReservationState = "RESERVED" | "PURCHASED" | "AMBIGUOUS" | "FAILED";

export type LabelReservation = {
  orderReference: string;
  provider: ShippingProviderId;
  providerRateId: string;
  state: LabelReservationState;
  providerShipmentId: string | null;
};

/**
 * Storage contract. `reserve` must be atomic — a unique constraint on the order
 * reference — so two workers cannot both reserve the same order.
 */
export interface LabelLedger {
  find(orderReference: string): Promise<LabelReservation | null>;
  /** Resolves false when a reservation for this order already exists. */
  reserve(reservation: LabelReservation): Promise<boolean>;
  update(
    orderReference: string,
    patch: Partial<Pick<LabelReservation, "state" | "providerShipmentId">>,
  ): Promise<void>;
}

export type LabelPurchaseResult =
  | { outcome: "PURCHASED"; shipment: NormalizedShipment }
  | { outcome: "ALREADY_PURCHASED"; providerShipmentId: string }
  | { outcome: "AMBIGUOUS"; reason: string }
  | { outcome: "IN_PROGRESS" };

export type PaymentAssertion =
  | { kind: "PAID" }
  /** e.g. an approved cash-on-delivery order. Names the rule for the audit log. */
  | { kind: "SHIP_BEFORE_PAYMENT_PERMITTED"; rule: string };

/** True only when buying real carrier labels has been switched on by name. */
export function isRealShippingPurchaseEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.CORNERMEX_REAL_SHIPPING_PURCHASE_ENABLED === "true";
}

export async function purchaseLabelOnce(input: {
  provider: ShippingProvider;
  ledger: LabelLedger;
  request: CreateShipmentRequest;
  payment: PaymentAssertion | null;
  /**
   * The deployment's kill switch (isRealShippingPurchaseEnabled). There is no
   * default: a caller must state it, and `false` buys nothing.
   */
  purchaseEnabled: boolean;
}): Promise<LabelPurchaseResult> {
  const { provider, ledger, request, payment } = input;
  if (input.purchaseEnabled !== true) throw new Error("LABEL_PURCHASE_DISABLED");
  if (!payment) throw new Error("LABEL_PURCHASE_REQUIRES_CONFIRMED_PAYMENT");

  const existing = await ledger.find(request.orderReference);
  if (existing) return describe(existing);

  const reserved = await ledger.reserve({
    orderReference: request.orderReference,
    provider: provider.id,
    providerRateId: request.providerRateId,
    state: "RESERVED",
    providerShipmentId: null,
  });
  if (!reserved) {
    // Lost a race with another worker; report whatever it has done so far.
    const winner = await ledger.find(request.orderReference);
    return winner ? describe(winner) : { outcome: "IN_PROGRESS" };
  }

  try {
    const shipment = await provider.createShipment(request);
    await ledger.update(request.orderReference, {
      state: "PURCHASED",
      providerShipmentId: shipment.providerShipmentId,
    });
    return { outcome: "PURCHASED", shipment };
  } catch (error) {
    if (error instanceof ShippingError && error.code === "AMBIGUOUS_WRITE") {
      await ledger.update(request.orderReference, { state: "AMBIGUOUS" });
      return { outcome: "AMBIGUOUS", reason: error.message };
    }
    // A definite rejection: no label exists, so the order may be re-quoted.
    await ledger.update(request.orderReference, { state: "FAILED" });
    throw error;
  }
}

function describe(reservation: LabelReservation): LabelPurchaseResult {
  if (reservation.state === "PURCHASED" && reservation.providerShipmentId) {
    return { outcome: "ALREADY_PURCHASED", providerShipmentId: reservation.providerShipmentId };
  }
  if (reservation.state === "AMBIGUOUS") {
    return { outcome: "AMBIGUOUS", reason: "an earlier purchase has an unknown outcome" };
  }
  if (reservation.state === "FAILED") {
    // The caller must clear the failed reservation deliberately (re-quote)
    // before another purchase; it is never retried implicitly.
    return { outcome: "AMBIGUOUS", reason: "an earlier purchase failed and was not cleared" };
  }
  return { outcome: "IN_PROGRESS" };
}

/**
 * Resolves an AMBIGUOUS reservation by asking the provider what happened.
 *
 * The request passed in must be the ORIGINAL request — same rate id — so the
 * provider's idempotent replay returns the original shipment instead of
 * creating one. A reservation whose rate differs from the request is refused.
 */
export async function reconcileAmbiguousLabel(input: {
  provider: ShippingProvider;
  ledger: LabelLedger;
  request: CreateShipmentRequest;
  purchaseEnabled: boolean;
}): Promise<LabelPurchaseResult> {
  const { provider, ledger, request } = input;
  // Reconciling can replay a purchase request, so it obeys the same switch.
  if (input.purchaseEnabled !== true) throw new Error("LABEL_PURCHASE_DISABLED");
  const reservation = await ledger.find(request.orderReference);
  if (!reservation) throw new Error("LABEL_RESERVATION_NOT_FOUND");
  if (reservation.state === "PURCHASED" && reservation.providerShipmentId) {
    return { outcome: "ALREADY_PURCHASED", providerShipmentId: reservation.providerShipmentId };
  }
  if (reservation.state !== "AMBIGUOUS") return describe(reservation);
  if (reservation.providerRateId !== request.providerRateId) {
    throw new Error("LABEL_RECONCILE_RATE_MISMATCH");
  }

  try {
    const shipment = reservation.providerShipmentId
      ? await provider.getShipment(reservation.providerShipmentId)
      : await provider.createShipment(request);
    await ledger.update(request.orderReference, {
      state: "PURCHASED",
      providerShipmentId: shipment.providerShipmentId,
    });
    return { outcome: "PURCHASED", shipment };
  } catch (error) {
    if (error instanceof ShippingError && error.code === "AMBIGUOUS_WRITE") {
      return { outcome: "AMBIGUOUS", reason: error.message };
    }
    throw error;
  }
}
