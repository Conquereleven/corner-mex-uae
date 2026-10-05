// Provider bindings and configuration.
//
// Reads server-side environment only. Credentials are never logged, never
// returned from a function here and never reach the browser: health reports
// which variable NAMES are missing, not their values.
//
// Capability level today: SCAFFOLDED. The adapters implement the published
// contracts and are covered by contract tests against recorded shapes, but no
// call has been made with a real account. See docs/cornermex-mx/SKYDROPX.md and
// docs/cornermex-mx/SOLO-ENVIOS.md.

import { createSkydropxPlatformProvider } from "./skydropx-platform.ts";
import type {
  IntegrationState,
  ProviderEnvironment,
  ProviderHealth,
  ShippingProvider,
  ShippingProviderId,
} from "./types.ts";

type Environment = Record<string, string | undefined>;

type ProviderDefinition = {
  id: Exclude<ShippingProviderId, "manual">;
  displayName: string;
  /** Environment variable prefix, e.g. SKYDROPX → SKYDROPX_CLIENT_ID. */
  prefix: string;
  /** Hosts from each provider's published API reference. */
  hosts: Record<ProviderEnvironment, string>;
};

export const SHIPPING_PROVIDER_DEFINITIONS: ReadonlyArray<ProviderDefinition> = Object.freeze([
  {
    id: "skydropx",
    displayName: "Skydropx",
    prefix: "SKYDROPX",
    hosts: {
      // The reference's code samples call pro.skydropx.com while its quick-start
      // note says "Asegúrate de usar el host correcto: api-pro.skydropx.com".
      // The note is the explicit instruction, so it is the default;
      // SKYDROPX_BASE_URL overrides it once verified against a real account.
      production: "https://api-pro.skydropx.com",
      sandbox: "https://sb-pro.skydropx.com",
    },
  },
  {
    id: "solo_envios",
    displayName: "Solo Envíos",
    prefix: "SOLO_ENVIOS",
    hosts: {
      production: "https://app.soloenvios.com",
      sandbox: "https://sb-app.soloenvios.com",
    },
  },
]);

export type ResolvedProviderConfig = {
  definition: ProviderDefinition;
  environment: ProviderEnvironment;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

const value = (raw: string | undefined): string => (raw ?? "").trim();

/**
 * Resolves one provider's configuration.
 *
 * The environment defaults to `sandbox`. Production must be asked for by name
 * (`<PREFIX>_ENVIRONMENT=production`), so a half-configured deployment can only
 * ever talk to a sandbox.
 */
export function resolveProviderConfig(
  definition: ProviderDefinition,
  environment: Environment = process.env,
): { config: ResolvedProviderConfig | null; missing: string[]; enabled: boolean } {
  const prefix = definition.prefix;
  const enabled = value(environment[`${prefix}_ENABLED`]) === "true";
  const clientId = value(environment[`${prefix}_CLIENT_ID`]);
  const clientSecret = value(environment[`${prefix}_CLIENT_SECRET`]);
  const mode = value(environment[`${prefix}_ENVIRONMENT`]) || "sandbox";

  const missing: string[] = [];
  if (!clientId) missing.push(`${prefix}_CLIENT_ID`);
  if (!clientSecret) missing.push(`${prefix}_CLIENT_SECRET`);
  if (mode !== "sandbox" && mode !== "production") missing.push(`${prefix}_ENVIRONMENT`);
  if (missing.length > 0) return { config: null, missing, enabled };

  const providerEnvironment = mode as ProviderEnvironment;
  const override = value(environment[`${prefix}_BASE_URL`]).replace(/\/+$/, "");
  let baseUrl = definition.hosts[providerEnvironment];
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol !== "https:") throw new Error("https required");
      baseUrl = url.origin;
    } catch {
      return { config: null, missing: [`${prefix}_BASE_URL`], enabled };
    }
  }
  return {
    config: { definition, environment: providerEnvironment, baseUrl, clientId, clientSecret },
    missing: [],
    enabled,
  };
}

/**
 * Health as far as configuration alone can tell. `CONNECTED` and `LIVE` are
 * never produced here: they require an observed successful call, which is
 * recorded by the integration-health layer, not inferred from env vars.
 */
export function providerConfigHealth(
  definition: ProviderDefinition,
  environment: Environment = process.env,
): ProviderHealth {
  const resolved = resolveProviderConfig(definition, environment);
  if (!resolved.config || !resolved.enabled) {
    return {
      provider: definition.id,
      state: "NOT_CONFIGURED",
      environment: resolved.config?.environment ?? null,
      missing: resolved.config ? [`${definition.prefix}_ENABLED`] : resolved.missing,
    };
  }
  if (resolved.config.environment === "sandbox") {
    return { provider: definition.id, state: "SANDBOX", environment: "sandbox", missing: [] };
  }
  // Production credentials are present but no successful production call has
  // been observed. That is not CONNECTED and certainly not LIVE.
  const state: IntegrationState = "NOT_CONFIGURED";
  return {
    provider: definition.id,
    state,
    environment: "production",
    missing: ["PRODUCTION_VERIFICATION"],
  };
}

export function shippingConfigHealth(environment: Environment = process.env): ProviderHealth[] {
  return SHIPPING_PROVIDER_DEFINITIONS.map((definition) =>
    providerConfigHealth(definition, environment),
  );
}

const cache = new Map<string, ShippingProvider>();

/**
 * The providers that are enabled and fully configured. An empty list is a valid
 * answer: the quote engine then falls back to manual shipping rules.
 *
 * Instances are cached per credential so the OAuth token and the rate limiter
 * are shared across requests in a server process.
 */
export function configuredShippingProviders(
  environment: Environment = process.env,
): ShippingProvider[] {
  const providers: ShippingProvider[] = [];
  for (const definition of SHIPPING_PROVIDER_DEFINITIONS) {
    const { config, enabled } = resolveProviderConfig(definition, environment);
    if (!config || !enabled) continue;
    const key = `${definition.id}|${config.baseUrl}|${config.clientId}`;
    let instance = cache.get(key);
    if (!instance) {
      instance = createSkydropxPlatformProvider({
        id: definition.id,
        environment: config.environment,
        baseUrl: config.baseUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      cache.set(key, instance);
    }
    providers.push(instance);
  }
  return providers;
}
