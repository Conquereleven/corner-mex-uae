import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-authorization.server";

const BANNER_CAPABILITY_UNAVAILABLE = "CM_ADMIN_BANNERS_UNAVAILABLE";

export const listActiveBanners = createServerFn({ method: "GET" }).handler(async () => {
  // No canonical promo_banners authority exists in production. Public callers
  // get a truthful empty list instead of a database error or fabricated data.
  return [];
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
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(BANNER_CAPABILITY_UNAVAILABLE);
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof BannerInput>) => BannerInput.parse(input))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(BANNER_CAPABILITY_UNAVAILABLE);
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(BANNER_CAPABILITY_UNAVAILABLE);
  });
