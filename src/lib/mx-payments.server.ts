// Mexico payments — the server-side bridge between the provider adapters and
// the database (supabase/mx/migrations).
//
// Everything that marks an order paid goes through `reconcileOrderPayment` or
// `handlePaymentWebhook`, and both end in the same place: the payment is read
// from the provider, checked against the order, and applied by one database
// function in one transaction. No request body and no return URL is trusted.

import { isExpectedMarketIdentity, MARKET_DATABASE_MISMATCH } from "../config/market-database.ts";
import {
  processPaymentEventOnce,
  reconcilePayment,
  type PaymentAttempt,
  type PaymentChange,
  type PaymentEventLedger,
  type PaymentReconciliation,
} from "./payments/processor.ts";
import { fromCanonicalStatus, toCanonicalStatus } from "./payments/state.ts";
import type {
  CanonicalPaymentStatus,
  PaymentProvider,
  PaymentProviderId,
  WebhookRequest,
} from "./payments/types.ts";

/** The slice of the Supabase admin client this module needs. */
export type RpcClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type AttemptRow = {
  attempt_id: string;
  order_id: string;
  order_number: string;
  provider: PaymentProviderId;
  provider_payment_id: string | null;
  amount: number | string;
  currency: string;
  status: CanonicalPaymentStatus;
  refunded_amount: number | string;
};

let identityVerified = false;

/**
 * Asks the database which market it is. Cached once it has answered correctly;
 * a wrong or missing answer is never cached, so every call keeps failing.
 */
export async function assertMexicoDatabase(db: RpcClient): Promise<void> {
  if (identityVerified) return;
  const { data, error } = await db.rpc("cm_market_identity_v1");
  if (error || !isExpectedMarketIdentity(data)) {
    throw new Error(`${MARKET_DATABASE_MISMATCH}: database_is_not_a_mexico_database`);
  }
  identityVerified = true;
}

/** Test hook: forget a previously verified identity. */
export function resetMexicoDatabaseVerification(): void {
  identityVerified = false;
}

export function toAttempt(row: AttemptRow): PaymentAttempt | null {
  if (!row?.provider_payment_id) return null;
  const amount = Number(row.amount);
  return {
    orderReference: row.order_number,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    amount,
    currency: row.currency,
    state: fromCanonicalStatus(row.status, {
      hasProviderReference: true,
      amount,
      refundedAmount: Number(row.refunded_amount),
    }),
  };
}

/** Persists a payment change: attempt, order status, confirmation or stock release. */
export async function applyPaymentChange(db: RpcClient, change: PaymentChange): Promise<void> {
  const { error } = await db.rpc("cm_mx_apply_payment_state_v1", {
    p_provider: change.attempt.provider,
    p_provider_payment_id: change.attempt.providerPaymentId,
    p_status: toCanonicalStatus(change.to),
    p_amount: change.payment.amount,
    p_refunded_amount: change.payment.refundedAmount,
    p_raw_status: change.payment.rawStatus,
    p_raw_status_detail: change.payment.rawStatusDetail,
    p_late_capture: change.lateCapture,
  });
  if (error) throw new Error("MX_PAYMENT_APPLY_FAILED");
}

/** A provider record that does not match the order is flagged for a person. */
async function flagRejected(db: RpcClient, attempt: PaymentAttempt): Promise<void> {
  await db.rpc("cm_mx_apply_payment_state_v1", {
    p_provider: attempt.provider,
    p_provider_payment_id: attempt.providerPaymentId,
    p_status: "under_review",
    p_amount: null,
    p_refunded_amount: null,
    p_raw_status: "REJECTED_BY_CORNERMEX",
    p_raw_status_detail: null,
    p_late_capture: false,
  });
}

/** Reads the order's payment from its provider and applies whatever changed. */
export async function reconcileOrderPayment(
  db: RpcClient,
  orderId: string,
  resolveProvider: (id: PaymentProviderId) => PaymentProvider | null,
): Promise<
  PaymentReconciliation | { outcome: "NO_ATTEMPT" } | { outcome: "PROVIDER_UNAVAILABLE" }
> {
  await assertMexicoDatabase(db);
  const { data, error } = await db.rpc("cm_mx_order_payment_attempt_v1", { p_order_id: orderId });
  if (error) throw new Error("MX_PAYMENT_LOOKUP_FAILED");
  const attempt = toAttempt(data as AttemptRow);
  if (!attempt) return { outcome: "NO_ATTEMPT" };
  const provider = resolveProvider(attempt.provider);
  if (!provider) return { outcome: "PROVIDER_UNAVAILABLE" };

  const reconciliation = await reconcilePayment(provider, attempt);
  if (reconciliation.outcome === "CHANGED") await applyPaymentChange(db, reconciliation.change);
  if (reconciliation.outcome === "REJECTED") await flagRejected(db, attempt);
  return reconciliation;
}

function ledgerFor(db: RpcClient): PaymentEventLedger {
  return {
    async claim(record) {
      let payload: unknown = null;
      try {
        payload = JSON.parse(record.raw_payload);
      } catch {
        payload = null;
      }
      const { data, error } = await db.rpc("cm_mx_claim_webhook_event_v1", {
        p_provider: record.provider,
        p_external_event_id: record.external_event_id,
        p_payload_hash: record.payload_hash,
        p_raw_payload: payload,
      });
      if (error) throw new Error("MX_WEBHOOK_LEDGER_FAILED");
      return data === true;
    },
    async complete(provider, externalEventId, status) {
      const { error } = await db.rpc("cm_mx_complete_webhook_event_v1", {
        p_provider: provider,
        p_external_event_id: externalEventId,
        p_status: status === "duplicate" || status === "processing" ? "processed" : status,
      });
      if (error) throw new Error("MX_WEBHOOK_LEDGER_FAILED");
    },
  };
}

export type WebhookResponse = { status: number; body: string };

/**
 * The whole webhook path for one provider: authenticate, parse, process once.
 *
 *   401 — not authentic; nothing is stored
 *   200 — accepted, duplicate, or deliberately ignored
 *   500 — processing failed; the provider's retry will deliver it again
 */
export async function handlePaymentWebhook(input: {
  db: RpcClient;
  provider: PaymentProvider | null;
  request: WebhookRequest;
}): Promise<WebhookResponse> {
  const { db, provider, request } = input;
  // An unconfigured provider cannot authenticate anything, so it accepts nothing.
  if (!provider) return { status: 503, body: "provider_not_configured" };

  const verification = provider.verifyWebhook(request);
  if (!verification.ok) return { status: 401, body: "unauthorized" };

  const event = provider.parseWebhook(request);
  if (!event) return { status: 200, body: "ignored" };

  try {
    await assertMexicoDatabase(db);
    const result = await processPaymentEventOnce({
      provider,
      ledger: ledgerFor(db),
      event,
      rawBody: request.rawBody,
      findAttempt: async (providerPaymentId) => {
        const { data, error } = await db.rpc("cm_mx_payment_attempt_v1", {
          p_provider: provider.id,
          p_provider_payment_id: providerPaymentId,
        });
        if (error) throw new Error("MX_PAYMENT_LOOKUP_FAILED");
        return toAttempt(data as AttemptRow);
      },
      apply: (change) => applyPaymentChange(db, change),
      onRejected: (attempt) => flagRejected(db, attempt),
    });
    return { status: 200, body: result.status };
  } catch {
    return { status: 500, body: "processing_failed" };
  }
}

/** Builds the adapter-facing request from a Fetch API Request. */
export async function toWebhookRequest(request: Request): Promise<WebhookRequest> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return {
    // The exact bytes: signatures and hashes are computed over this string.
    rawBody: await request.text(),
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
  };
}
