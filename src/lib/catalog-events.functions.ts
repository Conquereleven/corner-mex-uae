import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CATALOG_EVENT_TYPES = [
  "card_impression",
  "card_click",
  "product_view",
  "add_to_cart",
  "wishlist_add",
  "b2b_lead_submit",
  "checkout_started",
  "purchase_completed",
] as const;
export type CatalogEventType = (typeof CATALOG_EVENT_TYPES)[number];

const TrackSchema = z.object({
  eventType: z.enum(CATALOG_EVENT_TYPES),
  productId: z.string().uuid().optional(),
  source: z.string().max(64).optional(),
  sessionHash: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  orderId: z.string().uuid().optional(),
  revenueAed: z.number().nonnegative().max(10_000_000).optional(),
});

export const trackCatalogEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TrackSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let sellerId: string | null = null;
    let categoryId: string | null = null;
    if (data.productId) {
      const { data: p } = await supabaseAdmin
        .from("products")
        .select("seller_id, category_id")
        .eq("id", data.productId)
        .maybeSingle();
      sellerId = (p as any)?.seller_id ?? null;
      categoryId = (p as any)?.category_id ?? null;
    }

    await supabaseAdmin.from("catalog_events").insert({
      event_type: data.eventType,
      product_id: data.productId ?? null,
      seller_id: sellerId,
      category_id: categoryId,
      session_hash: data.sessionHash ?? null,
      source: data.source ?? null,
      metadata: (data.metadata as any) ?? null,
      order_id: data.orderId ?? null,
      revenue_aed: data.revenueAed ?? null,
    });
    return { ok: true };
  });

const RangeSchema = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const FUNNEL: CatalogEventType[] = [
  "card_impression",
  "card_click",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase_completed",
];

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

type EventRow = {
  event_type: CatalogEventType;
  session_hash: string | null;
  created_at: string;
  revenue_aed: number | null;
  order_id: string | null;
};

async function fetchEvents(sinceIso: string): Promise<EventRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: EventRow[] = [];
  const PAGE = 1000;
  let from = 0;
  // paginate up to a hard cap to avoid runaway scans on large windows
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabaseAdmin
      .from("catalog_events")
      .select("event_type, session_hash, created_at, revenue_aed, order_id")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as EventRow[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function weekKey(iso: string): string {
  // ISO week (Monday-based) start date as YYYY-MM-DD
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const getCatalogAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const sinceIso = new Date(Date.now() - data.days * DAY_MS).toISOString();
    const rows = await fetchEvents(sinceIso);

    // ---- Funnel totals (events + unique sessions) ----
    const totals: Record<CatalogEventType, { events: number; sessions: Set<string> }> = Object.fromEntries(
      CATALOG_EVENT_TYPES.map((t) => [t, { events: 0, sessions: new Set<string>() }]),
    ) as any;
    for (const r of rows) {
      const bucket = totals[r.event_type];
      if (!bucket) continue;
      bucket.events += 1;
      if (r.session_hash) bucket.sessions.add(r.session_hash);
    }
    const funnel = CATALOG_EVENT_TYPES.map((t) => ({
      eventType: t,
      events: totals[t].events,
      sessions: totals[t].sessions.size,
    }));

    // ---- Revenue KPIs (dedupe by order_id on purchase_completed) ----
    const seenOrders = new Set<string>();
    let revenue = 0;
    let orders = 0;
    for (const r of rows) {
      if (r.event_type !== "purchase_completed") continue;
      if (r.order_id) {
        if (seenOrders.has(r.order_id)) continue;
        seenOrders.add(r.order_id);
      }
      orders += 1;
      revenue += Number(r.revenue_aed ?? 0);
    }
    const impressionSessions = totals["card_impression"].sessions.size;
    const aov = orders ? revenue / orders : 0;
    const conversionRate = impressionSessions
      ? totals["purchase_completed"].sessions.size / impressionSessions
      : 0;
    const kpis = { revenue, orders, aov, conversionRate };

    // ---- Cohorts: weekly cohort of session's first impression ----
    // session_hash -> { cohort, hit: Record<eventType, boolean> }
    const sessions = new Map<string, { cohort: string; hit: Record<string, boolean> }>();
    // first pass: assign cohort from earliest card_impression
    for (const r of rows) {
      if (r.event_type !== "card_impression" || !r.session_hash) continue;
      const existing = sessions.get(r.session_hash);
      if (!existing) {
        sessions.set(r.session_hash, { cohort: weekKey(r.created_at), hit: { card_impression: true } });
      }
    }
    // second pass: mark downstream events for sessions in a cohort
    for (const r of rows) {
      if (!r.session_hash) continue;
      const s = sessions.get(r.session_hash);
      if (!s) continue;
      s.hit[r.event_type] = true;
    }
    const cohortMap = new Map<string, { cohort: string; counts: Record<string, number> }>();
    for (const s of sessions.values()) {
      const c = cohortMap.get(s.cohort) ?? {
        cohort: s.cohort,
        counts: Object.fromEntries(FUNNEL.map((t) => [t, 0])),
      };
      for (const t of FUNNEL) if (s.hit[t]) c.counts[t] += 1;
      cohortMap.set(s.cohort, c);
    }
    const cohorts = Array.from(cohortMap.values())
      .sort((a, b) => (a.cohort < b.cohort ? 1 : -1))
      .map((c) => ({
        cohort: c.cohort,
        impressions: c.counts.card_impression,
        clicks: c.counts.card_click,
        views: c.counts.product_view,
        addToCart: c.counts.add_to_cart,
        checkout: c.counts.checkout_started ?? 0,
        purchases: c.counts.purchase_completed ?? 0,
        ctr: c.counts.card_impression ? c.counts.card_click / c.counts.card_impression : 0,
        viewRate: c.counts.card_click ? c.counts.product_view / c.counts.card_click : 0,
        cartRate: c.counts.product_view ? c.counts.add_to_cart / c.counts.product_view : 0,
        purchaseRate: c.counts.card_impression
          ? (c.counts.purchase_completed ?? 0) / c.counts.card_impression
          : 0,
      }));

    return { days: data.days, funnel, cohorts, kpis };
  });

export type CatalogAnalytics = Awaited<ReturnType<typeof getCatalogAnalytics>>;