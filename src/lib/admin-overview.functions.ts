import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";
import { ORDER_STATES, PAYMENT_STATES } from "@/lib/order-lifecycle";

export const adminOverviewCanonical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const since30 = new Date(now.getTime() - 30 * day).toISOString();
    const since60 = new Date(now.getTime() - 60 * day).toISOString();
    const since7 = new Date(now.getTime() - 7 * day).toISOString();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();

    const [orders, products, items, buyers, recent, lowStock] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, total_aed, status, payment_status, payment_method, created_at, buyer_id")
        .gte("created_at", since60),
      supabaseAdmin.from("products").select("id, status"),
      supabaseAdmin
        .from("order_items")
        .select("product_id, product_name, qty, line_total_aed")
        .limit(5000),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("orders")
        .select("id, order_number, total_aed, status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("product_variants").select("product_id, stock").lte("stock", 5),
    ]);

    for (const result of [orders, products, items, recent, lowStock]) {
      if (result.error) throw new Error("CM_ADMIN_OVERVIEW_QUERY_FAILED");
    }

    const allOrders = orders.data ?? [];
    const totalAed = (rows: typeof allOrders) =>
      rows.reduce((total, row) => total + Number(row.total_aed ?? 0), 0);
    const inWindow = (iso: string, fromIso: string) => iso >= fromIso;
    const o30 = allOrders.filter((order) => inWindow(order.created_at, since30));
    const o60to30 = allOrders.filter((order) => order.created_at < since30);
    const o7 = allOrders.filter((order) => inWindow(order.created_at, since7));
    const oToday = allOrders.filter((order) => inWindow(order.created_at, startToday));

    const gmv30 = +totalAed(o30).toFixed(2);
    const gmvPrev30 = +totalAed(o60to30).toFixed(2);
    const gmvDelta =
      gmvPrev30 > 0
        ? +(((gmv30 - gmvPrev30) / gmvPrev30) * 100).toFixed(1)
        : null;

    const statusBreakdown = ORDER_STATES.map((status) => ({
      status,
      count: allOrders.filter((order) => order.status === status).length,
    }));
    const paymentBreakdown = PAYMENT_STATES.map((status) => ({
      status,
      count: allOrders.filter((order) => order.payment_status === status).length,
    }));
    const methodBreakdown = Object.entries(
      allOrders.reduce<Record<string, number>>((acc, order) => {
        const key = order.payment_method ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([method, count]) => ({ method, count }));

    const productAgg = new Map<string, { name: string; units: number; gmv: number }>();
    for (const item of items.data ?? []) {
      const current = productAgg.get(item.product_id) ?? {
        name: item.product_name,
        units: 0,
        gmv: 0,
      };
      current.units += Number(item.qty ?? 0);
      current.gmv += Number(item.line_total_aed ?? 0);
      productAgg.set(item.product_id, current);
    }

    const topProducts = Array.from(productAgg.entries())
      .map(([id, value]) => ({
        id,
        name: value.name,
        units: value.units,
        gmv: +value.gmv.toFixed(2),
      }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);

    const allProducts = products.data ?? [];
    const uniqueBuyers30 = new Set(o30.map((order) => order.buyer_id)).size;
    const pendingFulfillmentStates = new Set(["pending", "confirmed", "processing"]);

    return {
      gmv30,
      gmvDelta,
      gmvToday: +totalAed(oToday).toFixed(2),
      gmv7: +totalAed(o7).toFixed(2),
      orders30: o30.length,
      orders7: o7.length,
      ordersToday: oToday.length,
      aov: o30.length ? +(gmv30 / o30.length).toFixed(2) : 0,
      buyers: buyers.count ?? 0,
      uniqueBuyers30,
      products: allProducts.length,
      activeProducts: allProducts.filter((product) => product.status === "active").length,
      draftProducts: allProducts.filter((product) => product.status === "draft").length,
      lowStockCount: (lowStock.data ?? []).length,
      pendingFulfillment: allOrders.filter((order) =>
        pendingFulfillmentStates.has(order.status),
      ).length,
      statusBreakdown,
      paymentBreakdown,
      methodBreakdown,
      topProducts,
      recentOrders: recent.data ?? [],
    };
  });
