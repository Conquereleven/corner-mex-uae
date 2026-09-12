/* eslint-disable @typescript-eslint/no-explicit-any -- unapplied additive tables intentionally trail generated production types. */
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AccountingIntegrationError,
  classifyAccountingError,
  processOrderToInvoice,
  reconcileInvoice,
  retryDelayMs,
  type AccountingStateStore,
  type CanonicalOrderInvoice,
  type EntityMapping,
} from "@/lib/accounting-integration";
import { gatedAccountingProvider, readAccountingRuntime } from "@/lib/accounting-runtime.server";

type ClaimedJob = {
  id: string;
  job_type: "order_invoice" | "payment_sync" | "reconciliation";
  order_id: string;
  correlation_id: string;
  attempt_count: number;
  max_attempts: number;
  locked_by: string;
};

function logAccountingEvent(
  event: "job_succeeded" | "job_failed",
  job: ClaimedJob,
  detail?: { category?: string; code?: string },
) {
  console.info(
    JSON.stringify({
      service: "accounting_integration",
      event,
      provider: "zoho",
      jobId: job.id,
      jobType: job.job_type,
      correlationId: job.correlation_id,
      attempt: job.attempt_count,
      category: detail?.category ?? null,
      safeCode: detail?.code ?? null,
      occurredAt: new Date().toISOString(),
    }),
  );
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function loadCanonicalOrder(orderId: string): Promise<CanonicalOrderInvoice> {
  const { data: order, error } = await (supabaseAdmin as any)
    .from("orders")
    .select(
      "id, order_number, buyer_id, status, payment_status, subtotal_aed, shipping_aed, tax_aed, total_aed, shipping_address, created_at, order_items(id, product_name, variant_label, qty, unit_price_aed, line_total_aed), payments(provider, provider_reference, status, created_at, updated_at)",
    )
    .eq("id", orderId)
    .single();
  if (error || !order)
    throw new AccountingIntegrationError("mapping_error", false, "ACCOUNTING_ORDER_NOT_FOUND");
  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(
    order.buyer_id,
  );
  if (userError || !user.user?.email)
    throw new AccountingIntegrationError(
      "mapping_error",
      false,
      "ACCOUNTING_BUYER_IDENTITY_MISSING",
    );
  const { data: profile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("full_name, phone")
    .eq("id", order.buyer_id)
    .maybeSingle();
  const address = (order.shipping_address ?? {}) as Record<string, unknown>;
  const payments = (order.payments ?? []) as Array<Record<string, unknown>>;
  const paid = payments
    .filter((payment) => payment.status === "paid")
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const subtotalAed = Number(order.subtotal_aed);
  const shippingAed = Number(order.shipping_aed);
  const taxAed = order.tax_aed === null ? null : Number(order.tax_aed);
  const totalAed = Number(order.total_aed);
  const discountAed = Math.max(
    0,
    Number((subtotalAed + shippingAed + (taxAed ?? 0) - totalAed).toFixed(2)),
  );
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    orderStatus: order.status,
    paymentStatus: order.payment_status,
    paymentProvider: paid ? safeText(paid.provider, "unknown") : null,
    paymentReference: paid ? safeText(paid.provider_reference, "") || null : null,
    paymentPaidAt: paid ? safeText(paid.updated_at, safeText(paid.created_at, "")) || null : null,
    customer: {
      localId: order.buyer_id,
      displayName: safeText(
        profile?.full_name,
        safeText(address.recipient_name, "CornerMex customer"),
      ),
      email: user.user.email,
      phone: safeText(profile?.phone, safeText(address.phone, "")) || null,
      billingAddress: {
        address: safeText(address.street, "") || null,
        city: safeText(address.area, "") || null,
        state: safeText(address.emirate, "") || null,
        country: "United Arab Emirates",
      },
    },
    lines: (order.order_items ?? []).map((line: any) => ({
      localId: line.id,
      name: line.product_name,
      description: line.variant_label,
      quantity: Number(line.qty),
      unitPriceAed: Number(line.unit_price_aed),
      lineTotalAed: Number(line.line_total_aed),
    })),
    subtotalAed,
    shippingAed,
    discountAed,
    taxAed,
    totalAed,
    currency: "AED",
    createdAt: order.created_at,
  };
}

async function jobAction(job: ClaimedJob, action: string, payload: unknown = {}) {
  const { data, error } = await (supabaseAdmin as any).rpc("cm_accounting_job_action_v2", {
    p_job_id: job.id,
    p_worker_id: job.locked_by,
    p_action: action,
    p_payload: payload,
  });
  if (error)
    throw new AccountingIntegrationError("conflict", false, "ACCOUNTING_FENCED_ACTION_REJECTED");
  return data;
}
function createStore(job: ClaimedJob): AccountingStateStore {
  return {
    async getMapping(entityType, localEntityId) {
      return jobAction(job, "get_mapping", { entityType, localEntityId });
    },
    async beginProviderCreate(key) {
      return (await jobAction(job, "begin_create", { key })).acquired === true;
    },
    async saveMapping(mapping: EntityMapping) {
      await jobAction(job, "save_mapping", mapping);
    },
    async audit(event) {
      await jobAction(job, "audit", event);
    },
  };
}
async function finishJob(job: ClaimedJob) {
  await jobAction(job, "finish");
}
async function failJob(job: ClaimedJob, rawError: unknown) {
  const error = classifyAccountingError(rawError);
  const status =
    !error.retryable || job.attempt_count >= job.max_attempts
      ? "requires_attention"
      : "retry_scheduled";
  await jobAction(job, "fail", {
    retryable: error.retryable,
    category: error.category,
    code: error.safeCode,
    retrySeconds: Math.ceil(retryDelayMs(job.attempt_count, error.retryAfterMs) / 1000),
  });
  return { status, category: error.category, code: error.safeCode };
}

async function processJob(job: ClaimedJob) {
  const provider = await gatedAccountingProvider(async () => {
    await jobAction(job, "assert");
  });
  const store = createStore(job);
  const order = await loadCanonicalOrder(job.order_id);
  if (job.job_type === "reconciliation") {
    const mapping = await store.getMapping("invoice", order.orderId);
    if (!mapping)
      throw new AccountingIntegrationError(
        "mapping_error",
        false,
        "ACCOUNTING_INVOICE_MAPPING_MISSING",
      );
    const result = reconcileInvoice(order, await provider.getInvoice(mapping.externalId));
    if (!result.matches)
      throw new AccountingIntegrationError(
        "conflict",
        false,
        `ACCOUNTING_RECONCILIATION_${result.reasons.join("_").toUpperCase()}`,
      );
    await store.audit({
      correlationId: job.correlation_id,
      action: "reconciliation",
      outcome: "succeeded",
      externalId: mapping.externalId,
    });
  } else if (job.job_type === "payment_sync") {
    if (!["confirmed", "processing", "shipped", "delivered"].includes(order.orderStatus)) {
      await store.audit({
        correlationId: job.correlation_id,
        action: "payment_sync",
        outcome: "skipped",
      });
      await finishJob(job);
      return;
    }
    const mapping = await store.getMapping("invoice", order.orderId);
    if (!mapping) {
      throw new AccountingIntegrationError("mapping_error", true, "ACCOUNTING_INVOICE_NOT_READY");
    }
    await processOrderToInvoice({
      correlationId: job.correlation_id,
      order,
      provider,
      store,
      syncInvoice: false,
    });
  } else {
    await processOrderToInvoice({
      correlationId: job.correlation_id,
      order,
      provider,
      store,
      syncInvoice: true,
    });
  }
  await finishJob(job);
}

export async function runAccountingWorker(limit = 10) {
  const activation = await readAccountingRuntime();
  if (!activation.ready)
    return {
      ok: false as const,
      blocked: true as const,
      reasons: ["ACCOUNTING_ACTIVATION_BLOCKED"],
    };
  const workerId = `accounting-${randomUUID()}`;
  const { data, error } = await (supabaseAdmin as any).rpc("cm_claim_accounting_jobs_v2", {
    p_worker_id: workerId,
    p_limit: Math.min(Math.max(limit, 1), 25),
  });
  if (error) throw new Error("ACCOUNTING_JOB_CLAIM_FAILED");
  const results = [];
  for (const job of (data ?? []) as ClaimedJob[]) {
    try {
      await processJob(job);
      logAccountingEvent("job_succeeded", job);
      results.push({ jobId: job.id, status: "succeeded" });
    } catch (jobError) {
      const failure = await failJob(job, jobError).catch(() => ({
        status: "requires_attention",
        category: "conflict",
        code: "ACCOUNTING_LEASE_LOST",
      }));
      logAccountingEvent("job_failed", job, failure);
      results.push({ jobId: job.id, ...failure });
    }
  }
  return { ok: true as const, claimed: results.length, results };
}
