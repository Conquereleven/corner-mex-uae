import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";

type ProductWriteRpcClient = {
  rpc: (
    fn: "admin_upsert_product_v1" | "admin_upsert_product_variant_v1",
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: string | null; error: { message?: string } | null }>;
};

const productStatus = z.enum(["draft", "active", "archived"]);
const productInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  name_en: z.string().min(1).max(160),
  name_es: z.string().max(160).optional().nullable(),
  name_ar: z.string().max(160).optional().nullable(),
  description_en: z.string().max(4000).optional().nullable(),
  description_es: z.string().max(4000).optional().nullable(),
  description_ar: z.string().max(4000).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  is_bulk: z.boolean(),
  is_halal: z.boolean(),
  status: productStatus,
  category_id: z.string().uuid().optional().nullable(),
  attrs: z.record(z.string(), z.unknown()).default({}),
});

const variantInput = z.object({
  productId: z.string().uuid(),
  id: z.string().uuid().optional(),
  sku: z.string().max(120).optional().nullable(),
  format_label: z.string().max(120).optional().nullable(),
  weight_grams: z.number().int().min(0).optional().nullable(),
  price_aed: z.number().min(0).max(999999),
  compare_at_price_aed: z.number().min(0).max(999999).optional().nullable(),
  stock: z.number().int().min(0).max(1000000),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

const imageInput = z.object({
  productId: z.string().uuid(),
  url: z.string().url().max(1000),
  alt_text: z.string().max(300).optional().nullable(),
});

function rpcError(error: { message?: string } | null, fallback: string) {
  if (!error) return null;
  return /CM_[A-Z_]+/.exec(error.message ?? "")?.[0] ?? fallback;
}

export const adminListProductsCanonical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "id, slug, brand, status, origin_region, is_halal, is_bulk, category_id, updated_at, product_translations(lang,name), product_variants(id,sku,price_aed,stock,is_active,is_default)",
      )
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("CM_ADMIN_PRODUCTS_QUERY_FAILED");
    return data ?? [];
  });

export const adminGetProductCanonical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [product, translations, variants, images, categories] = await Promise.all([
      supabaseAdmin.from("products").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin
        .from("product_translations")
        .select("lang,name,description")
        .eq("product_id", data.id),
      supabaseAdmin
        .from("product_variants")
        .select(
          "id,sku,format_label,weight_grams,price_aed,compare_at_price_aed,stock,is_default,is_active",
        )
        .eq("product_id", data.id)
        .order("created_at"),
      supabaseAdmin
        .from("product_images")
        .select("id,url,alt_text,sort_order")
        .eq("product_id", data.id)
        .order("sort_order"),
      supabaseAdmin
        .from("categories")
        .select("id,slug,name_en")
        .eq("is_active", true)
        .order("name_en"),
    ]);
    if (product.error) throw new Error("CM_ADMIN_PRODUCT_QUERY_FAILED");
    if (!product.data) throw new Error("CM_ADMIN_PRODUCT_NOT_FOUND");
    return {
      product: product.data,
      translations: translations.data ?? [],
      variants: variants.data ?? [],
      images: images.data ?? [],
      categories: categories.data ?? [],
    };
  });

export const adminListProductCategoriesCanonical = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id,slug,name_en")
      .eq("is_active", true)
      .order("name_en");
    if (error) throw new Error("CM_ADMIN_PRODUCT_CATEGORIES_QUERY_FAILED");
    return data ?? [];
  });

export const adminUpsertProductCanonical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof productInput>) => productInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: productId, error } = await (
      context.supabase as unknown as ProductWriteRpcClient
    ).rpc("admin_upsert_product_v1", {
      p_product_id: data.id ?? null,
      p_slug: data.slug,
      p_name_en: data.name_en,
      p_name_es: data.name_es ?? null,
      p_name_ar: data.name_ar ?? null,
      p_description_en: data.description_en ?? null,
      p_description_es: data.description_es ?? null,
      p_description_ar: data.description_ar ?? null,
      p_brand: data.brand ?? null,
      p_origin_region: data.origin_region ?? null,
      p_spice_level: data.spice_level ?? null,
      p_is_bulk: data.is_bulk,
      p_is_halal: data.is_halal,
      p_status: data.status,
      p_category_id: data.category_id ?? null,
      p_attrs: data.attrs ?? {},
    });
    const code = rpcError(error, "CM_ADMIN_PRODUCT_WRITE_FAILED");
    if (code) throw new Error(code);
    return {
      productId: productId as string,
      created: !data.id,
      effectiveStatus: data.id ? data.status : "draft",
    };
  });

export const adminUpsertVariantCanonical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof variantInput>) => variantInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: variantId, error } = await (
      context.supabase as unknown as ProductWriteRpcClient
    ).rpc("admin_upsert_product_variant_v1", {
      p_product_id: data.productId,
      p_variant_id: data.id ?? null,
      p_sku: data.sku ?? null,
      p_format_label: data.format_label ?? null,
      p_weight_grams: data.weight_grams ?? null,
      p_price_aed: data.price_aed,
      p_compare_at_price_aed: data.compare_at_price_aed ?? null,
      p_stock: data.stock,
      p_is_default: data.is_default,
      p_is_active: data.is_active,
    });
    const code = rpcError(error, "CM_ADMIN_VARIANT_UPDATE_FAILED");
    if (code) throw new Error(code);
    return { id: variantId as string };
  });

export const adminAddProductImageCanonical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof imageInput>) => imageInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { count } = await supabaseAdmin
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.productId);
    if ((count ?? 0) >= 8) throw new Error("CM_ADMIN_PRODUCT_IMAGE_LIMIT");
    const { data: row, error } = await supabaseAdmin
      .from("product_images")
      .insert({
        product_id: data.productId,
        url: data.url,
        alt_text: data.alt_text ?? null,
        sort_order: count ?? 0,
      })
      .select("id,url,alt_text,sort_order")
      .single();
    if (error) throw new Error("CM_ADMIN_PRODUCT_IMAGE_CREATE_FAILED");
    return row;
  });

export const adminRemoveProductImageCanonical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; imageId: string }) =>
    z.object({ productId: z.string().uuid(), imageId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("product_images")
      .delete()
      .eq("id", data.imageId)
      .eq("product_id", data.productId);
    if (error) throw new Error("CM_ADMIN_PRODUCT_IMAGE_DELETE_FAILED");
    return { ok: true };
  });
