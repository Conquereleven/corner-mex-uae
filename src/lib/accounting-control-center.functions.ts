/* eslint-disable @typescript-eslint/no-explicit-any -- additive tables are unapplied and not in production-generated types yet. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";
import { evaluateZohoActivation } from "@/lib/zoho-accounting.server";

const isMissingIntegrationSchema = (error: { code?: string } | null) =>
  error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST204";

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
    const activation = evaluateZohoActivation();
    const activationSummary = {
      ready: activation.ready,
      reasons: activation.ready ? [] : activation.reasons,
      product: activation.ready
        ? activation.config.product
        : (process.env.CORNERMEX_ZOHO_PRODUCT ?? null),
    };
    const { data, error } = await (supabaseAdmin as any)
      .schema("commerce_private")
      .from("accounting_integration_jobs")
      .select(
        "id, order_id, job_type, status, attempt_count, max_attempts, next_attempt_at, last_failure_category, last_failure_code, correlation_id, updated_at, orders(order_number)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
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
    const { data: job, error } = await (supabaseAdmin as any)
      .schema("commerce_private")
      .from("accounting_integration_jobs")
      .update({
        status: "retry_scheduled",
        next_attempt_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId)
      .eq("status", "requires_attention")
      .select("id, correlation_id, order_id")
      .maybeSingle();
    if (error || !job) throw new Error("ACCOUNTING_JOB_NOT_RETRYABLE");
    await (supabaseAdmin as any)
      .schema("commerce_private")
      .from("accounting_integration_audit_events")
      .insert({
        provider: "zoho",
        job_id: job.id,
        order_id: job.order_id,
        correlation_id: job.correlation_id,
        action: "admin_retry",
        outcome: "succeeded",
      });
    return { ok: true as const, jobId: job.id };
  });

const ReconcileInput = z.object({ orderId: z.string().uuid() });

export const adminEnqueueAccountingReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof ReconcileInput>) => ReconcileInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const bucket = new Date().toISOString().slice(0, 13);
    const { data: job, error } = await (supabaseAdmin as any)
      .schema("commerce_private")
      .from("accounting_integration_jobs")
      .upsert(
        {
          provider: "zoho",
          job_type: "reconciliation",
          order_id: data.orderId,
          dedupe_key: `zoho:reconciliation:${data.orderId}:${bucket}`,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (error) throw new Error("ACCOUNTING_RECONCILIATION_ENQUEUE_FAILED");
    return { ok: true as const, jobId: job?.id ?? null };
  });
