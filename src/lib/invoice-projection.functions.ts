import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeInvoice, type InvoiceProjection } from "./invoice-projection";
export const getOrderInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: invoice, error } = await (
      supabaseAdmin as unknown as {
        rpc(
          name: string,
          args: Record<string, unknown>,
        ): Promise<{ data: InvoiceProjection | null; error: unknown }>;
      }
    ).rpc("cm_invoice_projection_v2", { p_actor_id: context.userId, p_order_id: data.orderId });
    if (error) return { available: false, invoice: null };
    // Product-specific host confirmation is an activation input. Empty means no link.
    const hosts = (process.env.CORNERMEX_INVOICE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    return { available: true, invoice: sanitizeInvoice(invoice, hosts) };
  });
