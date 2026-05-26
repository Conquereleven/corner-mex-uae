import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const [profileRes, rolesRes, sellerRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("sellers").select("id, slug, store_name, status").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      userId,
      email: (claims as any)?.email ?? null,
      profile: profileRes.data,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      seller: sellerRes.data,
    };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(`id, order_number, status, payment_status, payment_method, total_aed, subtotal_aed, shipping_aed, tax_aed, created_at,
        items:order_items(id, product_name, variant_label, qty, unit_price_aed, line_total_aed, seller_id, fulfillment_status)`)
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const becomeSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { store_name: string; tagline?: string; bio?: string; contact_email?: string; contact_phone?: string; trn?: string }) =>
    z.object({
      store_name: z.string().min(2).max(120),
      tagline: z.string().max(160).optional(),
      bio: z.string().max(1000).optional(),
      contact_email: z.string().email().optional().or(z.literal("")),
      contact_phone: z.string().max(30).optional(),
      trn: z.string().max(30).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const existing = await supabaseAdmin.from("sellers").select("id").eq("user_id", userId).maybeSingle();
    if (existing.data) throw new Error("You already have a seller account");

    const baseSlug = data.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "seller";
    let slug = baseSlug;
    for (let i = 1; i < 20; i++) {
      const { data: hit } = await supabaseAdmin.from("sellers").select("id").eq("slug", slug).maybeSingle();
      if (!hit) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: seller, error } = await supabaseAdmin.from("sellers").insert({
      user_id: userId,
      slug,
      store_name: data.store_name,
      tagline: data.tagline || null,
      bio: data.bio || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      trn: data.trn || null,
      status: "pending",
    }).select("id, slug, status").single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "seller" }).then(() => null, () => null);
    return seller;
  });