// Applying a payment event exactly once, from the provider's own answer.
//
// A webhook body — even a correctly signed one — is treated as a notification
// that something changed, not as the change itself:
//
//   1. claim the event in the ledger (unique on provider + event id); a
//      duplicate stops here
//   2. re-read the payment from the provider
//   3. check it is the payment CornerMex created for this order, for exactly the
//      order's total, in the order's currency
//   4. compute the state transition
//   5. hand the transition to the order layer in one call
//
// The same function serves the return URL: a browser landing on "success" calls
// `reconcilePayment`, which goes to the provider. Nothing a browser sends can
// mark an order paid.

import { amountsMatch, nextPaymentState, orderEffectOf } from "./state.ts";
import {
  PaymentError,
  type NormalizedPayment,
  type PaymentEvent,
  type PaymentProvider,
  type PaymentProviderId,
  type PaymentState,
} from "./types.ts";

/** What CornerMex recorded when it created the payment attempt. */
export type PaymentAttempt = {
  orderReference: string;
  provider: PaymentProviderId;
  providerPaymentId: string;
  /** The order total, from the database. */
  amount: number;
  currency: string;
  state: PaymentState;
};

export type EventProcessingStatus = "processing" | "processed" | "duplicate" | "ignored" | "failed";

export type PaymentEventRecord = {
  provider: PaymentProviderId;
  external_event_id: string;
  payload_hash: string;
  raw_payload: string;
  received_at: string;
  processed_at: string | null;
  processing_status: EventProcessingStatus;
};

/** Storage contract; the unique constraint behind `claim` is what makes replay safe. */
export interface PaymentEventLedger {
  /** True when the event is new, or its only earlier attempt ended `failed`. */
  claim(record: PaymentEventRecord): Promise<boolean>;
  complete(
    provider: PaymentProviderId,
    externalEventId: string,
    status: EventProcessingStatus,
    processedAt: string,
  ): Promise<void>;
}

export type PaymentChange = {
  attempt: PaymentAttempt;
  payment: NormalizedPayment;
  from: PaymentState;
  to: PaymentState;
  /** Money arrived for an attempt that had already failed or been cancelled. */
  lateCapture: boolean;
  fulfillmentEligible: boolean;
  releaseStock: boolean;
};

export type PaymentReconciliation =
  | { outcome: "UNCHANGED"; state: PaymentState }
  | { outcome: "CHANGED"; change: PaymentChange }
  /** The provider's record does not match the order. Nothing is applied. */
  | { outcome: "REJECTED"; reason: "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "REFERENCE_MISMATCH" };

/**
 * Reads the payment from the provider and works out what, if anything, changed.
 * Pure with respect to storage: the caller persists `change` atomically.
 */
export async function reconcilePayment(
  provider: PaymentProvider,
  attempt: PaymentAttempt,
): Promise<PaymentReconciliation> {
  const payment = await provider.getPayment(attempt.providerPaymentId);

  // Only checked when the provider reports it; never weakened by its absence
  // for the amount, which must always be present before money is accepted.
  if (payment.externalReference !== null && payment.externalReference !== attempt.orderReference) {
    return { outcome: "REJECTED", reason: "REFERENCE_MISMATCH" };
  }
  const acceptsMoney =
    payment.state === "PAID" ||
    payment.state === "AUTHORIZED" ||
    payment.state === "PARTIALLY_REFUNDED";
  if (acceptsMoney) {
    if (!amountsMatch(attempt.amount, payment.amount)) {
      return { outcome: "REJECTED", reason: "AMOUNT_MISMATCH" };
    }
    if (payment.currency !== null && payment.currency !== attempt.currency) {
      return { outcome: "REJECTED", reason: "CURRENCY_MISMATCH" };
    }
  }

  const transition = nextPaymentState(attempt.state, payment.state);
  if (!transition.changed) return { outcome: "UNCHANGED", state: attempt.state };
  const effect = orderEffectOf(transition.state);
  return {
    outcome: "CHANGED",
    change: {
      attempt,
      payment,
      from: attempt.state,
      to: transition.state,
      lateCapture: transition.lateCapture,
      // A late capture is real money on a cancelled order: a person decides.
      fulfillmentEligible: effect.fulfillmentEligible && !transition.lateCapture,
      releaseStock: effect.releaseStock,
    },
  };
}

export type ProcessedEvent =
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | { status: "processed"; reconciliation: PaymentReconciliation };

/**
 * Processes a verified webhook event at most once.
 *
 * `findAttempt` looks the attempt up by the provider's payment id; an event for
 * a payment CornerMex never created is ignored. `apply` persists a change.
 */
export async function processPaymentEventOnce(input: {
  provider: PaymentProvider;
  ledger: PaymentEventLedger;
  event: PaymentEvent;
  rawBody: string;
  findAttempt: (providerPaymentId: string) => Promise<PaymentAttempt | null>;
  apply: (change: PaymentChange) => Promise<void>;
  onRejected?: (attempt: PaymentAttempt, reason: string) => Promise<void>;
  now?: () => Date;
}): Promise<ProcessedEvent> {
  const { provider, ledger, event } = input;
  const now = input.now ?? (() => new Date());
  if (event.provider !== provider.id)
    throw new PaymentError("INVALID_REQUEST", "provider mismatch");

  const claimed = await ledger.claim({
    provider: event.provider,
    external_event_id: event.externalEventId,
    payload_hash: event.payloadHash,
    raw_payload: input.rawBody,
    received_at: now().toISOString(),
    processed_at: null,
    processing_status: "processing",
  });
  if (!claimed) return { status: "duplicate" };

  const finish = (status: EventProcessingStatus) =>
    ledger.complete(event.provider, event.externalEventId, status, now().toISOString());

  try {
    const attempt = await input.findAttempt(event.providerPaymentId);
    if (!attempt) {
      await finish("ignored");
      return { status: "ignored", reason: "unknown_payment" };
    }
    const reconciliation = await reconcilePayment(provider, attempt);
    if (reconciliation.outcome === "CHANGED") await input.apply(reconciliation.change);
    if (reconciliation.outcome === "REJECTED") {
      await input.onRejected?.(attempt, reconciliation.reason);
    }
    await finish("processed");
    return { status: "processed", reconciliation };
  } catch (error) {
    // Left `failed` so the provider's retry can finish the job.
    await finish("failed");
    throw error;
  }
}
