// Mercado Pago adapter — Orders API.
//
// Source: Mercado Pago Mexico developer documentation, "Checkout API vía
// Orders" (mercadopago.com.mx/developers/es/docs/checkout-api-orders), read
// 2026-10-05. The Orders API is the current generation; the legacy Payments and
// Preferences APIs are not used.
//
// Contract relied on:
//   POST https://api.mercadopago.com/v1/orders
//     headers: Authorization: Bearer <access token>, X-Idempotency-Key
//     body:    { type: "online", external_reference, processing_mode: "automatic",
//                total_amount: "50.00", payer: { email, … },
//                transactions: { payments: [{ amount, payment_method: { id, type, … } }] } }
//     reply:   { id: "ORD…", status, status_detail, external_reference,
//                total_amount, transactions: { payments: [{ id: "PAY…", status,
//                status_detail, payment_method: { ticket_url, reference, … } }] } }
//   GET  /v1/orders/{id}
//   POST /v1/orders/{id}/cancel
//   POST /v1/orders/{id}/refund        (body optional: partial refund per transaction)
//   Webhook: topic `order`; header `x-signature: ts=<ts>,v1=<hmac>`, header
//            `x-request-id`, query `data.id`. HMAC-SHA256 hex over the manifest
//            `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with the
//            application's webhook secret; an alphanumeric data.id is lower-cased.
//
// Amounts are strings with two decimals. The Access Token is server-side only.
//
// Card payments need a token minted in the browser by Mercado Pago's own SDK
// (MercadoPago.js / Card Payment Brick): card data never reaches CornerMex. The
// adapter accepts such a token; the storefront Brick is not built yet. Cash and
// transfer methods (OXXO and others) need no card data at all.
//
// Capability level: SCAFFOLDED — no request has been sent to Mercado Pago.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { number, send, text, type HttpOptions, type Json } from "./http.ts";
import { formatAmount } from "./state.ts";
import {
  PaymentError,
  type CreatePaymentRequest,
  type NormalizedPayment,
  type PaymentEvent,
  type PaymentProvider,
  type PaymentState,
  type ProviderEnvironment,
  type WebhookRequest,
  type WebhookVerification,
} from "./types.ts";

export const MERCADO_PAGO_API = "https://api.mercadopago.com";

export type MercadoPagoConfig = {
  environment: ProviderEnvironment;
  accessToken: string;
  /** The application's webhook secret ("clave secreta") from Tus integraciones. */
  webhookSecret?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Reject events whose timestamp is older than this. 0 disables the check. */
  webhookToleranceMs?: number;
  now?: () => number;
};

/**
 * Order status + status_detail → CornerMex state. Null for a combination that
 * is not recognised: the caller keeps the last known state and stores the raw
 * value rather than guessing.
 */
export function mapMercadoPagoStatus(status: unknown, detail: unknown): PaymentState | null {
  const s = typeof status === "string" ? status.toLowerCase() : "";
  const d = typeof detail === "string" ? detail.toLowerCase() : "";
  switch (s) {
    case "created":
      return "CREATED";
    case "action_required":
      return d === "waiting_capture" ? "AUTHORIZED" : "PENDING";
    case "processing":
      return "PENDING";
    case "processed":
      if (d === "partially_refunded") return "PARTIALLY_REFUNDED";
      if (d === "refunded") return "REFUNDED";
      return d === "" || d === "accredited" ? "PAID" : null;
    case "failed":
      return "FAILED";
    case "canceled":
    case "cancelled":
    case "expired":
      return "CANCELLED";
    case "refunded":
      return d === "partially_refunded" ? "PARTIALLY_REFUNDED" : "REFUNDED";
    default:
      return null;
  }
}

export function createMercadoPagoProvider(config: MercadoPagoConfig): PaymentProvider {
  const provider = "mercado_pago" as const;
  const base = (config.baseUrl ?? MERCADO_PAGO_API).replace(/\/+$/, "");
  const now = config.now ?? (() => Date.now());
  const tolerance = config.webhookToleranceMs ?? 15 * 60 * 1000;
  const http: HttpOptions = {
    provider,
    fetch: config.fetch ?? fetch,
    timeoutMs: config.timeoutMs ?? 20_000,
    sleep: config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
  };
  const auth = { Authorization: `Bearer ${config.accessToken}` };

  function normalize(order: Json, replayed = false): NormalizedPayment {
    const id = text(order.id);
    if (!id) throw new PaymentError("PROVIDER_ERROR", "order response carried no id", { provider });
    const transactions = (order.transactions ?? {}) as Json;
    const payments = Array.isArray(transactions.payments) ? (transactions.payments as Json[]) : [];
    const refunds = Array.isArray(transactions.refunds) ? (transactions.refunds as Json[]) : [];
    const first = payments[0] ?? {};
    const method = (first.payment_method ?? {}) as Json;
    const refunded =
      number(order.total_refunded_amount) ??
      refunds.reduce((sum, refund) => sum + (number(refund.amount) ?? 0), 0);
    const ticketUrl = text(method.ticket_url);
    const reference = text(method.reference) ?? text(method.barcode_content);
    return {
      provider,
      providerPaymentId: id,
      externalReference: text(order.external_reference),
      state: mapMercadoPagoStatus(order.status, order.status_detail),
      rawStatus: text(order.status),
      rawStatusDetail: text(order.status_detail),
      amount: number(order.total_amount),
      currency: text(order.currency_id) ?? text(order.currency),
      refundedAmount: refunded,
      redirectUrl: null,
      instructions: ticketUrl || reference ? { url: ticketUrl, reference } : null,
      replayed,
    };
  }

  return {
    id: provider,
    // No provider-hosted redirect is implemented on the Orders API.
    supports: ["offline", "card_token"],

    async createPayment(request: CreatePaymentRequest) {
      if (request.method.kind === "redirect") {
        throw new PaymentError("NOT_SUPPORTED", "redirect checkout is not implemented", {
          provider,
        });
      }
      const amount = formatAmount(request.amount);
      const paymentMethod: Json =
        request.method.kind === "card_token"
          ? {
              id: request.method.methodId,
              type: "credit_card",
              token: request.method.token,
              installments: request.method.installments,
            }
          : { id: request.method.methodId, type: request.method.methodType };

      const { status, json } = await send(http, {
        method: "POST",
        url: `${base}/v1/orders`,
        kind: "money",
        headers: {
          ...auth,
          "Content-Type": "application/json",
          "X-Idempotency-Key": request.idempotencyKey,
        },
        body: {
          type: "online",
          processing_mode: "automatic",
          external_reference: request.orderReference,
          total_amount: amount,
          description: request.description.slice(0, 150),
          payer: {
            email: request.payer.email,
            ...(request.payer.firstName ? { first_name: request.payer.firstName } : {}),
            ...(request.payer.lastName ? { last_name: request.payer.lastName } : {}),
          },
          transactions: { payments: [{ amount, payment_method: paymentMethod }] },
        },
      });
      const payment = normalize(json, status === 200);
      // The provider must have recorded exactly the amount CornerMex asked for.
      if (payment.amount !== null && formatAmount(payment.amount) !== amount) {
        throw new PaymentError("AMOUNT_MISMATCH", "provider recorded a different amount", {
          provider,
        });
      }
      return payment;
    },

    async getPayment(providerPaymentId) {
      const { json } = await send(http, {
        method: "GET",
        url: `${base}/v1/orders/${encodeURIComponent(providerPaymentId)}`,
        kind: "read",
        headers: auth,
      });
      return normalize(json);
    },

    async cancelPayment(providerPaymentId, idempotencyKey) {
      const { json } = await send(http, {
        method: "POST",
        url: `${base}/v1/orders/${encodeURIComponent(providerPaymentId)}/cancel`,
        kind: "money",
        headers: {
          ...auth,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
      });
      return normalize(json);
    },

    async refund(request) {
      let body: Json | undefined;
      if (request.amount !== undefined) {
        // A partial refund names the transaction it refunds.
        const current = await this.getPayment(request.providerPaymentId);
        if (current.amount === null || request.amount > current.amount - current.refundedAmount) {
          throw new PaymentError("INVALID_REQUEST", "refund exceeds the refundable amount", {
            provider,
          });
        }
        const order = (
          await send(http, {
            method: "GET",
            url: `${base}/v1/orders/${encodeURIComponent(request.providerPaymentId)}`,
            kind: "read",
            headers: auth,
          })
        ).json;
        const payments = ((order.transactions ?? {}) as Json).payments as Json[] | undefined;
        const transactionId = text(payments?.[0]?.id);
        if (!transactionId) {
          throw new PaymentError("PROVIDER_ERROR", "order has no transaction to refund", {
            provider,
          });
        }
        body = { transactions: [{ id: transactionId, amount: formatAmount(request.amount) }] };
      }
      const { json } = await send(http, {
        method: "POST",
        url: `${base}/v1/orders/${encodeURIComponent(request.providerPaymentId)}/refund`,
        kind: "money",
        headers: {
          ...auth,
          "Content-Type": "application/json",
          "X-Idempotency-Key": request.idempotencyKey,
        },
        ...(body ? { body } : {}),
      });
      return normalize(json);
    },

    verifyWebhook(request: WebhookRequest): WebhookVerification {
      if (!config.webhookSecret) return { ok: false, reason: "webhook_secret_not_configured" };
      const signature = request.headers["x-signature"];
      const requestId = request.headers["x-request-id"];
      const dataId = request.query["data.id"];
      if (!signature) return { ok: false, reason: "signature_missing" };
      if (!requestId || !dataId) return { ok: false, reason: "signature_inputs_missing" };

      const parts = Object.fromEntries(
        signature.split(",").map((part) => {
          const [key, ...rest] = part.trim().split("=");
          return [key, rest.join("=")];
        }),
      );
      const ts = parts.ts;
      const v1 = parts.v1;
      if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1))
        return { ok: false, reason: "signature_malformed" };

      const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
      const expected = createHmac("sha256", config.webhookSecret).update(manifest).digest();
      const received = Buffer.from(v1, "hex");
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        return { ok: false, reason: "signature_mismatch" };
      }
      // A valid signature on an old timestamp is a replay of a captured request.
      if (tolerance > 0) {
        const sentAt = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
        if (!Number.isFinite(sentAt) || Math.abs(now() - sentAt) > tolerance) {
          return { ok: false, reason: "signature_expired" };
        }
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
      if (text(body?.type) !== "order") return null;
      const data = (body.data ?? {}) as Json;
      const id = text(data.id) ?? request.query["data.id"] ?? null;
      if (!id) return null;
      const action = text(body.action);
      const rawStatus = text(data.status);
      return {
        provider,
        // The same action for the same order in the same status is one event,
        // however many times Mercado Pago delivers it.
        externalEventId: `${id}:${action ?? "unknown"}:${rawStatus ?? "unknown"}:${
          text(data.status_detail) ?? ""
        }`,
        payloadHash: createHash("sha256").update(request.rawBody).digest("hex"),
        providerPaymentId: id,
        externalReference: text(data.external_reference),
        claimedState: mapMercadoPagoStatus(data.status, data.status_detail),
        rawStatus,
        action,
      };
    },
  };
}

/** Builds the `x-signature` header the way Mercado Pago does. Tests and tooling only. */
export function signMercadoPagoWebhook(
  input: { dataId: string; requestId: string; ts: string },
  secret: string,
): string {
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${input.ts};`;
  return `ts=${input.ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}
