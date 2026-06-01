import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listActiveBanners = createServerFn({ method: "GET" })
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin
      .from("promo_banners")
      .select("id, title, subtitle, image_url, link_url, cta_label, sort_order")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("sort_order", { ascending: true })
      .limit(6);
    return data ?? [];
  });

const BannerInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  link_url: z.string().max(500).optional().nullable(),
  cta_label: z.string().max(80).optional().nullable(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

export const adminListBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("promo_banners").select("*").order("sort_order");
    return data ?? [];
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof BannerInput>) => BannerInput.parse(i))
  .handler(async ({ data }) => {
    const payload = { ...data, starts_at: data.starts_at || null, ends_at: data.ends_at || null };
    if (data.id) {
      const { error } = await supabaseAdmin.from("promo_banners").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("promo_banners").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("promo_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });