import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";

const rowSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name_en: z.string().min(1).max(160),
  name_es: z.string().max(160).optional().nullable(),
  name_ar: z.string().max(160).optional().nullable(),
  description_en: z.string().max(4000).optional().nullable(),
  category_slug: z.string().max(80).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  is_halal: z.boolean().default(true),
  is_bulk: z.boolean().default(false),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  sku: z.string().max(120).optional().nullable(),
  format_label: z.string().max(120).optional().nullable(),
  weight_grams: z.number().int().min(0).optional().nullable(),
  price_aed: z.number().min(0).max(999999),
  compare_at_price_aed: z.number().min(0).max(999999).optional().nullable(),
  stock: z.number().int().min(0).max(1000000),
  image_urls: z.array(z.string().url()).max(8).default([]),
});

const inputSchema = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000) });

export const adminImportProductsCanonical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: categories, error: categoryError } = await supabaseAdmin
      .from("categories")
      .select("id,slug")
      .eq("is_active", true);
    if (categoryError) throw new Error("CM_ADMIN_PRODUCT_CATEGORIES_QUERY_FAILED");
    const categoryMap = new Map((categories ?? []).map((item) => [item.slug, item.id]));

    const errors: { row: number; slug?: string; error: string }[] = [];
    const valid: { rowNumber: number; value: z.infer<typeof rowSchema> }[] = [];
    const seen = new Set<string>();

    data.rows.forEach((raw, index) => {
      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ row: index + 2, slug: typeof raw.slug === "string" ? raw.slug : undefined, error: "invalid_row" });
        return;
      }
      if (seen.has(parsed.data.slug)) {
        errors.push({ row: index + 2, slug: parsed.data.slug, error: "duplicate_slug_in_file" });
        return;
      }
      if (parsed.data.category_slug && !categoryMap.has(parsed.data.category_slug)) {
        errors.push({ row: index + 2, slug: parsed.data.slug, error: "category_not_found" });
        return;
      }
      seen.add(parsed.data.slug);
      valid.push({ rowNumber: index + 2, value: parsed.data });
    });

    let created = 0;
    let updated = 0;

    for (const item of valid) {
      const row = item.value;
      const existing = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("slug", row.slug)
        .maybeSingle();
      if (existing.error) {
        errors.push({ row: item.rowNumber, slug: row.slug, error: "product_lookup_failed" });
        continue;
      }

      const productPayload = {
        slug: row.slug,
        brand: row.brand || null,
        origin_region: row.origin_region || null,
        spice_level: row.spice_level ?? null,
        is_halal: row.is_halal,
        is_bulk: row.is_bulk,
        status: row.status === "active" && row.price_aed <= 0 ? "draft" : row.status,
        category_id: row.category_slug ? categoryMap.get(row.category_slug)! : null,
      };

      let productId: string;
      if (existing.data) {
        const update = await supabaseAdmin.from("products").update(productPayload).eq("id", existing.data.id);
        if (update.error) {
          errors.push({ row: item.rowNumber, slug: row.slug, error: "product_update_failed" });
          continue;
        }
        productId = existing.data.id;
        updated += 1;
      } else {
        const insert = await supabaseAdmin.from("products").insert(productPayload).select("id").single();
        if (insert.error) {
          errors.push({ row: item.rowNumber, slug: row.slug, error: "product_create_failed" });
          continue;
        }
        productId = insert.data.id;
        created += 1;
      }

      const translations = [
        { product_id: productId, lang: "en", name: row.name_en, description: row.description_en ?? null },
        ...(row.name_es ? [{ product_id: productId, lang: "es", name: row.name_es, description: null }] : []),
        ...(row.name_ar ? [{ product_id: productId, lang: "ar", name: row.name_ar, description: null }] : []),
      ];
      await supabaseAdmin.from("product_translations").delete().eq("product_id", productId);
      const translationInsert = await supabaseAdmin.from("product_translations").insert(translations);
      if (translationInsert.error) {
        errors.push({ row: item.rowNumber, slug: row.slug, error: "translation_update_failed" });
        continue;
      }

      const currentVariants = await supabaseAdmin
        .from("product_variants")
        .select("id,is_default")
        .eq("product_id", productId)
        .order("is_default", { ascending: false })
        .limit(1);
      if (currentVariants.error) {
        errors.push({ row: item.rowNumber, slug: row.slug, error: "variant_lookup_failed" });
        continue;
      }
      const { error: variantError } = await (context.supabase as any).rpc(
        "admin_upsert_product_variant_v1",
        {
          p_product_id: productId,
          p_variant_id: currentVariants.data?.[0]?.id ?? null,
          p_sku: row.sku ?? null,
          p_format_label: row.format_label ?? null,
          p_weight_grams: row.weight_grams ?? null,
          p_price_aed: row.price_aed,
          p_compare_at_price_aed: row.compare_at_price_aed ?? null,
          p_stock: row.stock,
          p_is_default: true,
          p_is_active: true,
        },
      );
      if (variantError) {
        errors.push({ row: item.rowNumber, slug: row.slug, error: "variant_inventory_update_failed" });
        continue;
      }

      if (row.image_urls.length) {
        await supabaseAdmin.from("product_images").delete().eq("product_id", productId);
        const imageInsert = await supabaseAdmin.from("product_images").insert(
          row.image_urls.map((url, index) => ({ product_id: productId, url, sort_order: index })),
        );
        if (imageInsert.error) {
          errors.push({ row: item.rowNumber, slug: row.slug, error: "image_update_failed" });
        }
      }
    }

    return { created, updated, errors, totalRows: data.rows.length };
  });
