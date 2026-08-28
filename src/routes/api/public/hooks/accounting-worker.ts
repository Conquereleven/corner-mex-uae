import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { evaluateZohoActivation } from "@/lib/zoho-accounting.server";

function authorized(request: Request): boolean {
  const expected = process.env.CORNERMEX_INTEGRATION_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/hooks/accounting-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
        const activation = evaluateZohoActivation();
        if (!activation.ready)
          return Response.json(
            { ok: false, blocked: true, reasons: activation.reasons },
            { status: 503 },
          );
        const { runAccountingWorker } = await import("@/lib/accounting-worker.server");
        return Response.json(await runAccountingWorker());
      },
    },
  },
});
