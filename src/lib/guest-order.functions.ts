// Guest order tracking and account claim (founder decision 2026-09-20).
//
// Guest orders are reachable only through a capability token: `anon` has no
// privileges on public.orders, and the RLS policy (buyer_id = auth.uid()) never
// matches a guest order, whose buyer_id is NULL. Knowing an order id grants
// nothing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TrackingInput = z.object({
  orderId: z.string().uuid(),
  // 32 random bytes, hex encoded, minted by the database at order creation.
  token: z.string().regex(/^[0-9a-f]{64}$/),
});

export type GuestOrderView = {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal_aed: number;
  shipping_aed: number;
  tax_aed: number;
  total_aed: number;
  created_at: string;
  items: Array<{
    product_name: string;
    variant_label: string | null;
    qty: number;
    line_total_aed: number;
  }>;
};

/** Public: returns a guest order only when the capability token matches. */
export const getGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof TrackingInput>) => TrackingInput.parse(input))
  .handler(async ({ data }): Promise<GuestOrderView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc(
      "cm_guest_order_by_token_v1" as never,
      {
        p_order_id: data.orderId,
        p_token: data.token,
      } as never,
    );
    // A wrong token and a missing order are indistinguishable by design.
    if (error || !result) return null;
    return result as unknown as GuestOrderView;
  });

/**
 * Links a guest order to the signed-in account. The database requires BOTH the
 * capability token and a verified account email equal to the order's guest
 * email, so a matching email alone can never take over an order.
 */
export const claimGuestOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof TrackingInput>) => TrackingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc(
      "cm_claim_guest_order_v1" as never,
      {
        p_user_id: context.userId,
        p_order_id: data.orderId,
        p_token: data.token,
      } as never,
    );
    if (error) {
      const code = /ORDER_CLAIM_[A-Z_]+/.exec(error.message)?.[0] ?? "ORDER_CLAIM_INVALID";
      throw new Error(code);
    }
    return result as unknown as { order_id: string; claimed: boolean; repeat: boolean };
  });
