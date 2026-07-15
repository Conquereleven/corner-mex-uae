import { createFileRoute } from "@tanstack/react-router";

import { getCommerceSafetyStatus, validateCommerceEnvironment } from "../../config/commerce-env.ts";

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
        service: "cornermex-web",
        target: "unavailable",
        missing: validation.missing,
        errors: validation.errors,
        ...(capabilities ? { capabilities } : {}),
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
        service: "cornermex-web",
        target: ready ? "reachable" : "unavailable",
        capabilities,
      },
      { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "degraded",
        service: "cornermex-web",
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
