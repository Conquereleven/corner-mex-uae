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
  attrs: z.record(z.string(), z.any()).optional().nullable(),
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
        attrs: data.attrs ?? {},
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
        attrs: data.attrs ?? {},
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
      .select(`id, slug, brand, origin_region, spice_level, is_bulk, is_halal, status, attrs, category:categories(slug),
        translations:product_translations(lang, name, description),
        images:product_images(id, url, sort_order),
        variants:product_variants(id, format_label, sku, price_aed, compare_at_price_aed, stock, weight_grams, is_default)`)
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
      .select("id, period_start, period_end, gross_aed, commission_aed, net_aed, status, paid_at, requested_at, created_at")
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

// ===== Request payout =====
async function computeAvailableBalance(sellerId: string) {
  const [{ data: items }, { data: payouts }] = await Promise.all([
    supabaseAdmin.from("order_items").select("line_total_aed, commission_aed").eq("seller_id", sellerId),
    supabaseAdmin.from("seller_payouts").select("net_aed, status, requested_at, created_at").eq("seller_id", sellerId),
  ]);
  const gross = (items ?? []).reduce((a, x: any) => a + Number(x.line_total_aed ?? 0), 0);
  const commission = (items ?? []).reduce((a, x: any) => a + Number(x.commission_aed ?? 0), 0);
  const netLifetime = gross - commission;
  const reserved = (payouts ?? [])
    .filter((p: any) => p.status !== "cancelled")
    .reduce((a, p: any) => a + Number(p.net_aed ?? 0), 0);
  const open = (payouts ?? []).find((p: any) => p.status === "pending" || p.status === "processing");
  const lastRequest = (payouts ?? [])
    .map((p: any) => p.requested_at ?? p.created_at)
    .filter(Boolean)
    .sort()
    .pop() ?? null;
  return {
    availableBalance: Math.max(0, +(netLifetime - reserved).toFixed(2)),
    hasOpenRequest: !!open,
    lastPayoutRequestAt: lastRequest,
    grossLifetime: +gross.toFixed(2),
    commissionLifetime: +commission.toFixed(2),
  };
}

export const requestSellerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount?: number }) =>
    z.object({ amount: z.number().positive().max(10_000_000).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const seller = await getSellerForUser(context.userId);
    if ((seller as any).kyc_status !== "verified") {
      throw new Error("Your account must be KYC-verified before requesting payouts. Submit your trade license in Settings → Verification.");
    }
    const balance = await computeAvailableBalance(seller.id);
    if (balance.hasOpenRequest) throw new Error("You already have a pending payout request.");
    if (balance.availableBalance <= 0) throw new Error("No funds available for payout.");
    const amount = data.amount ? Math.min(data.amount, balance.availableBalance) : balance.availableBalance;
    if (amount <= 0) throw new Error("Invalid amount.");

    const rate = Number(seller.commission_rate ?? 0) / 100;
    const gross = rate > 0 && rate < 1 ? +(amount / (1 - rate)).toFixed(2) : amount;
    const commission = +(gross - amount).toFixed(2);

    const today = new Date();
    const { data: lastPaid } = await supabaseAdmin
      .from("seller_payouts")
      .select("period_end")
      .eq("seller_id", seller.id).eq("status", "paid")
      .order("period_end", { ascending: false }).limit(1).maybeSingle();
    const periodStart = lastPaid?.period_end
      ? new Date(new Date(lastPaid.period_end).getTime() + 86400000).toISOString().slice(0, 10)
      : new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
    const periodEnd = today.toISOString().slice(0, 10);

    const { data: created, error } = await supabaseAdmin.from("seller_payouts").insert({
      seller_id: seller.id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_aed: gross,
      commission_aed: commission,
      net_aed: amount,
      status: "pending",
      requested_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw new Error(error.message);

    // Notify admins
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a: any) => ({
          user_id: a.user_id,
          kind: "payout_requested",
          title: "Payout requested",
          body: `${seller.store_name} requested ${amount.toFixed(2)} AED`,
          link: `/admin/payouts`,
        })),
      );
    }
    return { ok: true, payoutId: created.id, amount };
  });
// ===== Product images (private bucket -> long signed URLs) =====
const BUCKET = "product-images";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

async function assertOwnsProduct(productId: string, userId: string) {
  const seller = await getSellerForUser(userId);
  const { data: own } = await supabaseAdmin
    .from("products").select("id").eq("id", productId).eq("seller_id", seller.id).maybeSingle();
  if (!own) throw new Error("Not allowed");
  return seller;
}

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; filename: string; contentType: string; dataBase64: string }) =>
    z.object({
      productId: z.string().uuid(),
      filename: z.string().min(1).max(200),
      contentType: z.string().min(3).max(120),
      dataBase64: z.string().min(10).max(8_000_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwnsProduct(data.productId, context.userId);
    const ext = (data.filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${data.productId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(data.dataBase64, "base64");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: data.contentType, upsert: false,
    });
    if (up.error) throw new Error(up.error.message);
    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Sign failed");
    const { data: existing } = await supabaseAdmin
      .from("product_images").select("id").eq("product_id", data.productId);
    const nextOrder = (existing ?? []).length;
    const { data: row, error } = await supabaseAdmin.from("product_images").insert({
      product_id: data.productId, url: signed.data.signedUrl, sort_order: nextOrder, alt_text: data.filename,
    }).select("id, url, sort_order").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageId: string }) => z.object({ imageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: img } = await supabaseAdmin
      .from("product_images").select("id, url, product_id").eq("id", data.imageId).maybeSingle();
    if (!img) throw new Error("Not found");
    await assertOwnsProduct(img.product_id, context.userId);
    // Best-effort delete from storage (parse path from URL)
    try {
      const match = img.url.match(/product-images\/([^?]+)/);
      if (match?.[1]) await supabaseAdmin.storage.from(BUCKET).remove([decodeURIComponent(match[1])]);
    } catch {}
    const { error } = await supabaseAdmin.from("product_images").delete().eq("id", data.imageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; orderedIds: string[] }) =>
    z.object({ productId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).max(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwnsProduct(data.productId, context.userId);
    for (let i = 0; i < data.orderedIds.length; i++) {
      await supabaseAdmin.from("product_images")
        .update({ sort_order: i }).eq("id", data.orderedIds[i]).eq("product_id", data.productId);
    }
    return { ok: true };
  });

// ===== Variants =====
const VariantInput = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  format_label: z.string().max(120).optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  price_aed: z.number().min(0).max(99999),
  compare_at_price_aed: z.number().min(0).max(99999).optional().nullable(),
  stock: z.number().int().min(0).max(100000),
  weight_grams: z.number().int().min(0).max(1_000_000).optional().nullable(),
  is_default: z.boolean().default(false),
});

export const upsertVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof VariantInput>) => VariantInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnsProduct(data.productId, context.userId);
    const row = {
      product_id: data.productId,
      format_label: data.format_label || null,
      sku: data.sku || null,
      price_aed: data.price_aed,
      compare_at_price_aed: data.compare_at_price_aed ?? null,
      stock: data.stock,
      weight_grams: data.weight_grams ?? null,
      is_default: !!data.is_default,
    };
    if (data.is_default) {
      await supabaseAdmin.from("product_variants").update({ is_default: false }).eq("product_id", data.productId);
    }
    if (data.id) {
      const { error } = await supabaseAdmin.from("product_variants").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: created, error } = await supabaseAdmin.from("product_variants").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      return { id: created.id };
    }
  });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { variantId: string }) => z.object({ variantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: v } = await supabaseAdmin
      .from("product_variants").select("id, product_id, is_default").eq("id", data.variantId).maybeSingle();
    if (!v) throw new Error("Not found");
    await assertOwnsProduct(v.product_id, context.userId);
    const { data: siblings } = await supabaseAdmin
      .from("product_variants").select("id").eq("product_id", v.product_id);
    if ((siblings ?? []).length <= 1) throw new Error("A product needs at least one variant");
    const { error } = await supabaseAdmin.from("product_variants").delete().eq("id", data.variantId);
    if (error) throw new Error(error.message);
    if (v.is_default) {
      const next = (siblings ?? []).find((s) => s.id !== data.variantId);
      if (next) await supabaseAdmin.from("product_variants").update({ is_default: true }).eq("id", next.id);
    }
    return { ok: true };
  });

// ===== Commissions =====
export const getSellerCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const seller = await getSellerForUser(context.userId);
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select(`id, qty, line_total_aed, commission_aed, product_id, product_name,
        order:orders!inner(id, created_at, payment_status)`)
      .eq("seller_id", seller.id);
    const list = (items ?? []) as any[];
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const last30 = list.filter((i) => i.order?.created_at >= since30);
    const sum = (xs: any[], k: string) => +xs.reduce((a, x) => a + Number(x[k] ?? 0), 0).toFixed(2);

    // Monthly buckets (last 12 months)
    const months: { key: string; label: string; gmv: number; commission: number; net: number; orders: number; rate: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inMonth = list.filter((x) => (x.order?.created_at ?? "").slice(0, 7) === key);
      const gmv = sum(inMonth, "line_total_aed");
      const commission = sum(inMonth, "commission_aed");
      months.push({
        key, label: d.toLocaleString("en", { month: "short", year: "numeric" }),
        gmv, commission, net: +(gmv - commission).toFixed(2),
        orders: new Set(inMonth.map((x) => x.order.id)).size,
        rate: gmv > 0 ? +((commission / gmv) * 100).toFixed(2) : 0,
      });
    }

    // Top products by commission
    const agg = new Map<string, { name: string; units: number; gmv: number; commission: number }>();
    for (const it of list) {
      const cur = agg.get(it.product_id) ?? { name: it.product_name, units: 0, gmv: 0, commission: 0 };
      cur.units += Number(it.qty ?? 0);
      cur.gmv += Number(it.line_total_aed ?? 0);
      cur.commission += Number(it.commission_aed ?? 0);
      agg.set(it.product_id, cur);
    }
    const topProducts = Array.from(agg.entries())
      .map(([id, v]) => ({ id, name: v.name, units: v.units, gmv: +v.gmv.toFixed(2), commission: +v.commission.toFixed(2) }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 5);

    const gmvAll = sum(list, "line_total_aed");
    const commissionAll = sum(list, "commission_aed");

    return {
      rate: Number(seller.commission_rate ?? 0),
      stats: {
        gmv30: sum(last30, "line_total_aed"),
        commission30: sum(last30, "commission_aed"),
        net30: +(sum(last30, "line_total_aed") - sum(last30, "commission_aed")).toFixed(2),
        gmvLifetime: gmvAll,
        commissionLifetime: commissionAll,
        netLifetime: +(gmvAll - commissionAll).toFixed(2),
        effectiveRate: gmvAll > 0 ? +((commissionAll / gmvAll) * 100).toFixed(2) : 0,
      },
      months,
      topProducts,
      balance: await computeAvailableBalance(seller.id),
    };
  });

// ===== Storefront =====
export const getSellerStorefront = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await getSellerForUser(context.userId);
    const { data: prods } = await supabaseAdmin
      .from("products")
      .select(`id, status, category_id, translations:product_translations(lang, name), images:product_images(url, sort_order), category:categories(slug, name_en)`)
      .eq("seller_id", s.id);
    const products = (prods ?? []).map((p: any) => {
      const tr = (p.translations ?? []).find((t: any) => t.lang === "en") ?? p.translations?.[0];
      const img = (p.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
      return {
        id: p.id, name: tr?.name ?? "(untitled)", image: img?.url ?? null, status: p.status,
        category_id: p.category_id, category_name: p.category?.name_en ?? null, category_slug: p.category?.slug ?? null,
      };
    });
    return {
      id: s.id, slug: s.slug, store_name: s.store_name, tagline: s.tagline, bio: s.bio,
      logo_url: s.logo_url, cover_url: s.cover_url, contact_email: s.contact_email,
      contact_phone: s.contact_phone, social_links: s.social_links ?? {}, is_published: s.is_published,
      featured_product_ids: (s as any).featured_product_ids ?? [],
      business_hours: (s as any).business_hours ?? {},
      theme: (s as any).theme ?? {},
      products,
    };
  });

const StorefrontInput = z.object({
  store_name: z.string().min(1).max(120),
  tagline: z.string().max(160).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().max(40).optional().nullable(),
  social_links: z.record(z.string().max(40), z.string().max(300)).optional().nullable(),
  is_published: z.boolean().default(true),
  featured_product_ids: z.array(z.string().uuid()).max(8).optional().nullable(),
  business_hours: z.record(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    z.object({
      open: z.string().max(5).optional().nullable(),
      close: z.string().max(5).optional().nullable(),
      closed: z.boolean().optional(),
    }),
  ).optional().nullable(),
  theme: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    font: z.enum(["Inter", "Playfair Display", "Space Grotesk", "System"]).optional().nullable(),
    radius: z.enum(["none", "sm", "md", "lg", "xl"]).optional().nullable(),
    layout: z.enum(["grid", "masonry", "list"]).optional().nullable(),
  }).partial().optional().nullable(),
});

export const updateSellerStorefront = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof StorefrontInput>) => StorefrontInput.parse(input))
  .handler(async ({ data, context }) => {
    const s = await getSellerForUser(context.userId);
    // validate featured product ownership
    let featured: string[] = [];
    if (data.featured_product_ids?.length) {
      const { data: owned } = await supabaseAdmin.from("products")
        .select("id").eq("seller_id", s.id).in("id", data.featured_product_ids);
      const ownedSet = new Set((owned ?? []).map((p: any) => p.id));
      featured = data.featured_product_ids.filter((id) => ownedSet.has(id));
    }
    const { error } = await supabaseAdmin.from("sellers").update({
      store_name: data.store_name,
      tagline: data.tagline ?? null,
      bio: data.bio ?? null,
      logo_url: data.logo_url ?? null,
      cover_url: data.cover_url ?? null,
      contact_email: data.contact_email ?? null,
      contact_phone: data.contact_phone ?? null,
      social_links: data.social_links ?? {},
      is_published: data.is_published,
      featured_product_ids: featured,
      business_hours: data.business_hours ?? {},
      theme: data.theme ?? {},
    }).eq("id", s.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadSellerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "logo" | "cover"; filename: string; contentType: string; dataBase64: string }) =>
    z.object({
      kind: z.enum(["logo", "cover"]),
      filename: z.string().min(1).max(200),
      contentType: z.string().min(3).max(120),
      dataBase64: z.string().min(10).max(8_000_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const s = await getSellerForUser(context.userId);
    const ext = (data.filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `sellers/${s.id}/${data.kind}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(data.dataBase64, "base64");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: data.contentType, upsert: false,
    });
    if (up.error) throw new Error(up.error.message);
    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Sign failed");
    return { url: signed.data.signedUrl };
  });

// ===== Settings =====
export const getSellerSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await getSellerForUser(context.userId);
    return {
      legal_name: s.legal_name, trn: s.trn, vat_number: s.vat_number,
      support_email: s.support_email, support_phone: s.support_phone, contact_address: s.contact_address,
      processing_days: s.processing_days, auto_accept_orders: s.auto_accept_orders,
      vacation_mode: s.vacation_mode, vacation_message: s.vacation_message,
      payout_method: s.payout_method, bank_name: s.bank_name, bank_iban: s.bank_iban,
      bank_swift: s.bank_swift, bank_account_holder: s.bank_account_holder,
      notify_new_order: s.notify_new_order, notify_low_stock: s.notify_low_stock, notify_payout: s.notify_payout,
      address_line1: (s as any).address_line1, address_line2: (s as any).address_line2,
      city: (s as any).city, country: (s as any).country, postal_code: (s as any).postal_code,
      currency: (s as any).currency ?? "AED",
      tax_inclusive_pricing: (s as any).tax_inclusive_pricing ?? false,
      tax_rate: (s as any).tax_rate ?? 0,
      accepted_payment_methods: (s as any).accepted_payment_methods ?? ["card"],
      notify_review: (s as any).notify_review ?? true,
      notify_return: (s as any).notify_return ?? true,
      payout_schedule: (s as any).payout_schedule ?? "manual",
      min_payout_aed: Number((s as any).min_payout_aed ?? 0),
    };
  });

const SettingsInput = z.object({
  legal_name: z.string().max(160).optional().nullable(),
  trn: z.string().max(40).optional().nullable(),
  vat_number: z.string().max(40).optional().nullable(),
  support_email: z.string().email().optional().nullable().or(z.literal("")),
  support_phone: z.string().max(40).optional().nullable(),
  contact_address: z.string().max(500).optional().nullable(),
  processing_days: z.number().int().min(1).max(14),
  auto_accept_orders: z.boolean(),
  vacation_mode: z.boolean(),
  vacation_message: z.string().max(280).optional().nullable(),
  payout_method: z.enum(["bank", "wallet"]),
  bank_name: z.string().max(120).optional().nullable(),
  bank_iban: z.string().max(60).optional().nullable(),
  bank_swift: z.string().max(20).optional().nullable(),
  bank_account_holder: z.string().max(160).optional().nullable(),
  notify_new_order: z.boolean(),
  notify_low_stock: z.boolean(),
  notify_payout: z.boolean(),
  address_line1: z.string().max(160).optional().nullable(),
  address_line2: z.string().max(160).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  currency: z.enum(["AED", "USD", "EUR", "MXN", "SAR"]).default("AED"),
  tax_inclusive_pricing: z.boolean().default(false),
  tax_rate: z.number().min(0).max(100).default(0),
  accepted_payment_methods: z.array(z.enum(["card", "apple_pay", "google_pay", "cod", "bank_transfer"])).default(["card"]),
  notify_review: z.boolean().default(true),
  notify_return: z.boolean().default(true),
  payout_schedule: z.enum(["manual", "weekly", "biweekly", "monthly"]).default("manual"),
  min_payout_aed: z.number().min(0).max(1_000_000).default(0),
});

export const updateSellerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof SettingsInput>) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const s = await getSellerForUser(context.userId);
    const payload = {
      ...data,
      support_email: data.support_email || null,
    };
    const { error } = await supabaseAdmin.from("sellers").update(payload).eq("id", s.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
