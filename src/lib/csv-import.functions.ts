import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RowSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "lowercase, numbers and dashes only"),
  name_en: z.string().min(1).max(160),
  name_es: z.string().max(160).optional().nullable(),
  name_ar: z.string().max(160).optional().nullable(),
  description_en: z.string().max(2000).optional().nullable(),
  category_slug: z.string().max(80).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  is_halal: z.boolean().default(true),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  sku: z.string().max(60).optional().nullable(),
  price_aed: z.number().min(0).max(99999),
  compare_at_price_aed: z.number().min(0).max(99999).optional().nullable(),
  stock: z.number().int().min(0).max(100000),
  image_urls: z.array(z.string().url()).max(8).default([]),
});
export type ImportRow = z.input<typeof RowSchema>;

const InputSchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).min(1).max(1000),
  sellerId: z.string().uuid().optional(),
});

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

async function resolveSeller(userId: string, sellerId?: string) {
  if (sellerId) {
    await assertAdmin(userId);
    const { data, error } = await supabaseAdmin.from("sellers").select("id").eq("id", sellerId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Seller not found");
    return data.id as string;
  }
  const { data, error } = await supabaseAdmin.from("sellers").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seller account not found");
  return data.id as string;
}

export const importProductsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof InputSchema>) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sellerId = await resolveSeller(context.userId, data.sellerId);

    // Preload category slug->id map
    const { data: cats } = await supabaseAdmin.from("categories").select("id, slug");
    const catMap = new Map<string, string>();
    for (const c of cats ?? []) catMap.set(c.slug, c.id);

    type RowError = { row: number; slug?: string; error: string };
    const errors: RowError[] = [];
    const valid: { idx: number; row: z.infer<typeof RowSchema> }[] = [];

    data.rows.forEach((raw, i) => {
      try {
        const row = RowSchema.parse(raw);
        if (row.category_slug && !catMap.has(row.category_slug)) {
          errors.push({ row: i + 2, slug: row.slug, error: `category_slug "${row.category_slug}" not found` });
          return;
        }
        valid.push({ idx: i + 2, row });
      } catch (e: any) {
        const msg = e?.issues?.map((x: any) => `${x.path.join(".")}: ${x.message}`).join("; ") ?? String(e?.message ?? e);
        errors.push({ row: i + 2, slug: (raw as any)?.slug, error: msg });
      }
    });

    // De-dupe slugs in payload
    const seen = new Set<string>();
    const dedup: typeof valid = [];
    for (const v of valid) {
      if (seen.has(v.row.slug)) {
        errors.push({ row: v.idx, slug: v.row.slug, error: "duplicate slug in file" });
      } else { seen.add(v.row.slug); dedup.push(v); }
    }

    let created = 0, updated = 0;

    for (const { row } of dedup) {
      // Lookup existing product by slug (any seller)
      const { data: existing } = await supabaseAdmin
        .from("products").select("id, seller_id").eq("slug", row.slug).maybeSingle();

      if (existing && existing.seller_id !== sellerId) {
        errors.push({ row: 0, slug: row.slug, error: "slug already used by another seller" });
        continue;
      }

      const productPayload = {
        seller_id: sellerId,
        slug: row.slug,
        brand: row.brand || null,
        origin_region: row.origin_region || null,
        spice_level: row.spice_level ?? null,
        is_halal: row.is_halal,
        status: row.status,
        category_id: row.category_slug ? catMap.get(row.category_slug)! : null,
      };

      let productId: string;
      if (existing) {
        const { error } = await supabaseAdmin.from("products").update(productPayload).eq("id", existing.id);
        if (error) { errors.push({ row: 0, slug: row.slug, error: error.message }); continue; }
        productId = existing.id;
        updated++;
      } else {
        const { data: ins, error } = await supabaseAdmin.from("products").insert(productPayload).select("id").single();
        if (error) { errors.push({ row: 0, slug: row.slug, error: error.message }); continue; }
        productId = ins.id;
        created++;
      }

      // Translations: replace
      const trRows = [
        { product_id: productId, lang: "en" as const, name: row.name_en, description: row.description_en ?? null },
        ...(row.name_es ? [{ product_id: productId, lang: "es" as const, name: row.name_es, description: null }] : []),
        ...(row.name_ar ? [{ product_id: productId, lang: "ar" as const, name: row.name_ar, description: null }] : []),
      ];
      await supabaseAdmin.from("product_translations").delete().eq("product_id", productId);
      if (trRows.length) await supabaseAdmin.from("product_translations").insert(trRows);

      // Images: replace if provided
      if (row.image_urls.length) {
        await supabaseAdmin.from("product_images").delete().eq("product_id", productId);
        await supabaseAdmin.from("product_images").insert(
          row.image_urls.map((url, i) => ({ product_id: productId, url, sort_order: i })),
        );
      }

      // Default variant: upsert single default
      const { data: vs } = await supabaseAdmin.from("product_variants").select("id").eq("product_id", productId);
      const variantPayload = {
        format_label: null as string | null,
        sku: row.sku || null,
        price_aed: row.price_aed,
        compare_at_price_aed: row.compare_at_price_aed ?? null,
        stock: row.stock,
        is_default: true,
      };
      if (vs && vs.length) {
        await supabaseAdmin.from("product_variants").update(variantPayload).eq("id", vs[0].id);
        const others = vs.slice(1).map((v: any) => v.id);
        if (others.length) await supabaseAdmin.from("product_variants").delete().in("id", others);
      } else {
        await supabaseAdmin.from("product_variants").insert({ product_id: productId, ...variantPayload });
      }
    }

    return { created, updated, errors, totalRows: data.rows.length };
  });