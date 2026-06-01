import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Emirate = z.enum(["AD", "DU", "SH", "AJ", "UQ", "RK", "FU"]);

export const listShippingZones = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("shipping_zones")
    .select("id, name, slug, emirates, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

const QuoteInput = z.object({
  emirate: Emirate,
  items: z.array(z.object({
    variantId: z.string().uuid(),
    qty: z.number().int().min(1).max(500),
  })).min(1).max(50),
});

export type ShippingQuoteResult = {
  zoneId: string | null;
  zoneName: string | null;
  perSeller: Array<{
    sellerId: string;
    sellerName: string;
    subtotal: number;
    weightGrams: number;
    cost: number;
    slaMin: number | null;
    slaMax: number | null;
    freeShippingApplied: boolean;
  }>;
  total: number;
  slaMin: number | null;
  slaMax: number | null;
  error: string | null;
};

export const getShippingQuote = createServerFn({ method: "POST" })
  .inputValidator((i: z.input<typeof QuoteInput>) => QuoteInput.parse(i))
  .handler(async ({ data }): Promise<ShippingQuoteResult> => {
    const { data: zones } = await supabaseAdmin
      .from("shipping_zones")
      .select("id, name, emirates")
      .eq("is_active", true);
    const zone = (zones ?? []).find((z: any) => (z.emirates ?? []).includes(data.emirate));
    if (!zone) {
      return { zoneId: null, zoneName: null, perSeller: [], total: 0, slaMin: null, slaMax: null, error: "No shipping zone covers this emirate" };
    }

    const { data: vars } = await supabaseAdmin
      .from("product_variants")
      .select(`id, price_aed, weight_grams,
        product:products!inner(seller_id,
          seller:sellers!inner(id, store_name))`)
      .in("id", data.items.map((i) => i.variantId));

    const { data: rates } = await supabaseAdmin
      .from("shipping_rates")
      .select("*")
      .eq("zone_id", zone.id)
      .eq("is_active", true);

    const defaultRate: any = (rates ?? []).find((r: any) => r.seller_id === null);
    const sellerRate = (sid: string): any =>
      (rates ?? []).find((r: any) => r.seller_id === sid) ?? defaultRate;

    const groups = new Map<string, { sellerId: string; sellerName: string; subtotal: number; weight: number }>();
    for (const it of data.items) {
      const v: any = (vars ?? []).find((x: any) => x.id === it.variantId);
      if (!v) continue;
      const sid: string = v.product.seller_id;
      const g = groups.get(sid) ?? { sellerId: sid, sellerName: v.product.seller.store_name, subtotal: 0, weight: 0 };
      g.subtotal += Number(v.price_aed) * it.qty;
      g.weight += Number(v.weight_grams ?? 0) * it.qty;
      groups.set(sid, g);
    }

    let total = 0;
    let slaMin = 0;
    let slaMax = 0;
    const perSeller = Array.from(groups.values()).map((g) => {
      const r = sellerRate(g.sellerId);
      let cost = 25;
      let freeApplied = false;
      let sMin: number | null = null;
      let sMax: number | null = null;
      if (r) {
        const kg = Math.max(0, g.weight / 1000);
        cost = Number(r.base_aed) + Number(r.per_kg_aed) * kg;
        if (r.free_above_aed != null && g.subtotal >= Number(r.free_above_aed)) {
          cost = 0;
          freeApplied = true;
        }
        sMin = r.sla_min_days;
        sMax = r.sla_max_days;
        slaMin = Math.max(slaMin, r.sla_min_days);
        slaMax = Math.max(slaMax, r.sla_max_days);
      }
      cost = +cost.toFixed(2);
      total += cost;
      return {
        sellerId: g.sellerId,
        sellerName: g.sellerName,
        subtotal: +g.subtotal.toFixed(2),
        weightGrams: g.weight,
        cost,
        slaMin: sMin,
        slaMax: sMax,
        freeShippingApplied: freeApplied,
      };
    });

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      perSeller,
      total: +total.toFixed(2),
      slaMin: slaMin || null,
      slaMax: slaMax || null,
      error: null,
    };
  });

// ----- Admin: zones -----
export const adminListZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("shipping_zones")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ZoneInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  emirates: z.array(Emirate).min(1),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export const adminUpsertZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof ZoneInput>) => ZoneInput.parse(i))
  .handler(async ({ data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("shipping_zones").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("shipping_zones").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const adminDeleteZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("shipping_zones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Admin: rates -----
export const adminListRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("shipping_rates")
      .select(`*, seller:sellers(id, store_name), zone:shipping_zones(id, name)`)
      .order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const RateInput = z.object({
  id: z.string().uuid().optional(),
  seller_id: z.string().uuid().nullable(),
  zone_id: z.string().uuid(),
  base_aed: z.number().min(0).max(100000),
  per_kg_aed: z.number().min(0).max(100000),
  free_above_aed: z.number().min(0).max(1000000).nullable(),
  sla_min_days: z.number().int().min(0).max(60),
  sla_max_days: z.number().int().min(0).max(60),
  is_active: z.boolean(),
});

export const adminUpsertRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof RateInput>) => RateInput.parse(i))
  .handler(async ({ data }) => {
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("shipping_rates").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("shipping_rates").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const adminDeleteRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("shipping_rates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Seller: my rates -----
export const sellerListMyRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: seller } = await supabaseAdmin
      .from("sellers").select("id").eq("user_id", userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const [{ data: zones }, { data: rates }] = await Promise.all([
      supabaseAdmin.from("shipping_zones").select("*").eq("is_active", true).order("sort_order"),
      supabaseAdmin.from("shipping_rates").select("*").or(`seller_id.eq.${seller.id},seller_id.is.null`),
    ]);
    return { sellerId: seller.id, zones: zones ?? [], rates: rates ?? [] };
  });

const SellerRateInput = z.object({
  zone_id: z.string().uuid(),
  base_aed: z.number().min(0).max(100000),
  per_kg_aed: z.number().min(0).max(100000),
  free_above_aed: z.number().min(0).max(1000000).nullable(),
  sla_min_days: z.number().int().min(0).max(60),
  sla_max_days: z.number().int().min(0).max(60),
  is_active: z.boolean(),
});

export const sellerUpsertMyRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof SellerRateInput>) => SellerRateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: seller } = await supabaseAdmin
      .from("sellers").select("id").eq("user_id", userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { data: existing } = await supabaseAdmin
      .from("shipping_rates").select("id")
      .eq("seller_id", seller.id).eq("zone_id", data.zone_id).maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("shipping_rates").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("shipping_rates").insert({ ...data, seller_id: seller.id }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const sellerDeleteMyOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: seller } = await supabaseAdmin
      .from("sellers").select("id").eq("user_id", userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const { error } = await supabaseAdmin
      .from("shipping_rates").delete().eq("id", data.id).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });