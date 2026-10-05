// Shipping webhooks — the server-side bridge between a carrier event and the
// shipment record (supabase/mx/migrations).
//
// An event is authenticated (HMAC-SHA512 over the exact raw body), recorded once
// in the same ledger payment events use, and applied by one database function
// that only ever moves a shipment forward. An event that is not authentic leaves
// no trace; a duplicate is acknowledged and ignored.

import {
  assertMexicoDatabase,
  type RpcClient,
  type WebhookResponse,
} from "./mx-payments.server.ts";
import {
  parseShippingWebhook,
  processShippingWebhookOnce,
  verifyShippingWebhook,
  type WebhookLedger,
} from "./shipping/webhook.server.ts";
import type { ShippingProviderId } from "./shipping/types.ts";

type Carrier = Exclude<ShippingProviderId, "manual">;

const SECRET_VARIABLE: Readonly<Record<Carrier, string>> = Object.freeze({
  skydropx: "SKYDROPX_WEBHOOK_SECRET",
  solo_envios: "SOLO_ENVIOS_WEBHOOK_SECRET",
});

export function shippingWebhookSecret(
  provider: Carrier,
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = (environment[SECRET_VARIABLE[provider]] ?? "").trim();
  return value === "" ? undefined : value;
}

function ledgerFor(db: RpcClient, rawBody: string): WebhookLedger {
  return {
    async claim(entry) {
      let payload: unknown = null;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
      const { data, error } = await db.rpc("cm_mx_claim_webhook_event_v1", {
        p_provider: entry.provider,
        p_external_event_id: entry.external_event_id,
        p_payload_hash: entry.payload_hash,
        p_raw_payload: payload,
      });
      if (error) throw new Error("MX_WEBHOOK_LEDGER_FAILED");
      return data === true;
    },
    async complete(provider, externalEventId, status) {
      const { error } = await db.rpc("cm_mx_complete_webhook_event_v1", {
        p_provider: provider,
        p_external_event_id: externalEventId,
        p_status: status === "failed" || status === "ignored" ? status : "processed",
      });
      if (error) throw new Error("MX_WEBHOOK_LEDGER_FAILED");
    },
  };
}

/**
 *   401 — not authentic; nothing is stored
 *   200 — applied, duplicate, or deliberately ignored
 *   500 — processing failed; the carrier re-delivers (two retries, 5 minutes apart)
 */
export async function handleShippingWebhook(input: {
  db: RpcClient;
  provider: Carrier;
  rawBody: string;
  /** The value of the configured signature header (Authorization by default). */
  signature: string | null;
  secret: string | undefined;
}): Promise<WebhookResponse> {
  const { db, provider, rawBody } = input;
  const verification = verifyShippingWebhook(rawBody, input.signature, input.secret);
  if (!verification.ok) return { status: 401, body: "unauthorized" };

  const event = parseShippingWebhook(provider, rawBody);
  // Order and quotation notifications share the endpoint; only packages move a shipment.
  if (!event || event.recordType !== "packages" || !event.providerShipmentId) {
    return { status: 200, body: "ignored" };
  }

  try {
    await assertMexicoDatabase(db);
    const result = await processShippingWebhookOnce(
      ledgerFor(db, rawBody),
      event,
      async (current) => {
        const { error } = await db.rpc("cm_mx_apply_shipment_event_v1", {
          p_provider: provider,
          p_provider_shipment_id: current.providerShipmentId,
          // Null when the carrier status is not one CornerMex recognises: the raw
          // value is still recorded, and the shipment keeps its last known status.
          p_status: current.status,
          p_raw_status: current.rawStatus,
          p_tracking_number: current.trackingNumber,
          p_tracking_url: current.trackingUrl,
          p_label_url: current.labelUrl,
        });
        if (error) throw new Error("MX_SHIPMENT_APPLY_FAILED");
      },
    );
    return { status: 200, body: result };
  } catch {
    return { status: 500, body: "processing_failed" };
  }
}
