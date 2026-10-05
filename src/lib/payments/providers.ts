// Payment provider configuration and health.
//
// Server-side environment only. Credentials never reach the browser, are never
// logged and are never returned: health names the missing VARIABLES, not values.
//
// A provider is offered at checkout only when it is enabled AND fully
// configured. `CONNECTED` and `LIVE` are never inferred from configuration; they
// require an observed successful call.

import { createClipProvider } from "./clip.ts";
import { createMercadoPagoProvider } from "./mercado-pago.ts";
import type {
  PaymentProvider,
  PaymentProviderId,
  ProviderEnvironment,
  ProviderHealth,
} from "./types.ts";

type Environment = Record<string, string | undefined>;

const value = (raw: string | undefined): string => (raw ?? "").trim();

/** Display order at checkout: Mercado Pago is primary, Clip secondary. */
export const PAYMENT_PROVIDER_ORDER: readonly PaymentProviderId[] = ["mercado_pago", "clip"];

type Resolved = {
  enabled: boolean;
  environment: ProviderEnvironment | null;
  missing: string[];
  build: (() => PaymentProvider) | null;
};

function environmentOf(raw: string, name: string, missing: string[]): ProviderEnvironment | null {
  const mode = raw || "sandbox";
  if (mode === "sandbox" || mode === "production") return mode;
  missing.push(name);
  return null;
}

function resolveMercadoPago(environment: Environment): Resolved {
  const missing: string[] = [];
  const accessToken = value(environment.MERCADO_PAGO_ACCESS_TOKEN);
  const webhookSecret = value(environment.MERCADO_PAGO_WEBHOOK_SECRET);
  const mode = environmentOf(
    value(environment.MERCADO_PAGO_ENVIRONMENT),
    "MERCADO_PAGO_ENVIRONMENT",
    missing,
  );
  if (!accessToken) missing.push("MERCADO_PAGO_ACCESS_TOKEN");
  // Without the secret an event cannot be authenticated, so the provider is
  // not usable at all — not merely "webhooks off".
  if (!webhookSecret) missing.push("MERCADO_PAGO_WEBHOOK_SECRET");
  // Mercado Pago test credentials are issued with a TEST- prefix. A production
  // token in a deployment that asked for sandbox is refused, and vice versa.
  if (accessToken && mode) {
    const isTest = accessToken.startsWith("TEST-");
    if (mode === "sandbox" && !isTest) missing.push("MERCADO_PAGO_ACCESS_TOKEN:not_a_test_token");
    if (mode === "production" && isTest)
      missing.push("MERCADO_PAGO_ACCESS_TOKEN:test_token_in_production");
  }
  return {
    enabled: value(environment.MERCADO_PAGO_ENABLED) === "true",
    environment: mode,
    missing,
    build:
      missing.length === 0 && mode
        ? () => createMercadoPagoProvider({ environment: mode, accessToken, webhookSecret })
        : null,
  };
}

function resolveClip(environment: Environment): Resolved {
  const missing: string[] = [];
  const apiKey = value(environment.CLIP_API_KEY);
  const apiSecret = value(environment.CLIP_API_SECRET);
  const webhookSecret = value(environment.CLIP_WEBHOOK_SECRET);
  if (!apiKey) missing.push("CLIP_API_KEY");
  if (!apiSecret) missing.push("CLIP_API_SECRET");
  if (webhookSecret.length < 32) missing.push("CLIP_WEBHOOK_SECRET");
  // Clip's test credentials do not cover Redirected Checkout, so this flow has
  // no sandbox: it must be requested as production, deliberately.
  const mode = value(environment.CLIP_ENVIRONMENT);
  if (mode !== "production") missing.push("CLIP_ENVIRONMENT:redirected_checkout_has_no_sandbox");
  return {
    enabled: value(environment.CLIP_ENABLED) === "true",
    environment: mode === "production" ? "production" : null,
    missing,
    build:
      missing.length === 0
        ? () => createClipProvider({ environment: "production", apiKey, apiSecret, webhookSecret })
        : null,
  };
}

const RESOLVERS: Readonly<Record<PaymentProviderId, (environment: Environment) => Resolved>> = {
  mercado_pago: resolveMercadoPago,
  clip: resolveClip,
};

export function paymentConfigHealth(environment: Environment = process.env): ProviderHealth[] {
  return PAYMENT_PROVIDER_ORDER.map((provider) => {
    const resolved = RESOLVERS[provider](environment);
    if (!resolved.build) {
      return {
        provider,
        state: "NOT_CONFIGURED",
        environment: resolved.environment,
        missing: resolved.missing,
      };
    }
    if (!resolved.enabled) {
      return {
        provider,
        state: "NOT_CONFIGURED",
        environment: resolved.environment,
        missing: [`${provider === "clip" ? "CLIP" : "MERCADO_PAGO"}_ENABLED`],
      };
    }
    if (resolved.environment === "sandbox") {
      return { provider, state: "SANDBOX", environment: "sandbox", missing: [] };
    }
    // Production credentials with no observed successful call are not CONNECTED.
    return {
      provider,
      state: "NOT_CONFIGURED",
      environment: "production",
      missing: ["PRODUCTION_VERIFICATION"],
    };
  });
}

/**
 * Providers that are enabled and fully configured, in display order. Adapters
 * hold no state, so a fresh instance per call is correct and cheap.
 */
export function configuredPaymentProviders(
  environment: Environment = process.env,
): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  for (const id of PAYMENT_PROVIDER_ORDER) {
    const resolved = RESOLVERS[id](environment);
    if (resolved.enabled && resolved.build) providers.push(resolved.build());
  }
  return providers;
}

export function paymentProviderById(
  id: PaymentProviderId,
  environment: Environment = process.env,
): PaymentProvider | null {
  return configuredPaymentProviders(environment).find((provider) => provider.id === id) ?? null;
}
