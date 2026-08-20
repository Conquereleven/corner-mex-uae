import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";

const RETURN_CAPABILITY_UNAVAILABLE = "CM_RETURN_CAPABILITY_UNAVAILABLE";
const SELLER_CAPABILITY_UNAVAILABLE = "CM_SELLER_CAPABILITY_UNAVAILABLE";

const Reason = z.enum([
  "damaged",
  "wrong_item",
  "not_as_described",
  "quality_issue",
  "no_longer_needed",
  "other",
]);
const Status = z.enum(["requested", "approved", "rejected", "received", "refunded", "cancelled"]);

export const buyerCreateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderItemId: string; reason: string; qty: number; notes?: string }) =>
    z
      .object({
        orderItemId: z.string().uuid(),
        reason: Reason,
        qty: z.number().int().min(1).max(500),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: item, error } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, qty, orders!inner(buyer_id)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    if (error) throw new Error("CM_RETURN_ORDER_ITEM_LOOKUP_FAILED");
    if (!item || (item as any).orders?.buyer_id !== context.userId) throw new Error("Not authorized");
    throw new Error(RETURN_CAPABILITY_UNAVAILABLE);
  });

export const buyerListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // No canonical returns table exists; an empty read state is truthful.
    return [];
  });

export const buyerCancelReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async () => {
    throw new Error(RETURN_CAPABILITY_UNAVAILABLE);
  });

export const sellerListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const sellerUpdateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; status: string; response?: string; refundAed?: number | null }) =>
      z
        .object({
          id: z.string().uuid(),
          status: Status,
          response: z.string().max(1000).optional(),
          refundAed: z.number().min(0).max(1_000_000).nullable().optional(),
        })
        .parse(input),
  )
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const adminListReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } | undefined) =>
    z.object({ status: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(RETURN_CAPABILITY_UNAVAILABLE);
  });
