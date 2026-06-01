import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

const RequestItem = z.object({
  name: z.string().min(1).max(160),
  qty: z.number().int().min(1).max(10000),
  notes: z.string().max(300).optional().nullable(),
  productSlug: z.string().max(120).optional().nullable(),
});

const ResponseItem = z.object({
  name: z.string().min(1).max(160),
  qty: z.number().int().min(1).max(10000),
  unit_price_aed: z.number().min(0).max(99999),
  notes: z.string().max(300).optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  seller_id: z.string().uuid().optional().nullable(),
});

const SubmitInput = z.object({
  company_name: z.string().max(160).optional().nullable(),
  contact_email: z.string().email().max(160),
  contact_phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(RequestItem).min(1).max(40),
});

export const submitQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof SubmitInput>) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await supabaseAdmin.from("quotes").insert({
      buyer_id: context.userId,
      company_name: data.company_name || null,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone || null,
      notes: data.notes || null,
      items: data.items as any,
      status: "open",
    }).select("id, quote_number").single();
    if (error) throw new Error(error.message);
    return q;
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("quotes")
      .select("id, quote_number, company_name, status, total_estimate_aed, valid_until, created_at, accepted_at, rejected_at, converted_order_id")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Not found");
    const isOwner = q.buyer_id === context.userId;
    if (!isOwner) await assertAdmin(context.userId);
    return q;
  });

export const adminListQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; search?: string }) =>
    z.object({ status: z.string().optional(), search: z.string().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("quotes")
      .select("id, quote_number, buyer_id, company_name, contact_email, status, total_estimate_aed, valid_until, created_at, assigned_admin_id, converted_order_id")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`quote_number.ilike.${s},company_name.ilike.${s},contact_email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const buyerIds = Array.from(new Set((rows ?? []).map((r: any) => r.buyer_id)));
    const profiles = buyerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", buyerIds)
      : { data: [] as any[] };
    const nameMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p.full_name]));

    // KPIs
    const total = rows?.length ?? 0;
    const open = rows?.filter((r: any) => r.status === "open").length ?? 0;
    const responded = rows?.filter((r: any) => r.status === "responded").length ?? 0;
    const accepted = rows?.filter((r: any) => r.status === "accepted").length ?? 0;
    const pipeline = +(rows ?? [])
      .filter((r: any) => ["open", "responded"].includes(r.status))
      .reduce((a: number, r: any) => a + Number(r.total_estimate_aed ?? 0), 0).toFixed(2);
    const acceptanceRate = responded + accepted > 0 ? +((accepted / (responded + accepted)) * 100).toFixed(1) : 0;

    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, buyer_name: nameMap.get(r.buyer_id) ?? null })),
      kpi: { total, open, responded, accepted, pipeline, acceptanceRate },
    };
  });

const RespondInput = z.object({
  id: z.string().uuid(),
  items: z.array(ResponseItem).min(1).max(40),
  notes: z.string().max(2000).optional().nullable(),
  valid_until: z.string().optional().nullable(), // YYYY-MM-DD
  assign_to_me: z.boolean().default(true),
});

export const adminRespondQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof RespondInput>) => RespondInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const total = +data.items.reduce((a, i) => a + i.qty * i.unit_price_aed, 0).toFixed(2);
    const { error } = await supabaseAdmin.from("quotes").update({
      status: "responded",
      response: { items: data.items, notes: data.notes ?? null } as any,
      total_estimate_aed: total,
      valid_until: data.valid_until || null,
      assigned_admin_id: data.assign_to_me ? context.userId : null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, total };
  });

export const adminCancelQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("quotes").update({ status: "expired" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AcceptInput = z.object({
  id: z.string().uuid(),
  shipping_address: z.object({
    recipient_name: z.string().min(1).max(120),
    phone: z.string().min(5).max(40),
    emirate: z.enum(["AD", "DU", "SH", "AJ", "UQ", "RK", "FU"]),
    area: z.string().min(1).max(120),
    street: z.string().max(160).optional().nullable(),
    building: z.string().max(80).optional().nullable(),
    floor_apt: z.string().max(40).optional().nullable(),
    landmark: z.string().max(120).optional().nullable(),
  }),
});

export const acceptQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof AcceptInput>) => AcceptInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await supabaseAdmin.from("quotes").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Not found");
    if (q.buyer_id !== context.userId) throw new Error("Forbidden");
    if (q.status !== "responded") throw new Error("This quote cannot be accepted in its current state");
    if (q.valid_until && new Date(q.valid_until) < new Date()) throw new Error("This quote has expired");

    const responseItems: any[] = (q.response as any)?.items ?? [];
    const fullyMapped = responseItems.length > 0 && responseItems.every((i) => i.variant_id && i.product_id && i.seller_id);

    let orderId: string | null = null;
    let orderNumber: string | null = null;

    if (fullyMapped) {
      let subtotal = 0;
      const orderItems = responseItems.map((i) => {
        const line = +(i.qty * i.unit_price_aed).toFixed(2);
        subtotal += line;
        return {
          seller_id: i.seller_id,
          product_id: i.product_id,
          variant_id: i.variant_id,
          product_name: i.name,
          variant_label: null,
          qty: i.qty,
          unit_price_aed: i.unit_price_aed,
          line_total_aed: line,
          commission_aed: 0,
        };
      });
      const tax = +(subtotal * 0.05).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const { data: order, error: oErr } = await supabaseAdmin.from("orders").insert({
        buyer_id: context.userId,
        status: "pending",
        payment_status: "pending",
        payment_method: "bank_transfer",
        shipping_address: data.shipping_address as any,
        subtotal_aed: subtotal, tax_aed: tax, shipping_aed: 0, total_aed: total,
        notes: `From quote ${q.quote_number}`,
      }).select("id, order_number").single();
      if (oErr) throw new Error(oErr.message);
      orderId = order.id; orderNumber = order.order_number;
      const { error: iErr } = await supabaseAdmin.from("order_items").insert(orderItems.map((it) => ({ ...it, order_id: order.id })));
      if (iErr) throw new Error(iErr.message);
    }

    const { error: uErr } = await supabaseAdmin.from("quotes").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      converted_order_id: orderId,
    }).eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, orderId, orderNumber, fullyMapped };
  });

export const rejectQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: q } = await supabaseAdmin.from("quotes").select("buyer_id, status").eq("id", data.id).maybeSingle();
    if (!q || q.buyer_id !== context.userId) throw new Error("Forbidden");
    if (!["open", "responded"].includes(q.status)) throw new Error("Cannot reject in this state");
    const { error } = await supabaseAdmin.from("quotes").update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: data.reason || null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });