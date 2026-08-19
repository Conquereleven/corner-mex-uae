import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  persistNotification,
  type CreateNotificationResult,
  type NotifyParams,
} from "@/lib/notifications-persistence";
export type {
  CreateNotificationResult,
  NotificationKind,
  NotifyParams,
} from "@/lib/notifications-persistence";

/** Server-only helper. Best-effort for producers, with an observable result. */
export async function createNotification(p: NotifyParams) {
  const result = await persistNotification(supabaseAdmin, p);
  if (!result.ok) {
    console.error("[notifications] create failed", result.error);
  }
  return result satisfies CreateNotificationResult;
}

/** Notify every seller involved in an order. */
export async function notifyOrderSellers(
  orderId: string,
  params: Omit<NotifyParams, "userId" | "orderId">,
) {
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
      Array.from(userIds).map((userId) => createNotification({ ...params, userId, orderId })),
    );
  } catch (e) {
    console.error("[notifications] notifyOrderSellers failed", e);
  }
}

// ----- Server functions for UI -----

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number; onlyUnread?: boolean }) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        onlyUnread: z.boolean().optional(),
      })
      .parse(i),
  )
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
