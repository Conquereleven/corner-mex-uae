import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PlaceCodOrderInput } from "@/lib/cod-order.functions";
import { evaluateCommercialConfig, shippingForEmirate } from "@/lib/commercial-config.server";
import { readCardCapability } from "@/lib/card-capability.server";
import { createStripeSession } from "@/lib/payments.functions";

export const getCardCheckoutCapability = createServerFn({ method: "GET" }).handler(async () => {
  const state = await readCardCapability();
  return { cardAvailable: state.available, testMode: state.available && state.mode === "test" };
});
const Input = PlaceCodOrderInput.extend({
  payment_method: z.literal("card"),
  operationId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
});
export const initiateCardCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof Input>) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const capability = await readCardCapability();
    const config = evaluateCommercialConfig();
    if (!capability.available || !config.ready) throw new Error("CARD_CHECKOUT_UNAVAILABLE");
    const { data: order, error } = await (
      supabaseAdmin as unknown as {
        rpc(
          name: string,
          args: Record<string, unknown>,
        ): Promise<{ data: { order_id: string } | null; error: unknown }>;
      }
    ).rpc("cm_create_card_order_v2", {
      p_buyer_id: context.userId,
      p_operation_id: data.operationId,
      p_items: data.items,
      p_shipping_address: data.address,
      p_shipping_aed: shippingForEmirate(data.address.emirate, config.config),
      p_tax_rate: config.config.vatRate,
      p_legal_acceptance: data.legal_acceptance,
      p_mode: capability.mode,
      p_account_id: data.accountId ?? null,
    });
    if (error || !order) throw new Error("CARD_CHECKOUT_UNAVAILABLE");
    const session = await createStripeSession({ data: { orderId: order.order_id } });
    return { orderId: order.order_id, url: session.url };
  });
