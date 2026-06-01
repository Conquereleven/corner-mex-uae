import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/lib/notifications.functions";

const Reason = z.enum(["damaged", "wrong_item", "not_as_described", "quality_issue", "no_longer_needed", "other"]);
const Status = z.enum(["requested", "approved", "rejected", "received", "refunded", "cancelled"]);

export const buyerCreateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { orderItemId: string; reason: string; qty: number; notes?: string }) =>
    z.object({
      orderItemId: z.string().uuid(),
      reason: Reason,
      qty: z.number().int().min(1).max(500),
      notes: z.string().max(1000).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: oi } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, seller_id, qty, orders!inner(buyer_id, status)")
      .eq("id", data.orderItemId).maybeSingle();
    if (!oi) throw new Error("Order item not found");
    if ((oi as any).orders.buyer_id !== userId) throw new Error("Not your order");
    if (data.qty > oi.qty) throw new Error("Qty exceeds purchased");
    const { data: row, error } = await supabaseAdmin.from("returns").insert({
      order_id: oi.order_id, order_item_id: oi.id, buyer_id: userId, seller_id: oi.seller_id,
      qty: data.qty, reason: data.reason as any, status: "requested", buyer_notes: data.notes ?? null,
    }).select("id, return_number").single();
    if (error) throw new Error(error.message);
    // Notify seller
    const { data: seller } = await supabaseAdmin.from("sellers").select("user_id").eq("id", oi.seller_id).maybeSingle();
    if (seller?.user_id) {
      await createNotification({
        userId: seller.user_id, kind: "new_sale" as any,
        title: `Return request ${row.return_number}`,
        body: `Buyer requested a return — please review.`,
        link: "/seller/returns", orderId: oi.order_id,
      });
    }
    return row;
  });

export const buyerListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("returns")
      .select("*, order:orders(order_number), item:order_items(product_name, variant_label)")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const buyerCancelReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("returns")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", data.id).eq("buyer_id", context.userId).eq("status", "requested");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sellerListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller) return [];
    const { data } = await supabaseAdmin
      .from("returns")
      .select("*, order:orders(order_number, buyer_id), item:order_items(product_name, variant_label, unit_price_aed)")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const sellerUpdateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: string; response?: string; refundAed?: number | null }) =>
    z.object({
      id: z.string().uuid(),
      status: Status,
      response: z.string().max(1000).optional(),
      refundAed: z.number().min(0).max(1_000_000).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    // Ensure seller owns it
    const { data: ret } = await supabaseAdmin
      .from("returns").select("id, seller_id, buyer_id, order_id, return_number").eq("id", data.id).maybeSingle();
    if (!ret) throw new Error("Return not found");
    const { data: seller } = await supabaseAdmin.from("sellers").select("id").eq("user_id", context.userId).maybeSingle();
    if (!seller || seller.id !== ret.seller_id) throw new Error("Not allowed");

    const patch: any = { status: data.status as any };
    if (data.response !== undefined) patch.seller_response = data.response;
    if (data.refundAed !== undefined) patch.refund_aed = data.refundAed;
    if (["approved", "rejected", "refunded", "cancelled", "received"].includes(data.status)) {
      patch.resolved_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("returns").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notify buyer
    const label =
      data.status === "approved" ? "approved" :
      data.status === "rejected" ? "rejected" :
      data.status === "received" ? "marked as received" :
      data.status === "refunded" ? "refunded" : data.status;
    await createNotification({
      userId: ret.buyer_id, kind: "order_delivered" as any,
      title: `Return ${ret.return_number} ${label}`,
      body: data.response ?? null,
      link: "/account/returns", orderId: ret.order_id,
    });
    return { ok: true };
  });

export const adminListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { status?: string }) => z.object({ status: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("returns")
      .select("*, order:orders(order_number), item:order_items(product_name, variant_label), seller:sellers(store_name)")
      .order("created_at", { ascending: false }).limit(200);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows } = await q;
    return rows ?? [];
  });
