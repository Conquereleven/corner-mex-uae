import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyStripeWebhookEvent } from "@/lib/stripe-webhook-verification";

const uuid = z.string().uuid();
const database = supabaseAdmin as any;

type WebhookCall = Record<string, unknown>;

function amountAed(amount: unknown) {
  if (!Number.isSafeInteger(amount) || (amount as number) < 0) return null;
  return Number(((amount as number) / 100).toFixed(2));
}

function invalid() {
  return new Response("Invalid webhook payload", { status: 400 });
}

async function process(call: WebhookCall) {
  const { error } = await database.rpc("cm_pay_process_stripe_webhook_v1", call);
  if (error) throw new Error("payment_webhook_processing_failed");
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!signature || !webhookSecret) return new Response("Invalid webhook", { status: 400 });

        // Signature verification must receive Stripe's byte-for-byte UTF-8
        // request body. Do not call request.json() before constructEvent.
        const rawBody = await request.text();
        let verification;
        try {
          const { default: Stripe } = await import("stripe");
          // Signature verification is local and does not use the account key.
          // A non-secret SDK placeholder prevents this endpoint from requiring
          // STRIPE_SECRET_KEY and keeps webhook verification independently safe.
          const stripe = new Stripe("sk_webhook_verification_only");
          verification = verifyStripeWebhookEvent({
            rawBody,
            signature,
            webhookSecret,
            constructEvent: (body, sig, secret) =>
              stripe.webhooks.constructEvent(body, sig, secret),
          });
        } catch {
          return new Response("Invalid signature", { status: 400 });
        }
        if (!verification?.ok) return new Response("Invalid signature", { status: 400 });
        const event: any = verification.event;

        try {
          const object = event?.data?.object;
          if (!event?.id || !event?.type || !object || typeof object !== "object") return invalid();
          const providerCreatedAt =
            typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : null;

          if (
            event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded" ||
            event.type === "checkout.session.async_payment_failed" ||
            event.type === "checkout.session.expired"
          ) {
            if (object.object !== "checkout.session" || typeof object.id !== "string")
              return invalid();
            const orderId = uuid.safeParse(object.metadata?.order_id);
            const paymentId = uuid.safeParse(object.metadata?.payment_attempt_id);
            const total = amountAed(object.amount_total);
            if (
              !orderId.success ||
              !paymentId.success ||
              object.currency !== "aed" ||
              total === null
            ) {
              return invalid();
            }
            const completedStatus = object.payment_status;
            if (
              event.type === "checkout.session.completed" &&
              completedStatus !== "paid" &&
              completedStatus !== "unpaid"
            ) {
              return invalid();
            }
            await process({
              p_event_id: event.id,
              p_event_type: event.type,
              p_provider_object_id: object.id,
              p_payment_id: paymentId.data,
              p_order_id: orderId.data,
              p_currency: object.currency,
              p_amount_aed: total,
              p_provider_created_at: providerCreatedAt,
              p_payment_status: typeof completedStatus === "string" ? completedStatus : null,
              p_payment_intent_id:
                typeof object.payment_intent === "string" ? object.payment_intent : null,
              p_refunded_amount_aed: null,
            });
            return new Response("OK", { status: 200 });
          }

          if (event.type === "charge.refunded") {
            if (
              object.object !== "charge" ||
              typeof object.id !== "string" ||
              typeof object.payment_intent !== "string" ||
              object.currency !== "aed"
            ) {
              return invalid();
            }
            const total = amountAed(object.amount);
            const refunded = amountAed(object.amount_refunded);
            if (total === null || refunded === null) return invalid();
            const { data: payment, error } = await supabaseAdmin
              .from("payments")
              .select("id, order_id")
              .eq("provider", "stripe")
              .contains("metadata", { stripe_payment_intent_id: object.payment_intent })
              .maybeSingle();
            if (error) throw new Error("refund_lookup_failed");
            if (!payment) return invalid();
            await process({
              p_event_id: event.id,
              p_event_type: event.type,
              p_provider_object_id: object.id,
              p_payment_id: payment.id,
              p_order_id: payment.order_id,
              p_currency: object.currency,
              p_amount_aed: total,
              p_provider_created_at: providerCreatedAt,
              p_payment_status: null,
              p_payment_intent_id: object.payment_intent,
              p_refunded_amount_aed: refunded,
            });
            return new Response("OK", { status: 200 });
          }

          // Stripe can deliver subscribed future events. They are deliberately
          // acknowledged without becoming a state mutation surface.
          return new Response("Ignored", { status: 200 });
        } catch {
          // Return non-2xx for a verified event that could not be safely
          // persisted so Stripe's documented retry path remains available.
          return new Response("Webhook processing unavailable", { status: 500 });
        }
      },
    },
  },
});
