import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listMyWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await supabaseAdmin
      .from("wishlists")
      .select("id, product_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r) => r.product_id);
    if (!ids.length) return [];
    const { data: prods } = await supabaseAdmin
      .from("products")
      .select(`
        id, slug, brand, origin_region, spice_level, is_bulk,
        seller:sellers(id, slug, store_name),
        translations:product_translations(lang, name),
        images:product_images(url, sort_order),
        variants:product_variants(price_aed, compare_at_price_aed, is_default)
      `)
      .in("id", ids)
      .eq("status", "active");
    return (rows ?? []).map((w) => {
      const p: any = (prods ?? []).find((x: any) => x.id === w.product_id);
      if (!p) return null;
      const tr = (p.translations ?? []).find((t: any) => t.lang === "en") ?? p.translations?.[0];
      const sortedImgs = (p.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
      const def = (p.variants ?? []).find((v: any) => v.is_default) ?? p.variants?.[0];
      return {
        wishlist_id: w.id,
        id: p.id,
        slug: p.slug,
        brand: p.brand,
        name: tr?.name ?? "Product",
        description: "",
        image: sortedImgs[0]?.url ?? null,
        price_aed: Number(def?.price_aed ?? 0),
        compare_at_price_aed: def?.compare_at_price_aed ? Number(def.compare_at_price_aed) : null,
        seller: p.seller ? { id: p.seller.id, slug: p.seller.slug, name: p.seller.store_name } : null,
        category_slug: null,
        origin_region: p.origin_region,
        spice_level: p.spice_level,
        is_bulk: p.is_bulk,
      };
    }).filter(Boolean);
  });

export const wishlistIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("wishlists").select("product_id").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.product_id);
  });

export const toggleWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { productId: string }) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("wishlists").select("id")
      .eq("user_id", context.userId).eq("product_id", data.productId).maybeSingle();
    if (existing) {
      await supabaseAdmin.from("wishlists").delete().eq("id", existing.id);
      return { added: false };
    }
    await supabaseAdmin.from("wishlists").insert({ user_id: context.userId, product_id: data.productId });
    return { added: true };
  });
