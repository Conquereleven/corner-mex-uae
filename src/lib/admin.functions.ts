import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    return { admin: !!data };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const since30 = new Date(now.getTime() - 30 * day).toISOString();
    const since60 = new Date(now.getTime() - 60 * day).toISOString();
    const since7 = new Date(now.getTime() - 7 * day).toISOString();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [orders, sellers, products, pendingSellers, items, buyers, recent, lowStock] = await Promise.all([
      supabaseAdmin.from("orders").select("id, total_aed, status, payment_status, payment_method, created_at, buyer_id").gte("created_at", since60),
      supabaseAdmin.from("sellers").select("id, status, store_name, created_at"),
      supabaseAdmin.from("products").select("id, status"),
      supabaseAdmin.from("sellers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("order_items").select("seller_id, product_id, product_name, qty, line_total_aed, commission_aed").limit(5000),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id, order_number, total_aed, status, payment_status, created_at").order("created_at", { ascending: false }).limit(8),
      supabaseAdmin.from("product_variants").select("product_id, stock").lte("stock", 5),
    ]);

    const allOrders = orders.data ?? [];
    const sum = (xs: any[], k: string) => xs.reduce((a, o) => a + Number(o[k] ?? 0), 0);
    const inWindow = (iso: string, fromIso: string) => iso >= fromIso;

    const o30 = allOrders.filter((o) => inWindow(o.created_at, since30));
    const o60to30 = allOrders.filter((o) => o.created_at < since30);
    const o7 = allOrders.filter((o) => inWindow(o.created_at, since7));
    const oToday = allOrders.filter((o) => inWindow(o.created_at, startToday));

    const gmv30 = +sum(o30, "total_aed").toFixed(2);
    const gmvPrev30 = +sum(o60to30, "total_aed").toFixed(2);
    const gmvDelta = gmvPrev30 > 0 ? +(((gmv30 - gmvPrev30) / gmvPrev30) * 100).toFixed(1) : null;

    // Build daily series (last 30 days)
    const series: { date: string; gmv: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * day);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = o30.filter((o) => o.created_at.slice(0, 10) === key);
      series.push({ date: key, gmv: +sum(dayOrders, "total_aed").toFixed(2), orders: dayOrders.length });
    }

    // Status / payment breakdowns
    const statusBreakdown = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"].map((s) => ({
      status: s,
      count: allOrders.filter((o) => o.status === s).length,
    }));
    const paymentBreakdown = ["paid", "pending", "failed", "refunded"].map((s) => ({
      status: s,
      count: allOrders.filter((o) => o.payment_status === s).length,
    }));
    const methodBreakdown = Object.entries(
      allOrders.reduce((acc: Record<string, number>, o: any) => {
        const k = o.payment_method ?? "unknown";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([method, count]) => ({ method, count: count as number }));

    // Top sellers by GMV (from order_items)
    const sellerMap = new Map((sellers.data ?? []).map((s: any) => [s.id, s.store_name]));
    const sellerAgg = new Map<string, { gmv: number; units: number; commission: number }>();
    const productAgg = new Map<string, { name: string; units: number; gmv: number }>();
    for (const it of (items.data ?? []) as any[]) {
      const cur = sellerAgg.get(it.seller_id) ?? { gmv: 0, units: 0, commission: 0 };
      cur.gmv += Number(it.line_total_aed ?? 0);
      cur.units += Number(it.qty ?? 0);
      cur.commission += Number(it.commission_aed ?? 0);
      sellerAgg.set(it.seller_id, cur);
      const p = productAgg.get(it.product_id) ?? { name: it.product_name, units: 0, gmv: 0 };
      p.units += Number(it.qty ?? 0);
      p.gmv += Number(it.line_total_aed ?? 0);
      productAgg.set(it.product_id, p);
    }
    const topSellers = Array.from(sellerAgg.entries())
      .map(([id, v]) => ({ id, name: sellerMap.get(id) ?? "—", gmv: +v.gmv.toFixed(2), units: v.units, commission: +v.commission.toFixed(2) }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);
    const topProducts = Array.from(productAgg.entries())
      .map(([id, v]) => ({ id, name: v.name, units: v.units, gmv: +v.gmv.toFixed(2) }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);

    const allSellers = sellers.data ?? [];
    const allProducts = products.data ?? [];
    const uniqueBuyers30 = new Set(o30.map((o) => o.buyer_id)).size;
    const totalCommission = +(items.data ?? []).reduce((a: number, it: any) => a + Number(it.commission_aed ?? 0), 0).toFixed(2);

    return {
      // KPI cards
      gmv: +sum(allOrders, "total_aed").toFixed(2),
      gmv30,
      gmvDelta,
      gmvToday: +sum(oToday, "total_aed").toFixed(2),
      gmv7: +sum(o7, "total_aed").toFixed(2),
      orders: allOrders.length,
      orders30: o30.length,
      orders7: o7.length,
      ordersToday: oToday.length,
      aov: o30.length ? +(gmv30 / o30.length).toFixed(2) : 0,
      commission: totalCommission,
      buyers: buyers.count ?? 0,
      uniqueBuyers30,
      sellers: allSellers.length,
      activeSellers: allSellers.filter((s: any) => s.status === "active").length,
      pendingSellers: pendingSellers.count ?? 0,
      products: allProducts.length,
      activeProducts: allProducts.filter((p: any) => p.status === "active").length,
      draftProducts: allProducts.filter((p: any) => p.status === "draft").length,
      lowStockCount: (lowStock.data ?? []).length,
      pendingFulfillment: allOrders.filter((o) => ["pending", "confirmed"].includes(o.status)).length,
      // Series & breakdowns
      series,
      statusBreakdown,
      paymentBreakdown,
      methodBreakdown,
      topSellers,
      topProducts,
      recentOrders: recent.data ?? [],
    };
  });

export const adminListSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sellers")
      .select("id, slug, store_name, status, contact_email, contact_phone, trn, commission_rate, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetSellerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerId: string; status: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      status: z.enum(["pending", "active", "suspended", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("sellers").update({ status: data.status as any }).eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, payment_status, payment_method, total_aed, created_at, buyer_id")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: string }) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("orders").update({ status: data.status as any }).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Allow first user to claim admin if there are no admins yet.
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Ask an admin to grant access.");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });