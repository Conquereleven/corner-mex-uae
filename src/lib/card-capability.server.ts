import { readStripeCheckoutProviderConfig } from "./stripe-checkout-provider.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  cardCapability,
  providerMode,
  stripeKeyMatchesMode,
  type RuntimeGate,
} from "./operational-payments";
import { evaluateCommercialConfig } from "./commercial-config.server";

export async function readCardCapability() {
  let configured = false;
  try {
    readStripeCheckoutProviderConfig();
    configured = true;
  } catch {
    /* Fail closed until complete server config is valid. */
  }
  const mode = providerMode(process.env.CORNERMEX_STRIPE_MODE);
  const { data, error } = await (
    supabaseAdmin as unknown as {
      rpc(name: string): Promise<{
        data: { schemaVersion: number; gates: { stripe?: RuntimeGate } } | null;
        error: unknown;
      }>;
    }
  ).rpc("cm_runtime_capabilities_v2");
  const available =
    !error &&
    cardCapability({
      schemaVersion: data?.schemaVersion,
      gate: data?.gates?.stripe,
      mode,
      secretMatches: configured && stripeKeyMatchesMode(process.env.STRIPE_SECRET_KEY, mode),
      webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      enabled:
        process.env.CORNERMEX_CARD_CHECKOUT_ENABLED === "true" &&
        process.env.CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED === "true" &&
        evaluateCommercialConfig().ready,
      now: Date.now(),
    });
  return { available: Boolean(available), mode };
}
