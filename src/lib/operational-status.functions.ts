import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-authorization.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readCardCapability } from "./card-capability.server";
import { readAccountingRuntime } from "./accounting-runtime.server";
export const getOperationalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await (
      supabaseAdmin as unknown as {
        rpc(
          name: string,
          args: Record<string, unknown>,
        ): Promise<{
          data: {
            paymentAnomalies: number;
            refundActions: number;
            historicalJobs: number;
            jobsRequiringAttention: number;
          } | null;
          error: unknown;
        }>;
      }
    ).rpc("cm_operational_status_v2", { p_actor_id: context.userId });
    const [card, accounting] = await Promise.all([readCardCapability(), readAccountingRuntime()]);
    return {
      schemaAvailable: !error && Boolean(data),
      cardReady: card.available,
      cardMode: card.mode,
      workerReady: accounting.ready,
      workerMode: accounting.gate?.mode ?? null,
      paymentAnomalies: data?.paymentAnomalies ?? null,
      refundActions: data?.refundActions ?? null,
      historicalJobs: data?.historicalJobs ?? null,
      jobsRequiringAttention: data?.jobsRequiringAttention ?? null,
    };
  });
