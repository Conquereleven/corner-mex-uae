import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationKind =
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "new_sale"
  | "shipment_created"
  | "shipment_delivered"
  | "quote_response"
  | "payout_paid";

export interface NotifyParams {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  orderId?: string | null;
  shipmentId?: string | null;
  metadata?: Record<string, any> | null;
}

/** Server-only helper. Best-effort: failures are logged, never thrown. */
export async function createNotification(p: NotifyParams) {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: p.userId,
      kind: p.kind,
      title: p.title,
      body: p.body ?? null,
      link: p.link ?? null,
      order_id: p.orderId ?? null,
      shipment_id: p.shipmentId ?? null,
      metadata: p.metadata ?? null,
    });
  } catch (e) {
    console.error("[notifications] create failed", e);
  }
}

/** Notify every seller involved in an order. */
export async function notifyOrderSellers(orderId: string, params: Omit<NotifyParams, "userId" | "orderId">) {
  try {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("seller_id, sellers:sellers!inner(user_id)")
      .eq("order_id", orderId);
    const userIds = new Set<string>();
    for (const it of items ?? []) {
      const uid = (it as any).sellers?.user_id;
      if (uid) userIds.add(uid);
    }
    await Promise.all(
      Array.from(userIds).map((userId) => createNotification({ ...params, userId, orderId }))
    );
  } catch (e) {
    console.error("[notifications] notifyOrderSellers failed", e);
  }
}

// ----- Server functions for UI -----

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number; onlyUnread?: boolean }) =>
    z.object({ limit: z.number().int().min(1).max(200).optional(), onlyUnread: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.onlyUnread) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });