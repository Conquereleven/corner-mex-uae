import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin-authorization.server";

const SHIPMENT_CAPABILITY_UNAVAILABLE = "CM_SHIPMENT_CAPABILITY_UNAVAILABLE";
const SELLER_CAPABILITY_UNAVAILABLE = "CM_SELLER_CAPABILITY_UNAVAILABLE";

const CARRIERS = [
  "aramex",
  "dhl",
  "fedex",
  "talabat",
  "local_courier",
  "pickup",
  "other",
] as const;
const SHIP_STATUSES = ["prepared", "in_transit", "delivered", "returned", "lost"] as const;

const SendOrderEmail = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(["order_placed", "shipped", "delivered"]),
  shipmentId: z.string().uuid().optional(),
});

/**
 * The historical shipment email server function had no authentication boundary.
 * Shipment email delivery is now fail-closed until the canonical shipment model
 * and transactional-email outbox are activated.
 */
export const sendOrderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof SendOrderEmail>) => SendOrderEmail.parse(input))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(SHIPMENT_CAPABILITY_UNAVAILABLE);
  });

export const sellerListShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId?: string }) =>
    z.object({ orderId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
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
  .inputValidator((input: z.input<typeof CreateShipment>) => CreateShipment.parse(input))
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
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
  .inputValidator((input: z.input<typeof UpdateShipment>) => UpdateShipment.parse(input))
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const sellerMarkDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shipmentId: string }) =>
    z.object({ shipmentId: z.string().uuid() }).parse(input),
  )
  .handler(async () => {
    throw new Error(SELLER_CAPABILITY_UNAVAILABLE);
  });

export const adminListShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; carrier?: string }) =>
    z
      .object({ status: z.string().optional(), carrier: z.string().optional() })
      .parse(input),
  )
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    throw new Error(SHIPMENT_CAPABILITY_UNAVAILABLE);
  });

export const buyerListOrderShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error("CM_ORDER_LOOKUP_FAILED");
    if (!order || order.buyer_id !== context.userId) throw new Error("Not authorized");

    // No canonical shipment table exists. Returning an empty list is truthful for
    // the buyer read path and avoids exposing a future-table dependency.
    return [];
  });
