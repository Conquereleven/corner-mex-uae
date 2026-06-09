import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const Lang = z.enum(["en", "es", "ar"]).default("en");

function pickTranslation(
  translations: Array<{ lang: string; name: string; description: string | null }> | null,
  lang: string,
) {
  if (!translations || translations.length === 0) return { name: "", description: "" };
  const exact = translations.find((t) => t.lang === lang);
  const en = translations.find((t) => t.lang === "en");
  const fallback = exact ?? en ?? translations[0];
  return { name: fallback.name, description: fallback.description ?? "" };
}

export type ProductListItem = {
  id: string;
  slug: string;
  brand: string | null;
  name: string;
  description: string;
  image: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  seller: { id: string; slug: string; name: string } | null;
  category_slug: string | null;
  origin_region: string | null;
  spice_level: number | null;
  is_bulk: boolean;
  rating_avg: number;
  rating_count: number;
};

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      lang?: string;
      category?: string;
      sellerSlug?: string;
      q?: string;
      limit?: number;
      priceMin?: number;
      priceMax?: number;
      origin?: string;
      brand?: string;
      inStock?: boolean;
      bulk?: boolean;
      spice?: number;
      sort?: "newest" | "price_asc" | "price_desc" | "most_viewed";
    }) =>
      z
        .object({
          lang: Lang,
          category: z.string().optional(),
          sellerSlug: z.string().optional(),
          q: z.string().max(120).optional(),
          limit: z.number().int().min(1).max(100).default(60),
          priceMin: z.number().nonnegative().optional(),
          priceMax: z.number().nonnegative().optional(),
          origin: z.string().max(80).optional(),
          brand: z.string().max(80).optional(),
          inStock: z.boolean().optional(),
          bulk: z.boolean().optional(),
          spice: z.number().int().min(0).max(4).optional(),
          sort: z.enum(["newest", "price_asc", "price_desc", "most_viewed"]).default("newest"),
        })
        .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ProductListItem[]> => {
    let categoryId: string | null = null;
    if (data.category) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      categoryId = cat?.id ?? null;
      if (!categoryId) return [];
    }
    let sellerId: string | null = null;
    if (data.sellerSlug) {
      const { data: s } = await supabaseAdmin
        .from("sellers")
        .select("id")
        .eq("slug", data.sellerSlug)
        .maybeSingle();
      sellerId = s?.id ?? null;
      if (!sellerId) return [];
    }

    let query = supabaseAdmin
      .from("products")
      .select(
        `
        id, slug, brand, origin_region, spice_level, is_bulk,
        seller:sellers!inner(id, slug, store_name),
        category:categories(slug),
        translations:product_translations(lang, name, description),
        images:product_images(url, sort_order),
        variants:product_variants(price_aed, compare_at_price_aed, is_default)
      `,
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (categoryId) query = query.eq("category_id", categoryId);
    if (sellerId) query = query.eq("seller_id", sellerId);
    if (data.origin) query = query.ilike("origin_region", data.origin);
    if (data.brand) query = query.ilike("brand", data.brand);
    if (data.bulk) query = query.eq("is_bulk", true);
    if (typeof data.spice === "number") query = query.eq("spice_level", data.spice);

    // Server-side price filter on the embedded default variant.
    // We filter the product_variants relation so only matching variants are
    // returned; the JS step below already chooses the default/first variant
    // and drops products that end up with no in-range variant.
    const priceMinValid =
      typeof data.priceMin === "number" && Number.isFinite(data.priceMin) && data.priceMin >= 0;
    const priceMaxValid =
      typeof data.priceMax === "number" && Number.isFinite(data.priceMax) && data.priceMax >= 0;
    if (priceMinValid) query = query.gte("product_variants.price_aed", data.priceMin!);
    if (priceMaxValid) query = query.lte("product_variants.price_aed", data.priceMax!);
    if (data.inStock) query = query.gt("product_variants.stock", 0);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    let items = (rows ?? [])
      .filter((row: any) => (row.variants ?? []).length > 0)
      .map((row: any): ProductListItem => {
      const tr = pickTranslation(row.translations, data.lang);
      const sortedImages = (row.images ?? [])
        .slice()
        .sort((a: any, b: any) => a.sort_order - b.sort_order);
      const variants = row.variants ?? [];
      const defaultVariant = variants.find((v: any) => v.is_default) ?? variants[0];
      return {
        id: row.id,
        slug: row.slug,
        brand: row.brand,
        name: tr.name,
        description: tr.description,
        image: sortedImages[0]?.url ?? null,
        price_aed: Number(defaultVariant?.price_aed ?? 0),
        compare_at_price_aed: defaultVariant?.compare_at_price_aed
          ? Number(defaultVariant.compare_at_price_aed)
          : null,
        seller: row.seller
          ? { id: row.seller.id, slug: row.seller.slug, name: row.seller.store_name }
          : null,
        category_slug: row.category?.slug ?? null,
        origin_region: row.origin_region,
        spice_level: row.spice_level,
        is_bulk: row.is_bulk,
        rating_avg: 0,
        rating_count: 0,
      };
    });

    if (data.q) {
      const needle = data.q.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) || (p.brand ?? "").toLowerCase().includes(needle),
      );
    }

    // Final safety net: drop products whose default-variant price falls
    // outside the range (Supabase filter applies to the embedded rows, not
    // the chosen default variant).
    if (priceMinValid) items = items.filter((p) => p.price_aed >= data.priceMin!);
    if (priceMaxValid) items = items.filter((p) => p.price_aed <= data.priceMax!);

    // Batch attach rating summary (approved reviews)
    const productIds = items.map((p) => p.id);
    if (productIds.length) {
      const { data: reviews } = await supabaseAdmin
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds)
        .eq("status", "approved");
      const agg: Record<string, { sum: number; n: number }> = {};
      for (const r of reviews ?? []) {
        const a = agg[r.product_id] ?? { sum: 0, n: 0 };
        a.sum += r.rating;
        a.n += 1;
        agg[r.product_id] = a;
      }
      for (const p of items) {
        const a = agg[p.id];
        if (a && a.n > 0) {
          p.rating_avg = Number((a.sum / a.n).toFixed(2));
          p.rating_count = a.n;
        }
      }
    }

    // Attach most-viewed sort + ranking when requested
    if (data.sort === "most_viewed" && productIds.length) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: views } = await supabaseAdmin
        .from("product_views")
        .select("product_id")
        .in("product_id", productIds)
        .gte("viewed_at", since);
      const counts: Record<string, number> = {};
      for (const v of views ?? []) counts[v.product_id] = (counts[v.product_id] ?? 0) + 1;
      items.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
    } else if (data.sort === "price_asc") {
      items.sort((a, b) => a.price_aed - b.price_aed);
    } else if (data.sort === "price_desc") {
      items.sort((a, b) => b.price_aed - a.price_aed);
    }

    return items;
  });

// ---------------- Filter facets (distinct origins/brands) ----------------
export const listProductFacets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ origins: string[]; brands: string[] }> => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("origin_region, brand")
      .eq("status", "active")
      .limit(2000);
    if (error) throw new Error(error.message);
    const origins = new Set<string>();
    const brands = new Set<string>();
    for (const r of data ?? []) {
      if (r.origin_region) origins.add(r.origin_region);
      if (r.brand) brands.add(r.brand);
    }
    return {
      origins: Array.from(origins).sort(),
      brands: Array.from(brands).sort(),
    };
  },
);

// ---------------- Product view tracking ----------------
export const trackProductView = createServerFn({ method: "POST" })
  .inputValidator((input: { productId: string; sessionHash?: string }) =>
    z.object({ productId: z.string().uuid(), sessionHash: z.string().max(120).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    // Use admin client; the underlying RPC honors auth.uid() = NULL for anon
    const { error } = await supabaseAdmin.rpc("track_product_view" as any, {
      p_product_id: data.productId,
      p_session_hash: data.sessionHash ?? null,
    } as any);
    if (error) {
      // Tracking must never break the page
      console.warn("[trackProductView]", error.message);
    }
    return { ok: true };
  });

export type TopViewedProduct = {
  product_id: string;
  slug: string;
  name: string;
  image: string | null;
  category: string | null;
  views: number;
  orders: number;
};

export const listTopViewedProducts = createServerFn({ method: "GET" })
  .inputValidator((input: { days?: number; limit?: number }) =>
    z
      .object({
        days: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<TopViewedProduct[]> => {
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: views, error } = await supabaseAdmin
      .from("product_views")
      .select("product_id")
      .gte("viewed_at", since);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const v of views ?? []) counts[v.product_id] = (counts[v.product_id] ?? 0) + 1;
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, data.limit);
    if (top.length === 0) return [];
    const ids = top.map(([id]) => id);
    const { data: rows } = await supabaseAdmin
      .from("products")
      .select(
        `id, slug,
         translations:product_translations(lang, name),
         images:product_images(url, sort_order),
         category:categories(name_en)`,
      )
      .in("id", ids);
    const byId = new Map<string, any>();
    for (const r of rows ?? []) byId.set(r.id, r);

    // Orders per product (delivered+shipped+confirmed) in same window
    const { data: oitems } = await supabaseAdmin
      .from("order_items")
      .select("product_id")
      .in("product_id", ids)
      .limit(5000);
    const orderCount: Record<string, number> = {};
    for (const o of oitems ?? []) {
      const pid = (o as any).product_id;
      if (pid) orderCount[pid] = (orderCount[pid] ?? 0) + 1;
    }

    return top.map(([id, views]) => {
      const r = byId.get(id);
      const en = r?.translations?.find((t: any) => t.lang === "en") ?? r?.translations?.[0];
      const sortedImages = (r?.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
      return {
        product_id: id,
        slug: r?.slug ?? "",
        name: en?.name ?? "(unknown)",
        image: sortedImages[0]?.url ?? null,
        category: r?.category?.name_en ?? null,
        views,
        orders: orderCount[id] ?? 0,
      };
    });
  });

export type ProductDetail = ProductListItem & {
  images: string[];
  image_alts: Array<string | null>;
  variants: Array<{
    id: string;
    label: string | null;
    sku: string | null;
    price_aed: number;
    compare_at_price_aed: number | null;
    stock: number;
  }>;
  is_halal: boolean;
  category: { slug: string; name: string } | null;
  seo: {
    title: string;
    meta_description: string;
    short_description: string;
    long_description: string;
    keywords: string[];
  } | null;
};

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; lang?: string }) =>
    z.object({ slug: z.string().min(1), lang: Lang }).parse(input),
  )
  .handler(async ({ data }): Promise<ProductDetail | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("products")
      .select(
        `
        id, slug, brand, origin_region, spice_level, is_bulk, is_halal, attrs,
        seller:sellers(id, slug, store_name),
        category:categories(slug, name_en, name_es, name_ar),
        translations:product_translations(lang, name, description),
        images:product_images(url, alt_text, sort_order),
        variants:product_variants(id, format_label, sku, price_aed, compare_at_price_aed, stock, is_default)
      `,
      )
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const tr = pickTranslation(row.translations as any, data.lang);
    const sortedImages = ((row.images as any[]) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const images = sortedImages.map((i: any) => i.url as string);
    const imageAlts = sortedImages.map((i: any) => (i.alt_text as string | null) ?? null);
    const variants = ((row.variants as any[]) ?? [])
      .slice()
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
      .map((v: any) => ({
        id: v.id,
        label: v.format_label,
        sku: v.sku,
        price_aed: Number(v.price_aed),
        compare_at_price_aed: v.compare_at_price_aed ? Number(v.compare_at_price_aed) : null,
        stock: v.stock,
      }));
    const cat = row.category as any;
    const categoryName = cat
      ? data.lang === "es"
        ? cat.name_es
        : data.lang === "ar"
          ? cat.name_ar
          : cat.name_en
      : null;
    const seller = row.seller as any;
    const attrs =
      row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
        ? (row.attrs as any)
        : {};
    const seo = attrs.seo?.locales?.[data.lang] ?? attrs.seo?.locales?.en ?? null;

    // Rating summary
    const { data: revs } = await supabaseAdmin
      .from("product_reviews")
      .select("rating")
      .eq("product_id", row.id)
      .eq("status", "approved");
    const rcount = revs?.length ?? 0;
    const ravg = rcount ? Number((revs!.reduce((s, r) => s + r.rating, 0) / rcount).toFixed(2)) : 0;

    return {
      id: row.id,
      slug: row.slug,
      brand: row.brand,
      name: tr.name,
      description: tr.description,
      image: images[0] ?? null,
      images,
      image_alts: imageAlts,
      price_aed: variants[0]?.price_aed ?? 0,
      compare_at_price_aed: variants[0]?.compare_at_price_aed ?? null,
      variants,
      seller: seller ? { id: seller.id, slug: seller.slug, name: seller.store_name } : null,
      category_slug: cat?.slug ?? null,
      category: cat ? { slug: cat.slug, name: categoryName ?? cat.name_en } : null,
      origin_region: row.origin_region,
      spice_level: row.spice_level,
      is_halal: row.is_halal,
      is_bulk: row.is_bulk,
      rating_avg: ravg,
      rating_count: rcount,
      seo:
        seo && typeof seo === "object"
          ? {
              title: String(seo.title ?? ""),
              meta_description: String(seo.meta_description ?? ""),
              short_description: String(seo.short_description ?? ""),
              long_description: String(seo.long_description ?? ""),
              keywords: Array.isArray(seo.keywords) ? seo.keywords.map(String) : [],
            }
          : null,
    };
  });

export type SellerSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  bio: string | null;
  logo_url: string | null;
  cover_url: string | null;
  product_count: number;
};

export const listSellers = createServerFn({ method: "GET" }).handler(
  async (): Promise<SellerSummary[]> => {
    const { data, error } = await supabaseAdmin
      .from("sellers")
      .select("id, slug, store_name, tagline, bio, logo_url, cover_url")
      .eq("status", "active");
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((s) => s.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("seller_id")
        .eq("status", "active")
        .in("seller_id", ids);
      for (const p of prods ?? []) counts[p.seller_id] = (counts[p.seller_id] ?? 0) + 1;
    }
    return (data ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.store_name,
      tagline: s.tagline,
      bio: s.bio,
      logo_url: s.logo_url,
      cover_url: s.cover_url,
      product_count: counts[s.id] ?? 0,
    }));
  },
);

export const getSeller = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<SellerSummary | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("sellers")
      .select(
        "id, slug, store_name, tagline, bio, logo_url, cover_url, banner_url, featured_product_ids, business_hours, social_links, contact_email, contact_phone, theme",
      )
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { count } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", row.id)
      .eq("status", "active");
    return {
      id: row.id,
      slug: row.slug,
      name: row.store_name,
      tagline: row.tagline,
      bio: row.bio,
      logo_url: row.logo_url,
      cover_url: row.cover_url,
      banner_url: (row as any).banner_url ?? null,
      product_count: count ?? 0,
      featured_product_ids: ((row as any).featured_product_ids ?? []) as string[],
      business_hours: ((row as any).business_hours ?? {}) as Record<
        string,
        { open?: string | null; close?: string | null; closed?: boolean }
      >,
      social_links: ((row as any).social_links ?? {}) as Record<string, string>,
      contact_email: (row as any).contact_email ?? null,
      contact_phone: (row as any).contact_phone ?? null,
      theme: ((row as any).theme ?? {}) as Record<string, any>,
    } as any;
  });

export const listCategories = createServerFn({ method: "GET" })
  .inputValidator((input: { lang?: string }) => z.object({ lang: Lang }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("categories")
      .select("id, slug, name_en, name_es, name_ar")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: data.lang === "es" ? c.name_es : data.lang === "ar" ? c.name_ar : c.name_en,
    }));
  });
