import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    return { admin: !!data };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const since30 = new Date(now.getTime() - 30 * day).toISOString();
    const since60 = new Date(now.getTime() - 60 * day).toISOString();
    const since7 = new Date(now.getTime() - 7 * day).toISOString();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [orders, sellers, products, pendingSellers, items, buyers, recent, lowStock] = await Promise.all([
      supabaseAdmin.from("orders").select("id, total_aed, status, payment_status, payment_method, created_at, buyer_id").gte("created_at", since60),
      supabaseAdmin.from("sellers").select("id, status, store_name, created_at"),
      supabaseAdmin.from("products").select("id, status"),
      supabaseAdmin.from("sellers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("order_items").select("seller_id, product_id, product_name, qty, line_total_aed, commission_aed").limit(5000),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id, order_number, total_aed, status, payment_status, created_at").order("created_at", { ascending: false }).limit(8),
      supabaseAdmin.from("product_variants").select("product_id, stock").lte("stock", 5),
    ]);

    const allOrders = orders.data ?? [];
    const sum = (xs: any[], k: string) => xs.reduce((a, o) => a + Number(o[k] ?? 0), 0);
    const inWindow = (iso: string, fromIso: string) => iso >= fromIso;

    const o30 = allOrders.filter((o) => inWindow(o.created_at, since30));
    const o60to30 = allOrders.filter((o) => o.created_at < since30);
    const o7 = allOrders.filter((o) => inWindow(o.created_at, since7));
    const oToday = allOrders.filter((o) => inWindow(o.created_at, startToday));

    const gmv30 = +sum(o30, "total_aed").toFixed(2);
    const gmvPrev30 = +sum(o60to30, "total_aed").toFixed(2);
    const gmvDelta = gmvPrev30 > 0 ? +(((gmv30 - gmvPrev30) / gmvPrev30) * 100).toFixed(1) : null;

    // Build daily series (last 30 days)
    const series: { date: string; gmv: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * day);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = o30.filter((o) => o.created_at.slice(0, 10) === key);
      series.push({ date: key, gmv: +sum(dayOrders, "total_aed").toFixed(2), orders: dayOrders.length });
    }

    // Status / payment breakdowns
    const statusBreakdown = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"].map((s) => ({
      status: s,
      count: allOrders.filter((o) => o.status === s).length,
    }));
    const paymentBreakdown = ["paid", "pending", "failed", "refunded"].map((s) => ({
      status: s,
      count: allOrders.filter((o) => o.payment_status === s).length,
    }));
    const methodBreakdown = Object.entries(
      allOrders.reduce((acc: Record<string, number>, o: any) => {
        const k = o.payment_method ?? "unknown";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([method, count]) => ({ method, count: count as number }));

    // Top sellers by GMV (from order_items)
    const sellerMap = new Map((sellers.data ?? []).map((s: any) => [s.id, s.store_name]));
    const sellerAgg = new Map<string, { gmv: number; units: number; commission: number }>();
    const productAgg = new Map<string, { name: string; units: number; gmv: number }>();
    for (const it of (items.data ?? []) as any[]) {
      const cur = sellerAgg.get(it.seller_id) ?? { gmv: 0, units: 0, commission: 0 };
      cur.gmv += Number(it.line_total_aed ?? 0);
      cur.units += Number(it.qty ?? 0);
      cur.commission += Number(it.commission_aed ?? 0);
      sellerAgg.set(it.seller_id, cur);
      const p = productAgg.get(it.product_id) ?? { name: it.product_name, units: 0, gmv: 0 };
      p.units += Number(it.qty ?? 0);
      p.gmv += Number(it.line_total_aed ?? 0);
      productAgg.set(it.product_id, p);
    }
    const topSellers = Array.from(sellerAgg.entries())
      .map(([id, v]) => ({ id, name: sellerMap.get(id) ?? "—", gmv: +v.gmv.toFixed(2), units: v.units, commission: +v.commission.toFixed(2) }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);
    const topProducts = Array.from(productAgg.entries())
      .map(([id, v]) => ({ id, name: v.name, units: v.units, gmv: +v.gmv.toFixed(2) }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);

    const allSellers = sellers.data ?? [];
    const allProducts = products.data ?? [];
    const uniqueBuyers30 = new Set(o30.map((o) => o.buyer_id)).size;
    const totalCommission = +(items.data ?? []).reduce((a: number, it: any) => a + Number(it.commission_aed ?? 0), 0).toFixed(2);

    return {
      // KPI cards
      gmv: +sum(allOrders, "total_aed").toFixed(2),
      gmv30,
      gmvDelta,
      gmvToday: +sum(oToday, "total_aed").toFixed(2),
      gmv7: +sum(o7, "total_aed").toFixed(2),
      orders: allOrders.length,
      orders30: o30.length,
      orders7: o7.length,
      ordersToday: oToday.length,
      aov: o30.length ? +(gmv30 / o30.length).toFixed(2) : 0,
      commission: totalCommission,
      buyers: buyers.count ?? 0,
      uniqueBuyers30,
      sellers: allSellers.length,
      activeSellers: allSellers.filter((s: any) => s.status === "active").length,
      pendingSellers: pendingSellers.count ?? 0,
      products: allProducts.length,
      activeProducts: allProducts.filter((p: any) => p.status === "active").length,
      draftProducts: allProducts.filter((p: any) => p.status === "draft").length,
      lowStockCount: (lowStock.data ?? []).length,
      pendingFulfillment: allOrders.filter((o) => ["pending", "confirmed"].includes(o.status)).length,
      // Series & breakdowns
      series,
      statusBreakdown,
      paymentBreakdown,
      methodBreakdown,
      topSellers,
      topProducts,
      recentOrders: recent.data ?? [],
    };
  });

export const adminListSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sellers")
      .select("id, slug, store_name, status, contact_email, contact_phone, trn, commission_rate, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetSellerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerId: string; status: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      status: z.enum(["pending", "active", "suspended", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("sellers").update({ status: data.status as any }).eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, payment_status, payment_method, total_aed, created_at, buyer_id")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: string }) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("orders").update({ status: data.status as any }).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Allow first user to claim admin if there are no admins yet.
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Ask an admin to grant access.");
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Payouts =============

export const adminListPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("seller_payouts")
      .select(`id, seller_id, period_start, period_end, gross_aed, commission_aed, net_aed, status, paid_at, created_at,
        seller:sellers(store_name, slug, contact_email)`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminPayoutPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerId: string; periodStart: string; periodEnd: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.periodEnd < data.periodStart) throw new Error("End date must be after start date");
    const startIso = `${data.periodStart}T00:00:00.000Z`;
    const endIso = `${data.periodEnd}T23:59:59.999Z`;
    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select(`qty, line_total_aed, commission_aed,
        order:orders!inner(id, order_number, created_at, payment_status)`)
      .eq("seller_id", data.sellerId)
      .eq("order.payment_status", "paid")
      .gte("order.created_at", startIso)
      .lte("order.created_at", endIso);
    if (error) throw new Error(error.message);
    const rows = (items ?? []) as any[];
    const gross = +rows.reduce((a, x) => a + Number(x.line_total_aed ?? 0), 0).toFixed(2);
    const commission = +rows.reduce((a, x) => a + Number(x.commission_aed ?? 0), 0).toFixed(2);
    const orderIds = new Set(rows.map((r) => r.order?.id).filter(Boolean));
    return {
      gross,
      commission,
      net: +(gross - commission).toFixed(2),
      itemCount: rows.length,
      orderCount: orderIds.size,
    };
  });

export const adminGeneratePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sellerId: string; periodStart: string; periodEnd: string }) =>
    z.object({
      sellerId: z.string().uuid(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.periodEnd < data.periodStart) throw new Error("End date must be after start date");
    const startIso = `${data.periodStart}T00:00:00.000Z`;
    const endIso = `${data.periodEnd}T23:59:59.999Z`;
    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select(`line_total_aed, commission_aed,
        order:orders!inner(id, created_at, payment_status)`)
      .eq("seller_id", data.sellerId)
      .eq("order.payment_status", "paid")
      .gte("order.created_at", startIso)
      .lte("order.created_at", endIso);
    if (error) throw new Error(error.message);
    const rows = (items ?? []) as any[];
    const gross = +rows.reduce((a, x) => a + Number(x.line_total_aed ?? 0), 0).toFixed(2);
    const commission = +rows.reduce((a, x) => a + Number(x.commission_aed ?? 0), 0).toFixed(2);
    const net = +(gross - commission).toFixed(2);
    if (gross <= 0) throw new Error("No paid orders in that period — nothing to pay out");
    const { data: created, error: insErr } = await supabaseAdmin.from("seller_payouts").insert({
      seller_id: data.sellerId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      gross_aed: gross,
      commission_aed: commission,
      net_aed: net,
      status: "pending",
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: created.id, gross, commission, net };
  });

export const adminUpdatePayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payoutId: string; status: string }) =>
    z.object({
      payoutId: z.string().uuid(),
      status: z.enum(["pending", "processing", "paid", "cancelled"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: any = { status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status !== "paid") patch.paid_at = null;
    const { error } = await supabaseAdmin.from("seller_payouts").update(patch).eq("id", data.payoutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payoutId: string }) => z.object({ payoutId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("seller_payouts").delete().eq("id", data.payoutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Categories =============

const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes");
const categoryBaseSchema = {
  slug: slugSchema,
  name_en: z.string().min(1).max(120),
  name_es: z.string().min(1).max(120),
  name_ar: z.string().min(1).max(120),
  description_en: z.string().max(2000).optional().nullable(),
  description_es: z.string().max(2000).optional().nullable(),
  description_ar: z.string().max(2000).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  parent_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).max(9999),
  is_active: z.boolean(),
};

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [cats, prods] = await Promise.all([
      supabaseAdmin.from("categories").select("id, slug, name_en, name_es, name_ar, description_en, description_es, description_ar, image_url, parent_id, sort_order, is_active, created_at").order("sort_order").order("name_en"),
      supabaseAdmin.from("products").select("category_id"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    const counts = new Map<string, number>();
    for (const p of (prods.data ?? []) as any[]) {
      if (!p.category_id) continue;
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return (cats.data ?? []).map((c: any) => ({ ...c, product_count: counts.get(c.id) ?? 0 }));
  });

export const adminCreateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object(categoryBaseSchema).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload: any = { ...data };
    if (!payload.image_url) payload.image_url = null;
    if (!payload.parent_id) payload.parent_id = null;
    const { data: row, error } = await supabaseAdmin.from("categories").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminUpdateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({ id: z.string().uuid(), ...categoryBaseSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.parent_id === data.id) throw new Error("A category cannot be its own parent");
    const { id, ...patch } = data as any;
    if (!patch.image_url) patch.image_url = null;
    if (!patch.parent_id) patch.parent_id = null;
    const { error } = await supabaseAdmin.from("categories").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active: boolean }) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("categories").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [{ count: childCount }, { count: prodCount }] = await Promise.all([
      supabaseAdmin.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", data.id),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("category_id", data.id),
    ]);
    if ((childCount ?? 0) > 0) throw new Error(`Cannot delete: ${childCount} subcategor${childCount === 1 ? "y" : "ies"} attached`);
    if ((prodCount ?? 0) > 0) throw new Error(`Cannot delete: ${prodCount} product${prodCount === 1 ? "" : "s"} use this category`);
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Customers =============

export const adminListCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [profiles, orders, authList] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, preferred_lang, company_name, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("orders").select("buyer_id, total_aed, created_at, status"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    const emailMap = new Map<string, string>();
    for (const u of (authList.data?.users ?? []) as any[]) emailMap.set(u.id, u.email ?? "");
    const orderAgg = new Map<string, { count: number; gmv: number; last: string | null }>();
    for (const o of (orders.data ?? []) as any[]) {
      const cur = orderAgg.get(o.buyer_id) ?? { count: 0, gmv: 0, last: null };
      cur.count += 1;
      cur.gmv += Number(o.total_aed ?? 0);
      if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
      orderAgg.set(o.buyer_id, cur);
    }
    return (profiles.data ?? []).map((p: any) => {
      const agg = orderAgg.get(p.id);
      return {
        ...p,
        email: emailMap.get(p.id) ?? null,
        order_count: agg?.count ?? 0,
        gmv: +(agg?.gmv ?? 0).toFixed(2),
        last_order_at: agg?.last ?? null,
      };
    });
  });

export const adminGetCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [profileRes, addrs, orders, authUser, roles] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("addresses").select("*").eq("user_id", data.id).order("is_default", { ascending: false }),
      supabaseAdmin.from("orders").select("id, order_number, status, payment_status, total_aed, created_at").eq("buyer_id", data.id).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.auth.admin.getUserById(data.id),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (!profileRes.data) throw new Error("Customer not found");
    const allOrders = (orders.data ?? []) as any[];
    const gmv = +allOrders.reduce((a, o) => a + Number(o.total_aed ?? 0), 0).toFixed(2);
    return {
      profile: { ...profileRes.data, email: authUser.data?.user?.email ?? null },
      addresses: addrs.data ?? [],
      orders: allOrders,
      roles: (roles.data ?? []).map((r: any) => r.role),
      stats: {
        orders: allOrders.length,
        gmv,
        aov: allOrders.length ? +(gmv / allOrders.length).toFixed(2) : 0,
        first_order: allOrders.length ? allOrders[allOrders.length - 1].created_at : null,
        last_order: allOrders.length ? allOrders[0].created_at : null,
      },
    };
  });

// ===== Admin product creation =====
const AdminProductInput = z.object({
  seller_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(160),
  name_es: z.string().max(160).optional().nullable(),
  name_ar: z.string().max(160).optional().nullable(),
  description_en: z.string().max(2000).optional().nullable(),
  description_es: z.string().max(2000).optional().nullable(),
  description_ar: z.string().max(2000).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  origin_region: z.string().max(120).optional().nullable(),
  spice_level: z.number().int().min(0).max(5).optional().nullable(),
  is_bulk: z.boolean().default(false),
  is_halal: z.boolean().default(true),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  category_slug: z.string().optional().nullable(),
  attrs: z.record(z.string(), z.any()).optional().nullable(),
});

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof AdminProductInput>) => AdminProductInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let categoryId: string | null = null;
    if (data.category_slug) {
      const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", data.category_slug).maybeSingle();
      categoryId = cat?.id ?? null;
    }
    const baseSlug = data.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";
    let productId = data.id;
    if (!productId) {
      let slug = baseSlug;
      for (let i = 1; i < 30; i++) {
        const { data: hit } = await supabaseAdmin.from("products").select("id").eq("slug", slug).maybeSingle();
        if (!hit) break;
        slug = `${baseSlug}-${i}`;
      }
      const { data: created, error } = await supabaseAdmin.from("products").insert({
        seller_id: data.seller_id, slug, brand: data.brand || null,
        origin_region: data.origin_region || null, spice_level: data.spice_level ?? null,
        is_bulk: data.is_bulk, is_halal: data.is_halal, status: data.status,
        category_id: categoryId, attrs: data.attrs ?? {},
      }).select("id").single();
      if (error) throw new Error(error.message);
      productId = created.id;
      await supabaseAdmin.from("product_variants").insert({
        product_id: productId, format_label: null, price_aed: 0, stock: 0, is_default: true,
      });
    } else {
      const { error } = await supabaseAdmin.from("products").update({
        brand: data.brand || null, origin_region: data.origin_region || null,
        spice_level: data.spice_level ?? null, is_bulk: data.is_bulk, is_halal: data.is_halal,
        status: data.status, category_id: categoryId, attrs: data.attrs ?? {},
      }).eq("id", productId);
      if (error) throw new Error(error.message);
    }
    const trRows = [
      { product_id: productId, lang: "en" as const, name: data.name_en, description: data.description_en ?? null },
      ...(data.name_es ? [{ product_id: productId, lang: "es" as const, name: data.name_es, description: data.description_es ?? null }] : []),
      ...(data.name_ar ? [{ product_id: productId, lang: "ar" as const, name: data.name_ar, description: data.description_ar ?? null }] : []),
    ];
    await supabaseAdmin.from("product_translations").delete().eq("product_id", productId);
    if (trRows.length) await supabaseAdmin.from("product_translations").insert(trRows);
    return { productId };
  });