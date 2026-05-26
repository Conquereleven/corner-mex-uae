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
    const [productsCount, ordersAgg] = await Promise.all([
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("seller_id", seller.id),
      supabaseAdmin.from("order_items").select("line_total_aed, commission_aed, fulfillment_status, order_id").eq("seller_id", seller.id),
    ]);
    const items = ordersAgg.data ?? [];
    const gross = items.reduce((a, i) => a + Number(i.line_total_aed), 0);
    const commission = items.reduce((a, i) => a + Number(i.commission_aed), 0);
    const pending = items.filter((i) => i.fulfillment_status === "pending").length;
    return {
      seller,
      stats: {
        productCount: productsCount.count ?? 0,
        orderItemCount: items.length,
        orderCount: new Set(items.map((i) => i.order_id)).size,
        grossAed: +gross.toFixed(2),
        commissionAed: +commission.toFixed(2),
        netAed: +(gross - commission).toFixed(2),
        pendingItems: pending,
      },
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
  brand: z.string().max(120).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  is_bulk: z.boolean().default(false),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  category_slug: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  variant: z.object({
    format_label: z.string().max(120).optional().nullable(),
    price_aed: z.number().min(0).max(99999),
    compare_at_price_aed: z.number().min(0).max(99999).optional().nullable(),
    stock: z.number().int().min(0).max(100000),
    sku: z.string().max(60).optional().nullable(),
  }),
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
        status: data.status,
        category_id: categoryId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      productId = created.id;
    } else {
      // verify ownership
      const { data: own } = await supabaseAdmin.from("products").select("id").eq("id", productId).eq("seller_id", seller.id).maybeSingle();
      if (!own) throw new Error("Not allowed");
      const { error } = await supabaseAdmin.from("products").update({
        brand: data.brand || null,
        origin_region: data.origin_region || null,
        spice_level: data.spice_level ?? null,
        is_bulk: data.is_bulk,
        status: data.status,
        category_id: categoryId,
      }).eq("id", productId);
      if (error) throw new Error(error.message);
    }

    // Upsert translations
    const trRows = [
      { product_id: productId, lang: "en" as const, name: data.name_en, description: data.description_en ?? null },
      ...(data.name_es ? [{ product_id: productId, lang: "es" as const, name: data.name_es, description: null }] : []),
      ...(data.name_ar ? [{ product_id: productId, lang: "ar" as const, name: data.name_ar, description: null }] : []),
    ];
    await supabaseAdmin.from("product_translations").delete().eq("product_id", productId);
    if (trRows.length) await supabaseAdmin.from("product_translations").insert(trRows);

    // Image: replace
    if (data.image_url) {
      await supabaseAdmin.from("product_images").delete().eq("product_id", productId);
      await supabaseAdmin.from("product_images").insert({ product_id: productId, url: data.image_url, sort_order: 0 });
    }

    // Variant: single default variant
    const { data: existingVariants } = await supabaseAdmin.from("product_variants").select("id").eq("product_id", productId);
    if (existingVariants && existingVariants.length > 0) {
      const vId = existingVariants[0].id;
      await supabaseAdmin.from("product_variants").update({
        format_label: data.variant.format_label || null,
        price_aed: data.variant.price_aed,
        compare_at_price_aed: data.variant.compare_at_price_aed ?? null,
        stock: data.variant.stock,
        sku: data.variant.sku || null,
        is_default: true,
      }).eq("id", vId);
      // delete other variants for simplicity
      const others = existingVariants.slice(1).map((v) => v.id);
      if (others.length) await supabaseAdmin.from("product_variants").delete().in("id", others);
    } else {
      await supabaseAdmin.from("product_variants").insert({
        product_id: productId,
        format_label: data.variant.format_label || null,
        price_aed: data.variant.price_aed,
        compare_at_price_aed: data.variant.compare_at_price_aed ?? null,
        stock: data.variant.stock,
        sku: data.variant.sku || null,
        is_default: true,
      });
    }

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