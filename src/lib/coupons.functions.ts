import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CouponPreview = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  discount_aed: number;
  description: string | null;
};

/** Server-only: validate a coupon against a subtotal. Returns { ok, coupon|error }. */
export async function evaluateCoupon(code: string, subtotal: number) {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false as const, error: "Enter a code" };
  const { data: row } = await supabaseAdmin
    .from("coupons").select("*").eq("code", c).maybeSingle();
  if (!row || !row.is_active) return { ok: false as const, error: "Invalid coupon" };
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return { ok: false as const, error: "Coupon not started yet" };
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return { ok: false as const, error: "Coupon expired" };
  if (row.max_uses != null && row.uses_count >= row.max_uses) return { ok: false as const, error: "Coupon usage limit reached" };
  if (subtotal < Number(row.min_subtotal_aed ?? 0)) return { ok: false as const, error: `Minimum subtotal AED ${Number(row.min_subtotal_aed).toFixed(0)}` };
  let discount = row.kind === "percent" ? subtotal * (Number(row.value) / 100) : Number(row.value);
  if (row.max_discount_aed != null) discount = Math.min(discount, Number(row.max_discount_aed));
  discount = Math.min(discount, subtotal);
  discount = +discount.toFixed(2);
  return { ok: true as const, coupon: { id: row.id, code: row.code, kind: row.kind, value: Number(row.value), discount_aed: discount, description: row.description ?? null } };
}

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((i: { code: string; subtotal: number }) =>
    z.object({ code: z.string().min(1).max(64), subtotal: z.number().nonnegative() }).parse(i))
  .handler(async ({ data }) => evaluateCoupon(data.code, data.subtotal));

const CouponInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(64).regex(/^[A-Z0-9_-]+$/, "Use uppercase letters, digits, _ or -"),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  min_subtotal_aed: z.number().nonnegative().default(0),
  max_discount_aed: z.number().positive().optional().nullable(),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  max_uses: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().default(true),
  description: z.string().max(280).optional().nullable(),
  seller_id: z.string().uuid().optional().nullable(),
});

export const upsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof CouponInput>) => CouponInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    let scopedSellerId = data.seller_id ?? null;
    if (!isAdmin) {
      const { data: s } = await supabaseAdmin.from("sellers").select("id").eq("user_id", userId).maybeSingle();
      if (!s) throw new Error("Not allowed");
      scopedSellerId = s.id;
    }
    const payload = {
      code: data.code.toUpperCase(),
      kind: data.kind,
      value: data.value,
      min_subtotal_aed: data.min_subtotal_aed,
      max_discount_aed: data.max_discount_aed ?? null,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      max_uses: data.max_uses ?? null,
      is_active: data.is_active,
      description: data.description ?? null,
      seller_id: scopedSellerId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("coupons").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("coupons").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { scope?: "all" | "mine" }) => z.object({ scope: z.enum(["all", "mine"]).default("all") }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.scope === "mine") {
      const { data: s } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
      if (!s) return [];
      q = q.eq("seller_id", s.id);
    }
    const { data: rows } = await q;
    return rows ?? [];
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    let q = supabaseAdmin.from("coupons").delete().eq("id", data.id);
    if (!isAdmin) {
      const { data: s } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
      if (!s) throw new Error("Not allowed");
      q = q.eq("seller_id", s.id);
    }
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });