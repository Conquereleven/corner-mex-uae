// Shipping webhook verification and replay protection.
//
// Both providers document the same scheme (read 2026-10-04):
//   Authorization: HMAC <firma>
//   "La firma se genera utilizando el algoritmo HMAC con la función hash
//    SHA-512 … El HMAC se calcula sobre el cuerpo crudo de la solicitud (bytes
//    exactos, sin formato) y se codifica como una cadena hexadecimal en
//    minúsculas."
// A weaker `Authorization: Bearer <token>` mode also exists. CornerMex accepts
// HMAC only: a static bearer token proves nothing about the body.
//
// The header name is configurable on the provider side (3–25 characters, no
// spaces); the route reads whichever name is configured and passes the value in.
//
// Retries: the provider re-sends a failed delivery twice, five minutes apart,
// so the same event legitimately arrives more than once. Identity is therefore
// derived from the payload, and the caller must store it under a unique
// constraint before acting.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { mapTrackingStatus } from "./status.ts";
import type { ShipmentStatus, ShippingProviderId } from "./types.ts";

export type WebhookVerification = { ok: true } | { ok: false; reason: string };

/**
 * Verifies the HMAC-SHA512 signature over the exact raw body.
 *
 * `rawBody` must be the bytes as received. Parsing and re-serialising the JSON
 * first changes the bytes and makes every signature fail.
 */
export function verifyShippingWebhook(
  rawBody: string | Uint8Array,
  authorizationHeader: string | null | undefined,
  secret: string | undefined,
): WebhookVerification {
  if (!secret) return { ok: false, reason: "webhook_secret_not_configured" };
  if (!authorizationHeader) return { ok: false, reason: "signature_missing" };

  const match = /^HMAC\s+([0-9a-f]+)$/.exec(authorizationHeader.trim());
  if (!match) return { ok: false, reason: "signature_scheme_unsupported" };

  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const received = Buffer.from(match[1], "hex");
  // timingSafeEqual throws on a length mismatch, and a length mismatch is
  // already a definite failure.
  if (received.length !== expected.length) return { ok: false, reason: "signature_mismatch" };
  return timingSafeEqual(received, expected)
    ? { ok: true }
    : { ok: false, reason: "signature_mismatch" };
}

/** Signs a body the way the provider does. Used by tests and local tooling. */
export function signShippingWebhook(rawBody: string | Uint8Array, secret: string): string {
  return `HMAC ${createHmac("sha512", secret).update(rawBody).digest("hex")}`;
}

export type ShippingWebhookEvent = {
  provider: ShippingProviderId;
  /**
   * Stable identity of the event. The payload has no event id of its own, so it
   * is built from the record type, the record id and the status it reports: the
   * same status for the same package is the same event, however often it is
   * delivered.
   */
  externalEventId: string;
  /** sha256 of the raw body, hex. */
  payloadHash: string;
  recordType: string;
  recordId: string;
  providerShipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  /** Null when the provider status is not one CornerMex recognises. */
  status: ShipmentStatus | null;
  /** The provider status exactly as received. */
  rawStatus: string | null;
  returned: boolean;
};

type Json = Record<string, unknown>;

const asText = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : typeof value === "number" ? String(value) : null;

/**
 * Parses an already-verified webhook body. Returns null for a body that is not a
 * recognisable event, which the route should acknowledge and ignore.
 */
export function parseShippingWebhook(
  provider: ShippingProviderId,
  rawBody: string,
): ShippingWebhookEvent | null {
  let parsed: Json;
  try {
    parsed = JSON.parse(rawBody) as Json;
  } catch {
    return null;
  }
  const data = parsed?.data as Json | undefined;
  const recordType = asText(data?.type);
  const recordId = asText(data?.id);
  if (!data || !recordType || !recordId) return null;

  const attributes = (data.attributes ?? {}) as Json;
  const relationships = (data.relationships ?? {}) as Json;
  const shipment = ((relationships.shipment as Json | undefined)?.data ?? {}) as Json;
  const returned = attributes.returned === true;
  // A package on its way back reports status "in_return"; `returned_status`
  // then carries the leg's own progress and must not override it.
  const rawStatus = asText(attributes.status);

  return {
    provider,
    externalEventId: `${recordType}:${recordId}:${rawStatus ?? "unknown"}${returned ? ":returned" : ""}`,
    payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    recordType,
    recordId,
    providerShipmentId: asText(shipment.id),
    trackingNumber: asText(attributes.tracking_number),
    trackingUrl: asText(attributes.tracking_url_provider),
    labelUrl: asText(attributes.label_url),
    status: recordType === "packages" ? mapTrackingStatus(rawStatus) : null,
    rawStatus,
    returned,
  };
}

export type WebhookProcessingStatus =
  | "processing"
  | "processed"
  | "duplicate"
  | "ignored"
  | "failed";

/**
 * The record every webhook leaves behind. `(provider, external_event_id)` must
 * be unique in storage; that constraint — not application logic — is what makes
 * processing replay-safe under concurrent deliveries.
 */
export type WebhookLedgerEntry = {
  provider: ShippingProviderId;
  external_event_id: string;
  payload_hash: string;
  received_at: string;
  processed_at: string | null;
  processing_status: WebhookProcessingStatus;
};

export interface WebhookLedger {
  /**
   * Atomically takes ownership of the event. Resolves true when the event is new,
   * or when its only earlier attempt ended `failed` (so a provider retry can
   * finish the job). Resolves false when it is being processed or was processed.
   */
  claim(entry: WebhookLedgerEntry): Promise<boolean>;
  complete(
    provider: ShippingProviderId,
    externalEventId: string,
    status: WebhookProcessingStatus,
    processedAt: string,
  ): Promise<void>;
}

/**
 * Runs `apply` at most once per event.
 *
 * The claim happens before `apply`, so two concurrent deliveries cannot both
 * act. If `apply` throws, the entry is marked failed and the error propagates,
 * so the provider's own retry delivers it again and an operator can see it.
 */
export async function processShippingWebhookOnce(
  ledger: WebhookLedger,
  event: ShippingWebhookEvent,
  apply: (event: ShippingWebhookEvent) => Promise<void>,
  now: () => Date = () => new Date(),
): Promise<WebhookProcessingStatus> {
  const claimed = await ledger.claim({
    provider: event.provider,
    external_event_id: event.externalEventId,
    payload_hash: event.payloadHash,
    received_at: now().toISOString(),
    processed_at: null,
    processing_status: "processing",
  });
  if (!claimed) return "duplicate";

  try {
    await apply(event);
  } catch (error) {
    await ledger.complete(event.provider, event.externalEventId, "failed", now().toISOString());
    throw error;
  }
  await ledger.complete(event.provider, event.externalEventId, "processed", now().toISOString());
  return "processed";
}
