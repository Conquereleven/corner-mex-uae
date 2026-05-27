import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) {
          return new Response("Missing signature", { status: 400 });
        }

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
          return new Response("Webhook secret not configured", { status: 500 });
        }

        const body = await request.text();

        // Verify signature
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" as any });
        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } catch (err: any) {
          console.error("[Stripe Webhook] Signature verification failed:", err.message);
          return new Response(`Invalid signature: ${err.message}`, { status: 400 });
        }

        console.log("[Stripe Webhook] Event received:", event.type);

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as any;
          const orderId = session.metadata?.order_id;
          if (!orderId) {
            console.error("[Stripe Webhook] No order_id in session metadata");
            return new Response("Missing order_id", { status: 400 });
          }

          // Update order
          const { error: orderErr } = await supabaseAdmin
            .from("orders")
            .update({ payment_status: "paid", status: "confirmed", updated_at: new Date().toISOString() })
            .eq("id", orderId);
          if (orderErr) {
            console.error("[Stripe Webhook] Failed to update order:", orderErr.message);
            return new Response("Database error", { status: 500 });
          }

          // Update payment record
          const { error: payErr } = await supabaseAdmin
            .from("payments")
            .update({ status: "paid", raw: session })
            .eq("external_id", session.id);
          if (payErr) {
            console.error("[Stripe Webhook] Failed to update payment:", payErr.message);
          }

          console.log("[Stripe Webhook] Order marked as paid:", orderId);
          return new Response("OK", { status: 200 });
        }

        return new Response("Ignored", { status: 200 });
      },
    },
  },
});
