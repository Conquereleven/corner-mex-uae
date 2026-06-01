import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  sellerId: z.string().uuid().optional(),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

const DAY_MS = 24 * 60 * 60 * 1000;

type ItemRow = {
  id: string;
  seller_id: string;
  qty: number;
  line_total_aed: number;
  commission_aed: number;
  fulfillment_status: string;
  product_id: string;
  product_name: string;
  order: { id: string; buyer_id: string; created_at: string; status: string; payment_status: string } | null;
};

function pct(num: number, den: number) {
  if (!den) return 0;
  return num / den;
}

function bucketByDay(items: ItemRow[], days: number, anchor: Date) {
  const start = new Date(anchor.getTime() - (days - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  const map = new Map<string, { date: string; revenue: number; orders: Set<string> }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, revenue: 0, orders: new Set() });
  }
  for (const it of items) {
    if (!it.order) continue;
    const key = it.order.created_at.slice(0, 10);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(it.line_total_aed ?? 0);
    bucket.orders.add(it.order.id);
  }
  return Array.from(map.values()).map((b) => ({ date: b.date, revenue: b.revenue, orders: b.orders.size }));
}

function aggregate(items: ItemRow[]) {
  let gmv = 0;
  let commission = 0;
  let units = 0;
  let fulfilled = 0;
  let cancelled = 0;
  const orderIds = new Set<string>();
  const productMap = new Map<string, { id: string; name: string; revenue: number; qty: number }>();

  for (const it of items) {
    if (!it.order) continue;
    const line = Number(it.line_total_aed ?? 0);
    gmv += line;
    commission += Number(it.commission_aed ?? 0);
    units += Number(it.qty ?? 0);
    if (it.fulfillment_status === "delivered" || it.fulfillment_status === "shipped") fulfilled++;
    if (it.fulfillment_status === "cancelled" || it.fulfillment_status === "refunded") cancelled++;
    orderIds.add(it.order.id);
    const p = productMap.get(it.product_id) ?? { id: it.product_id, name: it.product_name, revenue: 0, qty: 0 };
    p.revenue += line;
    p.qty += Number(it.qty ?? 0);
    productMap.set(it.product_id, p);
  }

  const byOrder = new Map<string, string>();
  for (const it of items) {
    if (it.order?.buyer_id) byOrder.set(it.order.id, it.order.buyer_id);
  }
  const buyerOrderCount = new Map<string, number>();
  for (const buyerId of byOrder.values()) {
    buyerOrderCount.set(buyerId, (buyerOrderCount.get(buyerId) ?? 0) + 1);
  }
  const uniqueBuyers = buyerOrderCount.size;
  const repeatBuyers = Array.from(buyerOrderCount.values()).filter((c) => c >= 2).length;

  const orderCount = orderIds.size;
  const totalLines = items.length;

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    gmv,
    commission,
    net: gmv - commission,
    units,
    orderCount,
    aov: orderCount ? gmv / orderCount : 0,
    fulfillmentRate: pct(fulfilled, totalLines),
    cancellationRate: pct(cancelled, totalLines),
    uniqueBuyers,
    repeatBuyers,
    repeatRate: pct(repeatBuyers, uniqueBuyers),
    topProducts,
  };
}

async function fetchItems(opts: { sellerId?: string; sinceIso: string }) {
  let q = supabaseAdmin
    .from("order_items")
    .select(
      `id, seller_id, qty, line_total_aed, commission_aed, fulfillment_status, product_id, product_name,
       order:orders!inner(id, buyer_id, created_at, status, payment_status)`,
    )
    .gte("order.created_at", opts.sinceIso);
  if (opts.sellerId) q = q.eq("seller_id", opts.sellerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ItemRow[];
}

async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

async function getSellerByUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("sellers").select("id, store_name").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const getPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const admin = await isAdminUser(context.userId);
    let scope: { kind: "marketplace" } | { kind: "seller"; sellerId: string; sellerName: string | null };

    if (data.sellerId) {
      if (!admin) {
        const own = await getSellerByUser(context.userId);
        if (!own || own.id !== data.sellerId) throw new Error("Forbidden");
        scope = { kind: "seller", sellerId: own.id, sellerName: own.store_name };
      } else {
        const { data: s } = await supabaseAdmin
          .from("sellers").select("id, store_name").eq("id", data.sellerId).maybeSingle();
        if (!s) throw new Error("Seller not found");
        scope = { kind: "seller", sellerId: (s as any).id, sellerName: (s as any).store_name };
      }
    } else if (admin) {
      scope = { kind: "marketplace" };
    } else {
      const own = await getSellerByUser(context.userId);
      if (!own) throw new Error("No seller account");
      scope = { kind: "seller", sellerId: own.id, sellerName: own.store_name };
    }

    const now = new Date();
    const days = data.days;
    const sinceCurrent = new Date(now.getTime() - days * DAY_MS).toISOString();
    const sincePrev = new Date(now.getTime() - 2 * days * DAY_MS).toISOString();

    const sellerScopeId = scope.kind === "seller" ? scope.sellerId : undefined;
    const allItems = await fetchItems({ sellerId: sellerScopeId, sinceIso: sincePrev });
    const current = allItems.filter((it) => it.order && it.order.created_at >= sinceCurrent);
    const previous = allItems.filter((it) => it.order && it.order.created_at < sinceCurrent);

    const curStats = aggregate(current);
    const prevStats = aggregate(previous);
    const trend = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 1 : 0) : (cur - prev) / prev);

    const series = bucketByDay(current, days, now);

    let stock: { total: number; outOfStock: number; lowStock: number } = { total: 0, outOfStock: 0, lowStock: 0 };
    if (scope.kind === "seller") {
      const { data: variants } = await supabaseAdmin
        .from("product_variants")
        .select("stock, products!inner(seller_id)")
        .eq("products.seller_id", scope.sellerId);
      const vs = (variants ?? []) as any[];
      stock.total = vs.length;
      stock.outOfStock = vs.filter((v) => Number(v.stock ?? 0) === 0).length;
      stock.lowStock = vs.filter((v) => Number(v.stock ?? 0) > 0 && Number(v.stock ?? 0) <= 5).length;
    } else {
      const [tot, oos, low] = await Promise.all([
        supabaseAdmin.from("product_variants").select("product_id", { count: "exact", head: true }),
        supabaseAdmin.from("product_variants").select("product_id", { count: "exact", head: true }).eq("stock", 0),
        supabaseAdmin.from("product_variants").select("product_id", { count: "exact", head: true }).gt("stock", 0).lte("stock", 5),
      ]);
      stock = { total: tot.count ?? 0, outOfStock: oos.count ?? 0, lowStock: low.count ?? 0 };
    }

    let ranking: Array<{ sellerId: string; storeName: string; gmv: number; orders: number; fulfillmentRate: number; cancellationRate: number }> = [];
    if (scope.kind === "marketplace") {
      const bySeller = new Map<string, { gmv: number; orders: Set<string>; fulfilled: number; cancelled: number; lines: number }>();
      for (const it of current) {
        if (!it.order) continue;
        const b = bySeller.get(it.seller_id) ?? { gmv: 0, orders: new Set(), fulfilled: 0, cancelled: 0, lines: 0 };
        b.gmv += Number(it.line_total_aed ?? 0);
        b.orders.add(it.order.id);
        b.lines += 1;
        if (it.fulfillment_status === "delivered" || it.fulfillment_status === "shipped") b.fulfilled++;
        if (it.fulfillment_status === "cancelled" || it.fulfillment_status === "refunded") b.cancelled++;
        bySeller.set(it.seller_id, b);
      }
      const ids = Array.from(bySeller.keys());
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: sellers } = await supabaseAdmin.from("sellers").select("id, store_name").in("id", ids);
        for (const s of sellers ?? []) names.set((s as any).id, (s as any).store_name);
      }
      ranking = ids.map((id) => {
        const b = bySeller.get(id)!;
        return {
          sellerId: id,
          storeName: names.get(id) ?? "—",
          gmv: b.gmv,
          orders: b.orders.size,
          fulfillmentRate: pct(b.fulfilled, b.lines),
          cancellationRate: pct(b.cancelled, b.lines),
        };
      }).sort((a, b) => b.gmv - a.gmv);
    }

    let benchmark: { fulfillmentRate: number; cancellationRate: number; repeatRate: number; aov: number } | null = null;
    if (scope.kind === "seller") {
      const mkAll = await fetchItems({ sinceIso: sinceCurrent });
      const mk = aggregate(mkAll);
      benchmark = {
        fulfillmentRate: mk.fulfillmentRate,
        cancellationRate: mk.cancellationRate,
        repeatRate: mk.repeatRate,
        aov: mk.aov,
      };
    }

    return {
      scope,
      days,
      current: curStats,
      previous: prevStats,
      trend: {
        gmv: trend(curStats.gmv, prevStats.gmv),
        orders: trend(curStats.orderCount, prevStats.orderCount),
        aov: trend(curStats.aov, prevStats.aov),
        units: trend(curStats.units, prevStats.units),
      },
      series,
      stock,
      ranking,
      benchmark,
    };
  });
