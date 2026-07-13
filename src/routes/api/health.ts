import { createFileRoute } from "@tanstack/react-router";

export function getHealthPayload(environment: Record<string, string | undefined> = process.env) {
  return {
    status: "ok",
    service: "cornermex-web",
    runtime: "node",
    commerceModel: "single_merchant",
    version: environment.npm_package_version ?? "unversioned",
    commit: environment.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? "unknown",
  };
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          getHealthPayload(),
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
