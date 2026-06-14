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
      .select("event_type, session_hash, product_id, revenue_aed, order_id, created_at")
      .gte("created_at", todayStart)
      .limit(20000);
    const today = todayEvents ?? [];
    const todaySessions = new Set<string>();
    const productPurchase = new Map<string, { count: number; revenue: number }>();
    const productAdds = new Map<string, number>();
    const seenOrders = new Set<string>();
    let revenue = 0;
    let orders = 0;
    for (const e of today) {
      if (e.session_hash) todaySessions.add(e.session_hash);
      if (e.event_type === "purchase_completed") {
        if (e.order_id) {
          if (!seenOrders.has(e.order_id)) {
            seenOrders.add(e.order_id);
            orders += 1;
            revenue += Number(e.revenue_aed ?? 0);
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

    // ---- Geo: recent paid orders by emirate (last 24h) ----
    const { data: recentOrders } = await supabaseAdmin
      .from("orders")
      .select("id, total_aed, shipping_address, created_at, paid_at, payment_status")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(500);
    const orderPoints: Array<{ lat: number; lng: number; label: string; total: number; ts: string }> = [];
    const locationAgg = new Map<string, { sessions: number; sales: number }>();
    for (const o of recentOrders ?? []) {
      const addr = (o.shipping_address as any) ?? {};
      const code = String(addr.emirate ?? "").toUpperCase();
      const c = EMIRATE_COORDS[code];
      if (!c) continue;
      orderPoints.push({
        lat: c.lat + (Math.random() - 0.5) * 0.06,
        lng: c.lng + (Math.random() - 0.5) * 0.06,
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
      .map(([label, v]) => ({ label, sessions: v.sessions, sales: v.sales }));

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
        .from("products").select("id, name, slug").in("id", topProductIds);
      for (const p of prods ?? []) productMeta[p.id] = { name: p.name, slug: p.slug };
    }
    const topProducts = Array.from(productPurchase.entries())
      .map(([id, v]) => ({
        id, name: productMeta[id]?.name ?? "—", slug: productMeta[id]?.slug,
        units: v.count, revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      generatedAt: new Date(now).toISOString(),
      kpis: {
        visitorsNow: visitorsNow.size,
        totalSessionsToday: todaySessions.size,
        totalSales: revenue,
        totalOrders: orders,
      },
      behavior: {
        activeCarts: activeCarts.size,
        checkingOut: checkingOut.size,
        purchased: purchased.size,
      },
      pageViews: buckets,
      orderPoints,
      arcs,
      topLocations,
      topProducts,
    };
  });

export type LiveView = Awaited<ReturnType<typeof getLiveView>>;