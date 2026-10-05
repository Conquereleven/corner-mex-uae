import { createFileRoute } from "@tanstack/react-router";

import { getCommerceSafetyStatus, validateCommerceEnvironment } from "../../config/commerce-env.ts";
import { ACTIVE_MARKET } from "../../config/market.ts";
import { evaluateMarketDatabase } from "../../config/market-database.ts";
import { applicationServiceName } from "../../lib/service-identity.ts";

const READINESS_TIMEOUT_MS = 4_000;

async function checkSupabaseReadiness(
  url: string,
  key: string,
  fetcher: typeof fetch,
): Promise<boolean> {
  const response = await fetcher(`${url}/rest/v1/categories?select=id&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(READINESS_TIMEOUT_MS),
  });
  return response.ok;
}

export async function getReadinessResponse(
  environment: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const validation = validateCommerceEnvironment(environment);
  const capabilities = validation.config ? getCommerceSafetyStatus(environment) : undefined;
  if (!validation.valid) {
    return Response.json(
      {
        status: "degraded",
        service: applicationServiceName(environment),
        target: "unavailable",
        missing: validation.missing,
        errors: validation.errors,
        ...(capabilities ? { capabilities } : {}),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  // A deployment pointed at the wrong database is never "ready", whatever the
  // database answers. Reasons name variables, never values.
  const market = { code: ACTIVE_MARKET.code, currency: ACTIVE_MARKET.currency };
  const marketDatabase = evaluateMarketDatabase(environment);
  if (!marketDatabase.ok) {
    return Response.json(
      {
        status: "degraded",
        service: applicationServiceName(environment),
        target: "refused",
        market,
        marketDatabase: { ok: false, reasons: marketDatabase.reasons },
        capabilities,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const ready = await checkSupabaseReadiness(
      environment.SUPABASE_URL!,
      environment.SUPABASE_PUBLISHABLE_KEY!,
      fetcher,
    );
    return Response.json(
      {
        status: ready ? "ready" : "degraded",
        service: applicationServiceName(environment),
        target: ready ? "reachable" : "unavailable",
        market,
        marketDatabase: { ok: true, reasons: [] },
        capabilities,
      },
      { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        service: applicationServiceName(environment),
        target: "unavailable",
        capabilities,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const Route = createFileRoute("/api/ready")({
  server: {
    handlers: {
      GET: async () => getReadinessResponse(),
    },
  },
});
