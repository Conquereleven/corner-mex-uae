import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ZohoAccountingProvider, type ZohoRuntimeConfig } from "./zoho-accounting.server";
import type { RuntimeGate } from "./operational-payments";
import { AccountingIntegrationError } from "./accounting-integration";

export function zohoRuntimeConfig(
  env: Record<string, string | undefined>,
): ZohoRuntimeConfig | null {
  const product = env.CORNERMEX_ZOHO_PRODUCT;
  const base = env.CORNERMEX_ZOHO_API_BASE_URL;
  const region = base?.match(
    /^https:\/\/www\.zohoapis\.(com|eu|in|com\.au|jp|ca|com\.cn|sa)$/,
  )?.[1];
  if (
    (product !== "books" && product !== "invoice") ||
    !region ||
    !env.CORNERMEX_ZOHO_ORGANIZATION_ID ||
    !env.CORNERMEX_ZOHO_VAT_TAX_ID ||
    !env.CORNERMEX_ZOHO_ACCESS_TOKEN ||
    !env.CORNERMEX_ZOHO_CLIENT_ID ||
    !env.CORNERMEX_ZOHO_CLIENT_SECRET ||
    !env.CORNERMEX_ZOHO_REFRESH_TOKEN ||
    env.CORNERMEX_ZOHO_ACCOUNTS_URL !== `https://accounts.zoho.${region}`
  )
    return null;
  return {
    product,
    organizationId: env.CORNERMEX_ZOHO_ORGANIZATION_ID,
    apiBaseUrl: base!,
    accessToken: env.CORNERMEX_ZOHO_ACCESS_TOKEN,
    vatTaxId: env.CORNERMEX_ZOHO_VAT_TAX_ID,
    refresh: {
      accountsUrl: env.CORNERMEX_ZOHO_ACCOUNTS_URL,
      clientId: env.CORNERMEX_ZOHO_CLIENT_ID,
      clientSecret: env.CORNERMEX_ZOHO_CLIENT_SECRET,
      refreshToken: env.CORNERMEX_ZOHO_REFRESH_TOKEN,
    },
  };
}
export async function readAccountingRuntime() {
  const config = zohoRuntimeConfig(process.env);
  const { data, error } = await (
    supabaseAdmin as unknown as {
      rpc(name: string): Promise<{
        data: { schemaVersion: number; gates: { zoho?: RuntimeGate } } | null;
        error: unknown;
      }>;
    }
  ).rpc("cm_runtime_capabilities_v2");
  const gate = data?.gates?.zoho;
  const ready =
    !error &&
    data?.schemaVersion === 2 &&
    Boolean(config) &&
    gate?.enabled === true &&
    gate.mode === process.env.CORNERMEX_ZOHO_MODE &&
    Date.parse(gate.validUntil) > Date.now() &&
    process.env.CORNERMEX_ZOHO_LIVE_WRITES_ENABLED === "true" &&
    Boolean(process.env.CORNERMEX_INTEGRATION_WORKER_SECRET);
  return { ready: Boolean(ready), gate, config };
}
export async function gatedAccountingProvider(assertLease: () => Promise<void>) {
  const runtime = await readAccountingRuntime();
  if (!runtime.ready || !runtime.config)
    throw new AccountingIntegrationError("auth", false, "ACCOUNTING_ACTIVATION_BLOCKED");
  return new ZohoAccountingProvider(runtime.config, async (input, init) => {
    await assertLease();
    return fetch(input, init);
  });
}
