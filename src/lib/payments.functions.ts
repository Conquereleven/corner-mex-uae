import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";

function getAppUrl(): string {
  const request = getRequest();
  const host = request?.headers?.get("host") || "project--d9495376-339d-44dd-9c8a-db0f7b451f96.lovable.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY in secrets.");
  const { default: Stripe } = await import("stripe");
  return new Stripe(secret, { apiVersion: "2025-03-31.basil" as any });
}

export const createStripeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = await getStripe();
    const appUrl = getAppUrl();

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select(`id, order_number, total_aed, status, buyer_id,
        items:order_items(id, product_name, variant_label, qty, unit_price_aed, line_total_aed)`)
      .eq("id", data.orderId)
      .eq("buyer_id", userId)
      .single();
    if (oErr || !order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Order already processed");

    const lineItems = (order.items as any[]).map((item) => ({
      price_data: {
        currency: "aed",
        product_data: {
          name: item.product_name,
          description: item.variant_label || undefined,
        },
        unit_amount: Math.round(Number(item.unit_price_aed) * 100),
      },
      quantity: item.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${appUrl}/order-confirmed?order=${order.id}`,
      cancel_url: `${appUrl}/checkout`,
      metadata: { order_id: order.id, order_number: order.order_number },
      customer_email: (context.claims as any)?.email || undefined,
    });

    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      provider: "stripe",
      external_id: session.id,
      amount_aed: order.total_aed,
      status: "pending",
    });

    return { url: session.url };
  });

export const confirmBnplPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; provider: "tabby" | "tamara" }) =>
    z.object({ orderId: z.string().uuid(), provider: z.enum(["tabby", "tamara"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, buyer_id, total_aed")
      .eq("id", data.orderId)
      .eq("buyer_id", userId)
      .single();
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Order already processed");

    await supabaseAdmin.from("payments").insert({
      order_id: data.orderId,
      provider: data.provider,
      external_id: `sim-${Date.now()}`,
      amount_aed: order.total_aed,
      status: "paid",
      raw: { simulated: true, approved_at: new Date().toISOString() },
    });

    await supabaseAdmin.from("orders")
      .update({ payment_status: "paid", status: "paid" })
      .eq("id", data.orderId);

    return { success: true };
  });

export const getOrderForConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`id, order_number, status, payment_status, payment_method, total_aed, subtotal_aed, shipping_aed, tax_aed, created_at,
        items:order_items(product_name, variant_label, qty, unit_price_aed, line_total_aed, seller_id, fulfillment_status,
          seller:sellers(store_name)
        )`)
      .eq("id", data.orderId)
      .eq("buyer_id", userId)
      .single();
    if (error || !order) throw new Error("Order not found");
    return order;
  });
