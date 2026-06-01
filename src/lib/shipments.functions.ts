import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildTrackingUrl, tplOrderShipped, tplOrderDelivered, tplOrderPlaced, type OrderEmailContext } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications.functions";

const CARRIERS = ["aramex", "dhl", "fedex", "talabat", "local_courier", "pickup", "other"] as const;
const SHIP_STATUSES = ["prepared", "in_transit", "delivered", "returned", "lost"] as const;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "Corner Mex <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    console.warn("[email] Skipping send — missing LOVABLE_API_KEY or RESEND_API_KEY");
    return { ok: false, skipped: true };
  }
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error", res.status, body);
    return { ok: false, error: body };
  }
  return { ok: true };
}

async function loadOrderEmailCtx(orderId: string): Promise<{ ctx: OrderEmailContext; buyerEmail: string | null } | null> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total_aed, buyer_id, sla_min_days, sla_max_days")
    .eq("id", orderId).maybeSingle();
  if (!order) return null;
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_name, qty, line_total_aed")
    .eq("order_id", orderId);
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(order.buyer_id);
  const publicOrigin = process.env.PUBLIC_SITE_URL || "https://cornermex.ae";
  return {
    buyerEmail: authUser?.user?.email ?? null,
    ctx: {
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(order.total_aed),
      publicOrigin,
      items: (items ?? []).map((i: any) => ({ name: `${i.product_name}`, qty: i.qty, total: Number(i.line_total_aed) })),
    },
  };
}

async function logNotification(orderId: string, kind: string, status: "sent" | "failed" | "skipped", payload: any) {
  await supabaseAdmin.from("order_notifications").insert({
    order_id: orderId,
    kind: kind as any,
    channel: "email",
    status,
    payload,
  });
}

export const sendOrderEmail = createServerFn({ method: "POST" })
  .inputValidator((i: { orderId: string; kind: "order_placed" | "shipped" | "delivered"; shipmentId?: string }) =>
    z.object({
      orderId: z.string().uuid(),
      kind: z.enum(["order_placed", "shipped", "delivered"]),
      shipmentId: z.string().uuid().optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    const loaded = await loadOrderEmailCtx(data.orderId);
    if (!loaded || !loaded.buyerEmail) {
      await logNotification(data.orderId, data.kind, "skipped", { reason: "no_buyer_email" });
      return { ok: false, skipped: true };
    }
    let email;
    if (data.kind === "order_placed") {
      email = tplOrderPlaced(loaded.ctx);
    } else if (data.kind === "shipped") {
      const { data: sh } = await supabaseAdmin.from("shipments")
        .select("carrier, tracking_number, tracking_url")
        .eq("id", data.shipmentId ?? "").maybeSingle();
      const carrier = sh?.carrier ?? "other";
      const tracking = sh?.tracking_number ?? null;
      const trackingUrl = sh?.tracking_url ?? buildTrackingUrl(carrier, tracking);
      const sla = loaded.ctx ? null : null;
      email = tplOrderShipped({ ...loaded.ctx, carrier, tracking, trackingUrl, sla });
    } else {
      email = tplOrderDelivered(loaded.ctx);
    }
    const r = await sendEmail(loaded.buyerEmail, email.subject, email.html);
    await logNotification(data.orderId, data.kind, r.ok ? "sent" : "failed", { to: loaded.buyerEmail, subject: email.subject, error: (r as any).error });
    return r;
  });

// ----- Seller: shipments -----

export const sellerListShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { orderId?: string }) => z.object({ orderId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    let q = supabaseAdmin.from("shipments").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false });
    if (data.orderId) q = q.eq("order_id", data.orderId);
    const { data: list, error } = await q;
    if (error) throw new Error(error.message);
    return list ?? [];
  });

const CreateShipment = z.object({
  orderId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(50),
  carrier: z.enum(CARRIERS),
  trackingNumber: z.string().max(120).optional().nullable(),
  weightGrams: z.number().int().min(0).max(1_000_000).optional().nullable(),
  costAed: z.number().min(0).max(100000).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  labelUrl: z.string().url().optional().nullable(),
});

export const sellerCreateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof CreateShipment>) => CreateShipment.parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");

    // verify all items belong to this seller & order
    const { data: items, error: iErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, order_id")
      .in("id", data.itemIds);
    if (iErr) throw new Error(iErr.message);
    const valid = (items ?? []).every((i: any) => i.seller_id === seller.id && i.order_id === data.orderId);
    if (!valid) throw new Error("Items do not belong to this seller/order");

    const trackingUrl = data.trackingNumber ? buildTrackingUrl(data.carrier, data.trackingNumber) : null;

    const { data: shipment, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: data.orderId,
        seller_id: seller.id,
        carrier: data.carrier,
        tracking_number: data.trackingNumber ?? null,
        tracking_url: trackingUrl,
        weight_grams: data.weightGrams ?? null,
        cost_aed: data.costAed ?? null,
        notes: data.notes ?? null,
        label_url: data.labelUrl ?? null,
        status: "in_transit",
        shipped_at: new Date().toISOString(),
      })
      .select("*").single();
    if (error) throw new Error(error.message);

    // Mark items shipped + link shipment
    await supabaseAdmin.from("order_items")
      .update({ fulfillment_status: "shipped" as any, shipment_id: shipment.id })
      .in("id", data.itemIds);

    // If every item in order is shipped, mark order shipped
    const { data: allItems } = await supabaseAdmin
      .from("order_items").select("fulfillment_status").eq("order_id", data.orderId);
    if ((allItems ?? []).every((x: any) => x.fulfillment_status === "shipped" || x.fulfillment_status === "delivered")) {
      await supabaseAdmin.from("orders").update({ status: "shipped" as any }).eq("id", data.orderId);
    }

    // Send email (best-effort)
    try {
      const loaded = await loadOrderEmailCtx(data.orderId);
      if (loaded?.buyerEmail) {
        const tpl = tplOrderShipped({
          ...loaded.ctx,
          carrier: data.carrier,
          tracking: data.trackingNumber ?? null,
          trackingUrl,
          sla: null,
        });
        const r = await sendEmail(loaded.buyerEmail, tpl.subject, tpl.html);
        await logNotification(data.orderId, "shipped", r.ok ? "sent" : "failed", { shipment_id: shipment.id, to: loaded.buyerEmail });
      }
    } catch (e: any) {
      console.error("Shipment email failed", e);
    }

    // In-app notification to buyer
    try {
      const { data: ord } = await supabaseAdmin.from("orders").select("buyer_id, order_number").eq("id", data.orderId).maybeSingle();
      if (ord) {
        await createNotification({
          userId: ord.buyer_id,
          kind: "order_shipped",
          title: `Order ${ord.order_number} shipped`,
          body: data.trackingNumber ? `${data.carrier.toUpperCase()} · ${data.trackingNumber}` : `${data.carrier.toUpperCase()} shipment created.`,
          link: "/account",
          orderId: data.orderId,
          shipmentId: shipment.id,
          metadata: { carrier: data.carrier, tracking_number: data.trackingNumber, tracking_url: trackingUrl },
        });
      }
    } catch (e) { console.error("notify shipped failed", e); }

    return { id: shipment.id };
  });

const UpdateShipment = z.object({
  id: z.string().uuid(),
  status: z.enum(SHIP_STATUSES).optional(),
  trackingNumber: z.string().max(120).optional().nullable(),
  trackingUrl: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const sellerUpdateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof UpdateShipment>) => UpdateShipment.parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");
    const patch: any = {};
    if (data.status) patch.status = data.status;
    if (data.trackingNumber !== undefined) patch.tracking_number = data.trackingNumber;
    if (data.trackingUrl !== undefined) patch.tracking_url = data.trackingUrl;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("shipments").update(patch).eq("id", data.id).eq("seller_id", seller.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellerMarkDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shipmentId: string }) => z.object({ shipmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) throw new Error("Not a seller");

    const { data: sh, error } = await supabaseAdmin.from("shipments")
      .update({ status: "delivered" as any, delivered_at: new Date().toISOString() })
      .eq("id", data.shipmentId).eq("seller_id", seller.id)
      .select("id, order_id").single();
    if (error) throw new Error(error.message);

    // mark linked items delivered
    await supabaseAdmin.from("order_items")
      .update({ fulfillment_status: "delivered" as any })
      .eq("shipment_id", sh.id);

    // if all order items delivered, mark order delivered + email
    const { data: allItems } = await supabaseAdmin.from("order_items")
      .select("fulfillment_status").eq("order_id", sh.order_id);
    if ((allItems ?? []).every((x: any) => x.fulfillment_status === "delivered")) {
      await supabaseAdmin.from("orders").update({ status: "delivered" as any }).eq("id", sh.order_id);
      try {
        const loaded = await loadOrderEmailCtx(sh.order_id);
        if (loaded?.buyerEmail) {
          const tpl = tplOrderDelivered(loaded.ctx);
          const r = await sendEmail(loaded.buyerEmail, tpl.subject, tpl.html);
          await logNotification(sh.order_id, "delivered", r.ok ? "sent" : "failed", { to: loaded.buyerEmail });
        }
      } catch (e) { console.error(e); }
      try {
        const { data: ord } = await supabaseAdmin.from("orders").select("buyer_id, order_number").eq("id", sh.order_id).maybeSingle();
        if (ord) {
          await createNotification({
            userId: ord.buyer_id,
            kind: "order_delivered",
            title: `Order ${ord.order_number} delivered`,
            body: "Thanks for shopping with Corner Mex!",
            link: "/account",
            orderId: sh.order_id,
          });
        }
      } catch (e) { console.error("notify delivered failed", e); }
    }

    // Notify the seller their shipment was marked delivered
    try {
      await createNotification({
        userId: context.userId,
        kind: "shipment_delivered",
        title: `Shipment delivered`,
        body: `A shipment on order has been marked delivered.`,
        link: "/seller/orders",
        orderId: sh.order_id,
        shipmentId: sh.id,
      });
    } catch (e) { console.error("notify seller delivered failed", e); }

    return { ok: true };
  });

// ----- Admin: global shipments -----

export const adminListShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string; carrier?: string }) =>
    z.object({ status: z.string().optional(), carrier: z.string().optional() }).parse(i))
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("shipments")
      .select(`*, seller:sellers(store_name), order:orders(order_number, buyer_id, total_aed)`)
      .order("created_at", { ascending: false }).limit(200);
    if (data.status) q = q.eq("status", data.status as any);
    if (data.carrier) q = q.eq("carrier", data.carrier as any);
    const { data: list, error } = await q;
    if (error) throw new Error(error.message);
    return list ?? [];
  });

// ----- Buyer: order shipments -----
export const buyerListOrderShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: order } = await supabaseAdmin.from("orders")
      .select("id, buyer_id").eq("id", data.orderId).maybeSingle();
    if (!order || order.buyer_id !== context.userId) throw new Error("Not authorized");
    const { data: list, error } = await supabaseAdmin.from("shipments")
      .select("*, seller:sellers(store_name)")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return list ?? [];
  });