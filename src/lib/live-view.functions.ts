import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// UAE emirate centroids — orders carry an `emirate` code in shipping_address.
const EMIRATE_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  AD: { lat: 24.4539, lng: 54.3773, label: "Abu Dhabi" },
  DU: { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  SH: { lat: 25.3463, lng: 55.4209, label: "Sharjah" },
  AJ: { lat: 25.4052, lng: 55.5136, label: "Ajman" },
  UQ: { lat: 25.5647, lng: 55.5552, label: "Umm Al Quwain" },
  RK: { lat: 25.7895, lng: 55.9432, label: "Ras Al Khaimah" },
  FU: { lat: 25.1288, lng: 56.3265, label: "Fujairah" },
};

// Origin point for arcs (CornerMex HQ — Dubai). Used only as a visual anchor.
const HQ = { lat: 25.2048, lng: 55.2708, label: "CornerMex HQ" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Deterministic jitter in [-0.03, 0.03] from a string seed (order id / emirate).
function stableJitter(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  // Map to [-1, 1) then scale
  const n = ((h >>> 0) % 10000) / 10000; // [0,1)
  return (n - 0.5) * 0.06;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const getLiveView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const todayStart = new Date(now - DAY_MS).toISOString();

    // ---- Live catalog events (last 10 min) ----
    const { data: liveEvents } = await supabaseAdmin
      .from("catalog_events")
      .select("event_type, session_hash, created_at, product_id, revenue_aed, order_id")
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: true })
      .limit(5000);
    const live = liveEvents ?? [];

    const visitorsNow = new Set<string>();
    const activeCarts = new Set<string>();
    const checkingOut = new Set<string>();
    const purchased = new Set<string>();
    // page-views per minute (last 10 buckets)
    const buckets = new Array(10).fill(0);
    for (const e of live) {
      if (e.session_hash) visitorsNow.add(e.session_hash);
      if (e.event_type === "add_to_cart" && e.session_hash) activeCarts.add(e.session_hash);
      if (e.event_type === "checkout_started" && e.session_hash) checkingOut.add(e.session_hash);
      if (e.event_type === "purchase_completed" && e.session_hash) purchased.add(e.session_hash);
      if (e.event_type === "product_view") {
        const minutesAgo = Math.floor((now - new Date(e.created_at).getTime()) / 60_000);
        const idx = 9 - Math.min(9, Math.max(0, minutesAgo));
        buckets[idx] += 1;
      }
    }

    // ---- Today's totals ----
    const { data: todayEvents } = await supabaseAdmin
      .from("catalog_events")
      .select("event_type, session_hash, product_id, revenue_aed, order_id, created_at, source")
      .gte("created_at", todayStart)
      .limit(20000);
    const today = todayEvents ?? [];
    const todaySessions = new Set<string>();
    const productPurchase = new Map<string, { count: number; revenue: number }>();
    const productAdds = new Map<string, number>();
    const seenOrders = new Set<string>();
    let revenue = 0;
    let orders = 0;
    // Extra aggregates
    const cartSessions = new Set<string>();
    const checkoutSessions = new Set<string>();
    const purchasedSessions = new Set<string>();
    const sourceAgg = new Map<string, { sessions: Set<string>; orders: number; revenue: number }>();
    const sessionSource = new Map<string, string>();
    // hourly sales for last 24h (24 buckets, idx 23 = current hour)
    const hourlySales = new Array(24).fill(0);
    const hourlyOrders = new Array(24).fill(0);
    for (const e of today) {
      if (e.session_hash) todaySessions.add(e.session_hash);
      if (e.session_hash && e.source && !sessionSource.has(e.session_hash)) {
        sessionSource.set(e.session_hash, e.source);
      }
      if (e.event_type === "add_to_cart" && e.session_hash) cartSessions.add(e.session_hash);
      if (e.event_type === "checkout_started" && e.session_hash) checkoutSessions.add(e.session_hash);
      if (e.event_type === "purchase_completed") {
        if (e.session_hash) purchasedSessions.add(e.session_hash);
        if (e.order_id) {
          if (!seenOrders.has(e.order_id)) {
            seenOrders.add(e.order_id);
            orders += 1;
            revenue += Number(e.revenue_aed ?? 0);
            const hoursAgo = Math.floor((now - new Date(e.created_at).getTime()) / 3_600_000);
            const idx = 23 - Math.min(23, Math.max(0, hoursAgo));
            hourlySales[idx] += Number(e.revenue_aed ?? 0);
            hourlyOrders[idx] += 1;
          }
        } else {
          orders += 1;
          revenue += Number(e.revenue_aed ?? 0);
        }
        if (e.product_id) {
          const p = productPurchase.get(e.product_id) ?? { count: 0, revenue: 0 };
          p.count += 1;
          p.revenue += Number(e.revenue_aed ?? 0);
          productPurchase.set(e.product_id, p);
        }
      }
      if (e.event_type === "add_to_cart" && e.product_id) {
        productAdds.set(e.product_id, (productAdds.get(e.product_id) ?? 0) + 1);
      }
    }

    // Source attribution (per session, using earliest seen source)
    for (const [sess, src] of sessionSource.entries()) {
      const key = src || "direct";
      const agg = sourceAgg.get(key) ?? { sessions: new Set<string>(), orders: 0, revenue: 0 };
      agg.sessions.add(sess);
      if (purchasedSessions.has(sess)) agg.orders += 1;
      sourceAgg.set(key, agg);
    }
    const topSources = Array.from(sourceAgg.entries())
      .map(([source, v]) => ({
        source,
        sessions: v.sessions.size,
        orders: v.orders,
        conversion: v.sessions.size ? v.orders / v.sessions.size : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // New vs returning: a session is "returning" if its hash appears in catalog_events
    // before today's window.
    const sessionHashes = Array.from(todaySessions);
    let returningCount = 0;
    if (sessionHashes.length) {
      const { data: prior } = await supabaseAdmin
        .from("catalog_events")
        .select("session_hash")
        .lt("created_at", todayStart)
        .in("session_hash", sessionHashes.slice(0, 500))
        .limit(2000);
      const seen = new Set((prior ?? []).map((r: any) => r.session_hash).filter(Boolean));
      returningCount = seen.size;
    }
    const newVisitors = Math.max(0, todaySessions.size - returningCount);

    // Derived KPIs
    const aov = orders ? revenue / orders : 0;
    const conversionRate = todaySessions.size ? purchasedSessions.size / todaySessions.size : 0;
    const cartAbandonment = cartSessions.size
      ? 1 - purchasedSessions.size / cartSessions.size
      : 0;
    const checkoutAbandonment = checkoutSessions.size
      ? 1 - purchasedSessions.size / checkoutSessions.size
      : 0;

    // ---- Geo: recent paid orders by emirate (last 24h) ----
    const { data: recentOrders } = await supabaseAdmin
      .from("orders")
      .select("id, total_aed, shipping_address, created_at, paid_at, payment_status")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(500);
    const orderPoints: Array<{ lat: number; lng: number; label: string; total: number; ts: string }> = [];
    const locationAgg = new Map<string, { sessions: number; sales: number }>();
    const paidStatuses = new Set(["paid", "succeeded", "completed"]);
    const paidOrders = (recentOrders ?? []).filter(
      (o: any) => o.paid_at != null || paidStatuses.has(String(o.payment_status ?? "").toLowerCase()),
    );
    for (const o of paidOrders) {
      const addr = (o.shipping_address as any) ?? {};
      const code = String(addr.emirate ?? "").toUpperCase();
      const c = EMIRATE_COORDS[code];
      if (!c) continue;
      orderPoints.push({
        lat: c.lat + stableJitter(String(o.id), 1),
        lng: c.lng + stableJitter(String(o.id), 2),
        label: c.label,
        total: Number(o.total_aed ?? 0),
        ts: o.created_at,
      });
      const agg = locationAgg.get(c.label) ?? { sessions: 0, sales: 0 };
      agg.sessions += 1;
      agg.sales += Number(o.total_aed ?? 0);
      locationAgg.set(c.label, agg);
    }
    const topLocations = Array.from(locationAgg.entries())
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 5)
      .map(([label, v]) => ({ label, orders: v.sessions, sales: v.sales }));

    const lastPaidLabel = orderPoints[0]?.label;
    const activeEmirates = new Set(orderPoints.map((p) => p.label)).size;

    // ---- Per-emirate summary (paid orders only) ----
    // TODO: catalog_events has no emirate/location column, so per-session
    // attribution (sessions, carts, checkout, source) by emirate is not
    // available yet. Once session_hash → emirate is captured server-side,
    // wire it in here and flip the corresponding dataQuality flags.
    const orderIdToEmirate = new Map<string, string>();
    const emirateAgg = new Map<string, {
      orders: number; salesAed: number; lastOrderAt: string | null;
      productRevenue: Map<string, number>;
    }>();
    for (const o of paidOrders) {
      const addr = (o.shipping_address as any) ?? {};
      const code = String(addr.emirate ?? "").toUpperCase();
      if (!EMIRATE_COORDS[code]) continue;
      orderIdToEmirate.set(String(o.id), code);
      const cur = emirateAgg.get(code) ?? {
        orders: 0, salesAed: 0, lastOrderAt: null, productRevenue: new Map(),
      };
      cur.orders += 1;
      cur.salesAed += Number(o.total_aed ?? 0);
      const ts = o.created_at as string;
      if (!cur.lastOrderAt || new Date(ts) > new Date(cur.lastOrderAt)) cur.lastOrderAt = ts;
      emirateAgg.set(code, cur);
    }
    // Attribute product revenue to emirate via purchase_completed events
    // that carry both order_id and product_id.
    for (const e of today) {
      if (e.event_type !== "purchase_completed" || !e.order_id || !e.product_id) continue;
      const code = orderIdToEmirate.get(String(e.order_id));
      if (!code) continue;
      const agg = emirateAgg.get(code);
      if (!agg) continue;
      const rev = Number(e.revenue_aed ?? 0);
      agg.productRevenue.set(
        e.product_id,
        (agg.productRevenue.get(e.product_id) ?? 0) + rev,
      );
    }
    // Ensure product meta is loaded for top-per-emirate products.
    const extraTopIds = new Set<string>();
    for (const agg of emirateAgg.values()) {
      for (const pid of agg.productRevenue.keys()) {
        if (!productMeta[pid]) extraTopIds.add(pid);
      }
    }
    if (extraTopIds.size) {
      const { data: extra } = await supabaseAdmin
        .from("products")
        .select("id, slug, product_translations(name, locale)")
        .in("id", Array.from(extraTopIds));
      for (const p of (extra ?? []) as any[]) {
        const tr = (p.product_translations as any[] | null) ?? [];
        const en = tr.find((t) => t.locale === "en") ?? tr[0];
        productMeta[p.id] = { name: en?.name ?? "—", slug: p.slug };
      }
    }
    const locationSummary = Object.entries(EMIRATE_COORDS).map(([code, meta]) => {
      const agg = emirateAgg.get(code);
      let topProductId: string | null = null;
      let topProductRevenueAed = 0;
      if (agg) {
        for (const [pid, rev] of agg.productRevenue.entries()) {
          if (rev > topProductRevenueAed) {
            topProductRevenueAed = rev;
            topProductId = pid;
          }
        }
      }
      const top = topProductId ? productMeta[topProductId] : undefined;
      return {
        emirateCode: code,
        emirateName: meta.label,
        orders: agg?.orders ?? 0,
        salesAed: agg?.salesAed ?? 0,
        // Per-emirate session/cart/checkout/source data requires session-level
        // location attribution which catalog_events does not yet carry.
        sessions: null as number | null,
        activeCarts: null as number | null,
        checkingOut: null as number | null,
        purchased: agg?.orders ?? 0,
        conversionRate: null as number | null,
        cartAbandonment: null as number | null,
        checkoutAbandonment: null as number | null,
        topProductId,
        topProductName: top?.name ?? null,
        topProductSlug: top?.slug ?? null,
        topProductRevenueAed: topProductRevenueAed || null,
        topSource: null as string | null,
        // Placeholder: no courier SLA integration wired yet.
        deliveryRisk: null as null | "low" | "medium" | "high",
        lastOrderAt: agg?.lastOrderAt ?? null,
      };
    });

    const anyEmirateOrders = locationSummary.some((l) => l.orders > 0);
    const anyEmirateTopProduct = locationSummary.some((l) => l.topProductId);
    const dataQuality = {
      locationData: anyEmirateOrders ? ("partial" as const) : ("unavailable" as const),
      paidOrdersOnly: true,
      sessionLocationAttribution: "missing" as const,
      deliverySlaData: "placeholder" as const,
      productHeatData: anyEmirateTopProduct ? ("partial" as const) : ("unavailable" as const),
      trafficSourceByEmirate: "missing" as const,
      anomalyPersistence: "connected" as const,
    };

    // Arcs: HQ → each recent order point (cap to 30 newest for perf)
    const arcs = orderPoints.slice(0, 30).map((p) => ({
      startLat: HQ.lat, startLng: HQ.lng,
      endLat: p.lat, endLng: p.lng,
      label: `${p.label} · AED ${p.total.toFixed(2)}`,
    }));

    // ---- Top products today ----
    const topProductIds = Array.from(new Set([
      ...Array.from(productPurchase.keys()),
      ...Array.from(productAdds.keys()),
    ])).slice(0, 50);
    let productMeta: Record<string, { name: string; slug: string }> = {};
    if (topProductIds.length) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("id, slug, product_translations(name, locale)")
        .in("id", topProductIds);
      for (const p of (prods ?? []) as any[]) {
        const tr = (p.product_translations as any[] | null) ?? [];
        const en = tr.find((t) => t.locale === "en") ?? tr[0];
        productMeta[p.id] = { name: en?.name ?? "—", slug: p.slug };
      }
    }
    const topProducts = Array.from(productPurchase.entries())
      .map(([id, v]) => ({
        id, name: productMeta[id]?.name ?? "—", slug: productMeta[id]?.slug,
        units: v.count, revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ---- Activity feed (last 15 storefront events) ----
    const feedEventTypes = [
      "product_view",
      "add_to_cart",
      "checkout_started",
      "purchase_completed",
    ] as const;
    const { data: feedEvents } = await supabaseAdmin
      .from("catalog_events")
      .select("id, event_type, product_id, revenue_aed, created_at, source")
      .in("event_type", feedEventTypes)
      .order("created_at", { ascending: false })
      .limit(15);
    const feedProductIds = Array.from(
      new Set((feedEvents ?? []).map((e: any) => e.product_id).filter(Boolean)),
    ).filter((id) => !productMeta[id as string]);
    if (feedProductIds.length) {
      const { data: extraProds } = await supabaseAdmin
        .from("products")
        .select("id, slug, product_translations(name, locale)")
        .in("id", feedProductIds as string[]);
      for (const p of (extraProds ?? []) as any[]) {
        const tr = (p.product_translations as any[] | null) ?? [];
        const en = tr.find((t) => t.locale === "en") ?? tr[0];
        productMeta[p.id] = { name: en?.name ?? "—", slug: p.slug };
      }
    }
    const activityFeed = (feedEvents ?? []).map((e: any) => ({
      id: String(e.id),
      eventType: e.event_type as string,
      productName: e.product_id ? productMeta[e.product_id]?.name : undefined,
      productSlug: e.product_id ? productMeta[e.product_id]?.slug : undefined,
      revenueAed: e.revenue_aed != null ? Number(e.revenue_aed) : undefined,
      createdAt: e.created_at as string,
      source: (e.source as string | null) ?? undefined,
    }));

    return {
      generatedAt: new Date(now).toISOString(),
      windowLabel: "Last 24h",
      kpis: {
        visitorsNow: visitorsNow.size,
        totalSessionsToday: todaySessions.size,
        totalSales: revenue,
        totalOrders: orders,
        aov,
        conversionRate: clamp01(conversionRate),
        cartAbandonment: clamp01(cartAbandonment),
        checkoutAbandonment: clamp01(checkoutAbandonment),
        newVisitors,
        returningVisitors: returningCount,
      },
      behavior: {
        activeCarts: activeCarts.size,
        checkingOut: checkingOut.size,
        purchased: purchased.size,
      },
      pageViews: buckets,
      hourlySales,
      hourlyOrders,
      topSources,
      orderPoints,
      arcs,
      topLocations,
      topProducts,
      activityFeed,
      globeStats: {
        orders: orderPoints.length,
        emirates: activeEmirates,
        lastLabel: lastPaidLabel,
      },
      locationSummary,
      dataQuality,
    };
  });

export type LiveView = Awaited<ReturnType<typeof getLiveView>>;
export type LocationSummary = LiveView["locationSummary"][number];