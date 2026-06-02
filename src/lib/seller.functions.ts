import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getSellerForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("sellers").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seller account not found");
  return data;
}

export const getSellerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const seller = await getSellerForUser(context.userId);
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const since60 = new Date(now.getTime() - 60 * day).toISOString();
    const since30 = new Date(now.getTime() - 30 * day).toISOString();
    const since7 = new Date(now.getTime() - 7 * day).toISOString();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [items60, productsAll, lowStock, recent] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select(`id, qty, line_total_aed, commission_aed, fulfillment_status, product_id, product_name,
          order:orders!inner(id, order_number, status, payment_status, total_aed, buyer_id, created_at)`)
        .eq("seller_id", seller.id)
        .gte("order.created_at", since60),
      supabaseAdmin.from("products").select("id, status").eq("seller_id", seller.id),
      supabaseAdmin
        .from("product_variants")
        .select("product_id, stock, products!inner(seller_id)")
        .eq("products.seller_id", seller.id)
        .lte("stock", 5),
      supabaseAdmin
        .from("order_items")
        .select(`id, product_name, variant_label, qty, line_total_aed, fulfillment_status,
          order:orders!inner(order_number, created_at, payment_status)`)
        .eq("seller_id", seller.id)
        .order("id", { ascending: false })
        .limit(8),
    ]);

    const items = (items60.data ?? []) as any[];
    const allItems = await supabaseAdmin
      .from("order_items")
      .select("line_total_aed, commission_aed")
      .eq("seller_id", seller.id);
    const lifetime = (allItems.data ?? []) as any[];

    const inWin = (iso: string, from: string) => iso >= from;
    const sum = (xs: any[], k: string) => xs.reduce((a, x) => a + Number(x[k] ?? 0), 0);

    const it30 = items.filter((i) => i.order && inWin(i.order.created_at, since30));
    const itPrev30 = items.filter((i) => i.order && i.order.created_at < since30);
    const it7 = items.filter((i) => i.order && inWin(i.order.created_at, since7));
    const itToday = items.filter((i) => i.order && inWin(i.order.created_at, startToday));

    const gmv30 = +sum(it30, "line_total_aed").toFixed(2);
    const gmvPrev = +sum(itPrev30, "line_total_aed").toFixed(2);
    const gmvDelta = gmvPrev > 0 ? +(((gmv30 - gmvPrev) / gmvPrev) * 100).toFixed(1) : null;

    // Daily series 30d
    const series: { date: string; gmv: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * day);
      const key = d.toISOString().slice(0, 10);
      const dayItems = it30.filter((x) => x.order.created_at.slice(0, 10) === key);
      const orderIds = new Set(dayItems.map((x) => x.order.id));
      series.push({ date: key, gmv: +sum(dayItems, "line_total_aed").toFixed(2), orders: orderIds.size });
    }

    // Status breakdown (fulfillment, 60d)
    const statusBreakdown = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"].map((s) => ({
      status: s,
      count: items.filter((i) => i.fulfillment_status === s).length,
    }));

    // Top products
    const prodAgg = new Map<string, { name: string; units: number; gmv: number }>();
    for (const it of it30) {
      const cur = prodAgg.get(it.product_id) ?? { name: it.product_name, units: 0, gmv: 0 };
      cur.units += Number(it.qty ?? 0);
      cur.gmv += Number(it.line_total_aed ?? 0);
      prodAgg.set(it.product_id, cur);
    }
    const topProducts = Array.from(prodAgg.entries())
      .map(([id, v]) => ({ id, name: v.name, units: v.units, gmv: +v.gmv.toFixed(2) }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);

    const order30Ids = new Set(it30.map((i) => i.order.id));
    const buyerIds30 = new Set(it30.map((i) => i.order.buyer_id));
    const products = productsAll.data ?? [];

    return {
      seller,
      stats: {
        // KPIs
        gmv30,
        gmvDelta,
        gmvToday: +sum(itToday, "line_total_aed").toFixed(2),
        gmv7: +sum(it7, "line_total_aed").toFixed(2),
        orders30: order30Ids.size,
        orders7: new Set(it7.map((i) => i.order.id)).size,
        ordersToday: new Set(itToday.map((i) => i.order.id)).size,
        aov: order30Ids.size ? +(gmv30 / order30Ids.size).toFixed(2) : 0,
        units30: it30.reduce((a, i) => a + Number(i.qty ?? 0), 0),
        buyers30: buyerIds30.size,
        grossLifetime: +sum(lifetime, "line_total_aed").toFixed(2),
        commissionLifetime: +sum(lifetime, "commission_aed").toFixed(2),
        netLifetime: +(sum(lifetime, "line_total_aed") - sum(lifetime, "commission_aed")).toFixed(2),
        // counts
        productCount: products.length,
        activeProducts: products.filter((p: any) => p.status === "active").length,
        draftProducts: products.filter((p: any) => p.status === "draft").length,
        lowStockCount: (lowStock.data ?? []).length,
        pendingItems: items.filter((i) => i.fulfillment_status === "pending").length,
        confirmedItems: items.filter((i) => i.fulfillment_status === "confirmed").length,
      },
      series,
      statusBreakdown,
      topProducts,
      recentItems: (recent.data ?? []) as any[],
    };
  });

export const listSellerProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const seller = await getSellerForUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(`id, slug, brand, status, created_at,
        translations:product_translations(lang, name),
        variants:product_variants(price_aed, stock, is_default),
        images:product_images(url, sort_order)`)
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => {
      const tr = (p.translations ?? []).find((t: any) => t.lang === "en") ?? p.translations?.[0];
      const variants = p.variants ?? [];
      const def = variants.find((v: any) => v.is_default) ?? variants[0];
      const img = (p.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
      return {
        id: p.id, slug: p.slug, brand: p.brand, status: p.status, created_at: p.created_at,
        name: tr?.name ?? "(untitled)",
        price_aed: def ? Number(def.price_aed) : 0,
        stock: variants.reduce((a: number, v: any) => a + (v.stock ?? 0), 0),
        image: img?.url ?? null,
      };
    });
  });

export const listSellerOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const seller = await getSellerForUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select(`id, product_name, variant_label, qty, unit_price_aed, line_total_aed, commission_aed, fulfillment_status,
        order:orders!inner(id, order_number, status, payment_status, created_at, shipping_address)`)
      .eq("seller_id", seller.id)
      .order("id", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setOrderItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; status: string }) =>
    z.object({
      itemId: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const seller = await getSellerForUser(context.userId);
    const { error } = await supabaseAdmin.from("order_items")
      .update({ fulfillment_status: data.status as any })
      .eq("id", data.itemId).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(160),
  name_es: z.string().max(160).optional().nullable(),
  name_ar: z.string().max(160).optional().nullable(),
  description_en: z.string().max(2000).optional().nullable(),
  description_es: z.string().max(2000).optional().nullable(),
  description_ar: z.string().max(2000).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  is_bulk: z.boolean().default(false),
  is_halal: z.boolean().default(true),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  category_slug: z.string().optional().nullable(),
});

export const upsertSellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof ProductInput>) => ProductInput.parse(input))
  .handler(async ({ data, context }) => {
    const seller = await getSellerForUser(context.userId);
    let categoryId: string | null = null;
    if (data.category_slug) {
      const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", data.category_slug).maybeSingle();
      categoryId = cat?.id ?? null;
    }
    const baseSlug = data.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";

    let productId = data.id;
    if (!productId) {
      let slug = baseSlug;
      for (let i = 1; i < 30; i++) {
        const { data: hit } = await supabaseAdmin.from("products").select("id").eq("slug", slug).maybeSingle();
        if (!hit) break;
        slug = `${baseSlug}-${i}`;
      }
      const { data: created, error } = await supabaseAdmin.from("products").insert({
        seller_id: seller.id,
        slug,
        brand: data.brand || null,
        origin_region: data.origin_region || null,
        spice_level: data.spice_level ?? null,
        is_bulk: data.is_bulk,
        is_halal: data.is_halal,
        status: data.status,
        category_id: categoryId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      productId = created.id;
      // Seed a default placeholder variant so the row is usable
      await supabaseAdmin.from("product_variants").insert({
        product_id: productId,
        format_label: null,
        price_aed: 0,
        stock: 0,
        is_default: true,
      });
    } else {
      // verify ownership
      const { data: own } = await supabaseAdmin.from("products").select("id").eq("id", productId).eq("seller_id", seller.id).maybeSingle();
      if (!own) throw new Error("Not allowed");
      const { error } = await supabaseAdmin.from("products").update({
        brand: data.brand || null,
        origin_region: data.origin_region || null,
        spice_level: data.spice_level ?? null,
        is_bulk: data.is_bulk,
        is_halal: data.is_halal,
        status: data.status,
        category_id: categoryId,
      }).eq("id", productId);
      if (error) throw new Error(error.message);
    }

    // Upsert translations
    const trRows = [
      { product_id: productId, lang: "en" as const, name: data.name_en, description: data.description_en ?? null },
      ...(data.name_es ? [{ product_id: productId, lang: "es" as const, name: data.name_es, description: data.description_es ?? null }] : []),
      ...(data.name_ar ? [{ product_id: productId, lang: "ar" as const, name: data.name_ar, description: data.description_ar ?? null }] : []),
    ];
    await supabaseAdmin.from("product_translations").delete().eq("product_id", productId);
    if (trRows.length) await supabaseAdmin.from("product_translations").insert(trRows);

    return { productId };
  });

export const getSellerProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const seller = await getSellerForUser(context.userId);
    const { data: p, error } = await supabaseAdmin
      .from("products")
      .select(`id, slug, brand, origin_region, spice_level, is_bulk, status, category:categories(slug),
        translations:product_translations(lang, name, description),
        images:product_images(url, sort_order),
        variants:product_variants(id, format_label, sku, price_aed, compare_at_price_aed, stock, is_default)`)
      .eq("id", data.id).eq("seller_id", seller.id).maybeSingle();
    if (error) throw new Error(error.message);
    return p;
  });

export const deleteSellerProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const seller = await getSellerForUser(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const seller = await getSellerForUser(context.userId);
    const { data, error } = await supabaseAdmin
      .from("seller_payouts")
      .select("id, period_start, period_end, gross_aed, commission_aed, net_aed, status, paid_at, created_at")
      .eq("seller_id", seller.id)
      .order("period_end", { ascending: false });
    if (error) throw new Error(error.message);
    const list = data ?? [];
    const sum = (k: string) => +list.reduce((a, r: any) => a + Number(r[k] ?? 0), 0).toFixed(2);
    const paid = list.filter((r: any) => r.status === "paid");
    return {
      payouts: list,
      totals: {
        all: { gross: sum("gross_aed"), commission: sum("commission_aed"), net: sum("net_aed"), count: list.length },
        paid: {
          gross: +paid.reduce((a, r: any) => a + Number(r.gross_aed ?? 0), 0).toFixed(2),
          net: +paid.reduce((a, r: any) => a + Number(r.net_aed ?? 0), 0).toFixed(2),
          count: paid.length,
        },
        pending: {
          net: +list.filter((r: any) => r.status !== "paid" && r.status !== "cancelled")
            .reduce((a, r: any) => a + Number(r.net_aed ?? 0), 0).toFixed(2),
          count: list.filter((r: any) => r.status !== "paid" && r.status !== "cancelled").length,
        },
      },
    };
  });