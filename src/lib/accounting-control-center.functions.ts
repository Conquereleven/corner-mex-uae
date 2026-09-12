/* eslint-disable @typescript-eslint/no-explicit-any -- additive tables are unapplied and not in production-generated types yet. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";
import { readAccountingRuntime } from "@/lib/accounting-runtime.server";

const isMissingIntegrationSchema = (error: { code?: string } | null) =>
  error?.code === "PGRST202" ||
  error?.code === "42883" ||
  error?.code === "42P01" ||
  error?.code === "PGRST205" ||
  error?.code === "PGRST204";

export type AccountingControlCenter = {
  available: boolean;
  activation: { ready: boolean; reasons: string[]; product: string | null };
  providerHealth: "blocked" | "degraded" | "available";
  counts: Record<string, number>;
  jobs: Array<{
    id: string;
    orderId: string;
    orderNumber: string | null;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: string;
    failureCategory: string | null;
    safeCode: string | null;
    correlationId: string;
    updatedAt: string;
  }>;
};

export const adminAccountingControlCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountingControlCenter> => {
    await assertAdmin(context.userId);
    const activation = await readAccountingRuntime();
    const activationSummary = {
      ready: activation.ready,
      reasons: activation.ready ? [] : ["ACCOUNTING_ACTIVATION_BLOCKED"],
      product: activation.ready
        ? activation.config!.product
        : (process.env.CORNERMEX_ZOHO_PRODUCT ?? null),
    };
    const { data, error } = await (supabaseAdmin as any).rpc("cm_accounting_control_center_v2", {
      p_actor_id: context.userId,
    });
    if (isMissingIntegrationSchema(error)) {
      return {
        available: false,
        activation: activationSummary,
        providerHealth: "blocked",
        counts: {},
        jobs: [],
      };
    }
    if (error) throw new Error("ACCOUNTING_CONTROL_CENTER_READ_FAILED");
    const rows = data ?? [];
    const counts = rows.reduce((summary: Record<string, number>, row: any) => {
      summary[row.status] = (summary[row.status] ?? 0) + 1;
      return summary;
    }, {});
    const providerHealth = !activation.ready
      ? "blocked"
      : rows.some((row: any) =>
            ["rate_limit", "provider_unavailable", "auth"].includes(row.last_failure_category),
          )
        ? "degraded"
        : "available";
    return {
      available: true,
      activation: activationSummary,
      providerHealth,
      counts,
      jobs: rows.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        orderNumber: (Array.isArray(row.orders) ? row.orders[0] : row.orders)?.order_number ?? null,
        type: row.job_type,
        status: row.status,
        attempts: row.attempt_count,
        maxAttempts: row.max_attempts,
        nextAttemptAt: row.next_attempt_at,
        failureCategory: row.last_failure_category,
        safeCode: row.last_failure_code,
        correlationId: row.correlation_id,
        updatedAt: row.updated_at,
      })),
    };
  });

const RetryInput = z.object({ jobId: z.string().uuid() });

export const adminRetryAccountingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof RetryInput>) => RetryInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "cm_accounting_admin_action_v2",
      { p_actor_id: context.userId, p_action: "retry", p_id: data.jobId },
    );
    if (error || !result) throw new Error("ACCOUNTING_JOB_NOT_RETRYABLE");
    return result as { ok: true; jobId: string };
  });

const ReconcileInput = z.object({ orderId: z.string().uuid() });

export const adminEnqueueAccountingReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof ReconcileInput>) => ReconcileInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "cm_accounting_admin_action_v2",
      { p_actor_id: context.userId, p_action: "reconcile", p_id: data.orderId },
    );
    if (error || !result) throw new Error("ACCOUNTING_RECONCILIATION_ENQUEUE_FAILED");
    return result as { ok: true; jobId: string };
  });
