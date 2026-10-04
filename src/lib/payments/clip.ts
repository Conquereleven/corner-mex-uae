// Clip adapter — Redirected Checkout ("Checkout Redireccionado").
//
// Source: developer.clip.mx, read 2026-10-05.
//
// Why redirected checkout: the customer pays on Clip's hosted page, so no card
// data touches CornerMex. Clip's Transparent Checkout takes card data inside the
// merchant's page and carries PCI obligations; it is NOT implemented and must
// not be described as available.
//
// Contract relied on:
//   POST https://api.payclip.com/v2/checkout
//     header: Authorization: Basic base64(<api key>:<secret>)
//     body:   { amount, currency: "MXN", purchase_description,
//               redirection_url: { success, error, default },
//               metadata: { external_reference (max 36 chars) }, webhook_url }
//     reply:  { payment_request_id, payment_request_url, status, … }
//             status: CHECKOUT_CREATED | CHECKOUT_PENDING | CHECKOUT_COMPLETED |
//                     CHECKOUT_CANCELLED | CHECKOUT_EXPIRED
//   Status lookup: the reconciliation guide documents a GET on the Checkout API
//     to consult a payment link; it is implemented as GET /v2/checkout/{id} and
//     that path must be confirmed against a real account.
//   Checkout webhook: { id, payment_request_id, resource: "CHECKOUT" | "REFUND",
//     resource_status: CREATED | PENDING | COMPLETED | CANCELED | EXPIRED,
//     me_reference_id, receipt_no, … }
//
// Two facts from the documentation shape this adapter:
//   1. The Checkout webhook carries NO signature. An event is therefore only a
//      hint: it is authenticated by an unguessable token CornerMex put in the
//      webhook URL, and then the payment is re-read from Clip before anything
//      is applied.
//   2. Clip's test credentials do not cover Redirected Checkout ("Cualquier otra
//      API que no se encuentre en esta lista no funcionará en el modo de
//      prueba"). There is no sandbox for this flow: it can only be verified with
//      a real, identity-verified Clip account.
//
// Capability level: SCAFFOLDED — no request has been sent to Clip.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { number, send, text, type HttpOptions, type Json } from "./http.ts";
import {
  PaymentError,
  type NormalizedPayment,
  type PaymentEvent,
  type PaymentProvider,
  type PaymentState,
  type ProviderEnvironment,
  type WebhookRequest,
  type WebhookVerification,
} from "./types.ts";

export const CLIP_API = "https://api.payclip.com";

export type ClipConfig = {
  environment: ProviderEnvironment;
  apiKey: string;
  apiSecret: string;
  /** CornerMex-side secret used to mint the token carried in the webhook URL. */
  webhookSecret?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

const STATUS: Readonly<Record<string, PaymentState>> = Object.freeze({
  CHECKOUT_CREATED: "CREATED",
  CHECKOUT_PENDING: "PENDING",
  CHECKOUT_COMPLETED: "PAID",
  CHECKOUT_CANCELLED: "CANCELLED",
  CHECKOUT_CANCELED: "CANCELLED",
  CHECKOUT_EXPIRED: "CANCELLED",
  // Webhook `resource_status` uses the same words without the prefix.
  CREATED: "CREATED",
  PENDING: "PENDING",
  COMPLETED: "PAID",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  EXPIRED: "CANCELLED",
});

export function mapClipStatus(raw: unknown): PaymentState | null {
  return typeof raw === "string" ? (STATUS[raw.trim().toUpperCase()] ?? null) : null;
}

/** The token CornerMex appends to the webhook URL for one order reference. */
export function clipWebhookToken(orderReference: string, secret: string): string {
  return createHmac("sha256", secret).update(`clip:${orderReference}`).digest("hex");
}

export function createClipProvider(config: ClipConfig): PaymentProvider {
  const provider = "clip" as const;
  const base = (config.baseUrl ?? CLIP_API).replace(/\/+$/, "");
  const http: HttpOptions = {
    provider,
    fetch: config.fetch ?? fetch,
    timeoutMs: config.timeoutMs ?? 20_000,
    sleep: config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  };
  const auth = {
    Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`,
  };

  function normalize(json: Json, replayed = false): NormalizedPayment {
    const id = text(json.payment_request_id);
    if (!id) {
      throw new PaymentError("PROVIDER_ERROR", "checkout response carried no payment_request_id", {
        provider,
      });
    }
    const metadata = (json.metadata ?? {}) as Json;
    return {
      provider,
      providerPaymentId: id,
      externalReference: text(metadata.external_reference) ?? text(json.me_reference_id),
      state: mapClipStatus(json.status),
      rawStatus: text(json.status),
      rawStatusDetail: text(json.last_status_message),
      amount: number(json.amount),
      currency: text(json.currency),
      refundedAmount: 0,
      redirectUrl: text(json.payment_request_url),
      instructions: null,
      replayed,
    };
  }

  return {
    id: provider,
    supports: ["redirect"],

    async createPayment(request) {
      if (request.method.kind !== "redirect") {
        // Anything else would mean handling card data inside CornerMex.
        throw new PaymentError("NOT_SUPPORTED", "only redirected checkout is implemented", {
          provider,
        });
      }
      if (request.orderReference.length > 36) {
        throw new PaymentError("INVALID_REQUEST", "external reference exceeds 36 characters", {
          provider,
        });
      }
      if (!(request.amount >= 1)) {
        throw new PaymentError("INVALID_REQUEST", "amount is below the provider minimum", {
          provider,
        });
      }
      const amount = Math.round(request.amount * 100) / 100;
      const { json } = await send(http, {
        method: "POST",
        url: `${base}/v2/checkout`,
        // The reference documents no idempotency header for this endpoint, so an
        // unknown outcome is never retried: it is resolved by lookup.
        kind: "money",
        headers: { ...auth, "Content-Type": "application/json" },
        body: {
          amount,
          currency: request.currency,
          purchase_description: request.description.slice(0, 250),
          redirection_url: {
            success: request.returnUrls.success,
            error: request.returnUrls.failure,
            default: request.returnUrls.pending,
          },
          metadata: {
            external_reference: request.orderReference,
            customer_info: { email: request.payer.email },
          },
          ...(request.webhookUrl ? { webhook_url: request.webhookUrl } : {}),
        },
      });
      const payment = normalize(json);
      if (!payment.redirectUrl) {
        throw new PaymentError("PROVIDER_ERROR", "checkout response carried no payment URL", {
          provider,
        });
      }
      // The create response does not always echo the amount; it is checked again
      // on every status read before a payment is accepted.
      return {
        ...payment,
        amount: payment.amount ?? amount,
        currency: payment.currency ?? request.currency,
      };
    },

    async getPayment(providerPaymentId) {
      const { json } = await send(http, {
        method: "GET",
        url: `${base}/v2/checkout/${encodeURIComponent(providerPaymentId)}`,
        kind: "read",
        headers: auth,
      });
      return normalize(json);
    },

    async cancelPayment() {
      // A payment link expires on its own; the Checkout API documents no cancel.
      throw new PaymentError("NOT_SUPPORTED", "Clip payment links cannot be cancelled by API", {
        provider,
      });
    },

    async refund() {
      // Clip's Refunds API works on a transaction receipt number, which only
      // exists after a completed payment. Not wired until verified on an account.
      throw new PaymentError("NOT_SUPPORTED", "Clip refunds are not implemented yet", {
        provider,
      });
    },

    verifyWebhook(request: WebhookRequest): WebhookVerification {
      if (!config.webhookSecret) return { ok: false, reason: "webhook_secret_not_configured" };
      const token = request.query.token;
      const reference = request.query.ref;
      if (!token || !reference) return { ok: false, reason: "webhook_token_missing" };
      const expected = Buffer.from(clipWebhookToken(reference, config.webhookSecret), "hex");
      const received = /^[0-9a-f]+$/i.test(token) ? Buffer.from(token, "hex") : Buffer.alloc(0);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        return { ok: false, reason: "webhook_token_mismatch" };
      }
      return { ok: true };
    },

    parseWebhook(request: WebhookRequest): PaymentEvent | null {
      let body: Json;
      try {
        body = JSON.parse(request.rawBody) as Json;
      } catch {
        return null;
      }
      const paymentRequestId = text(body?.payment_request_id);
      const resource = text(body?.resource);
      if (!paymentRequestId || resource !== "CHECKOUT") return null;
      const rawStatus = text(body.resource_status);
      const reference = text(body.me_reference_id) ?? request.query.ref ?? null;
      // The URL token was minted for one order; an event for another is refused.
      if (
        request.query.ref &&
        text(body.me_reference_id) &&
        request.query.ref !== body.me_reference_id
      ) {
        return null;
      }
      return {
        provider,
        externalEventId: `${paymentRequestId}:${rawStatus ?? "unknown"}`,
        payloadHash: createHash("sha256").update(request.rawBody).digest("hex"),
        providerPaymentId: paymentRequestId,
        externalReference: reference,
        claimedState: mapClipStatus(rawStatus),
        rawStatus,
        action: text(body.detail_type),
      };
    },
  };
}
