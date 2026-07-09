import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export type AnomalyStatus = "open" | "investigating" | "resolved" | "dismissed";

export type AnomalyCandidate = {
  anomalyKey: string;
  type: string;
  severity: "info" | "opportunity" | "warning" | "critical";
  title: string;
  description?: string | null;
  evidence?: Record<string, unknown>;
  hypotheses?: string[];
  suggestedAction?: string | null;
  emirateCode?: string | null;
  emirateName?: string | null;
  productId?: string | null;
  productSlug?: string | null;
  confidenceScore?: number | null;
};

export const getAnomalyEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { statuses?: AnomalyStatus[] } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const statuses = data.statuses && data.statuses.length
      ? data.statuses
      : (["open", "investigating"] as AnomalyStatus[]);
    const { data: rows, error } = await supabaseAdmin
      .from("anomaly_events")
      .select("*")
      .in("status", statuses)
      .order("last_detected_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return rows ?? [];
  });

export const upsertAnomalyCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AnomalyCandidate) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("anomaly_events")
      .select("id, status, first_detected_at")
      .eq("anomaly_key", data.anomalyKey)
      .maybeSingle();

    const payload = {
      anomaly_key: data.anomalyKey,
      type: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description ?? null,
      evidence: (data.evidence ?? {}) as any,
      hypotheses: (data.hypotheses ?? []) as any,
      suggested_action: data.suggestedAction ?? null,
      emirate_code: data.emirateCode ?? null,
      emirate_name: data.emirateName ?? null,
      product_id: data.productId ?? null,
      product_slug: data.productSlug ?? null,
      confidence_score: data.confidenceScore ?? null,
      source: "live_view_rule_based",
      last_detected_at: new Date().toISOString(),
    };

    if (existing) {
      // Reopen if it was previously resolved/dismissed and the rule fired again.
      const nextStatus = existing.status === "resolved" || existing.status === "dismissed"
        ? "open"
        : existing.status;
      const { data: updated, error } = await supabaseAdmin
        .from("anomaly_events")
        .update({ ...payload, status: nextStatus, resolved_at: null, dismissed_at: null })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("anomaly_events")
      .insert({ ...payload, status: "open" })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });

export const updateAnomalyEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: AnomalyStatus }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const patch = {
      status: data.status,
      resolved_at: data.status === "resolved" ? now : null,
      dismissed_at: data.status === "dismissed" ? now : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("anomaly_events")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export type AnomalyEventRow = Awaited<ReturnType<typeof getAnomalyEvents>>[number];