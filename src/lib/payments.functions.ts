import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createStripeClient,
  PaymentProviderUnavailableError,
} from "@/lib/stripe-checkout-provider.server";
import { reconcilePaymentState } from "@/lib/payment-state";
import { assertCheckoutExecutionEnabled } from "@/lib/checkout-execution.server";

type StripeAttempt = {
  payment_id: string;
  order_id: string;
  order_number: string;
  amount_aed: number | string;
  provider_reference: string;
};

type PaymentRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const database = supabaseAdmin as unknown as PaymentRpcClient;

function paymentMetadata(value: unknown): { refunded_amount_aed?: number; attempt_state?: string } {
  return value && typeof value === "object"
    ? (value as { refunded_amount_aed?: number; attempt_state?: string })
    : {};
}

function unavailable() {
  return new PaymentProviderUnavailableError();
}

export const createStripeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertCheckoutExecutionEnabled();
    // Verify ownership before invoking a service-role-only payment RPC.
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, payment_method, status, payment_status, total_aed")
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .single();
    if (orderError || !order) throw new Error("ORDER_NOT_FOUND");
    if (order.payment_method !== "card" || order.status !== "pending") {
      throw new Error("ORDER_NOT_PAYABLE");
    }

    let provider;
    try {
      provider = await createStripeClient();
    } catch {
      throw unavailable();
    }

    let attempt: StripeAttempt;
    try {
      const { data: result, error } = await database.rpc("cm_pay_create_stripe_attempt_v1", {
        p_order_id: order.id,
      });
      if (error || !result) throw new Error("attempt_failed");
      attempt = result as StripeAttempt;
    } catch {
      throw unavailable();
    }

    try {
      let session;
      if (attempt.provider_reference.startsWith("cs_")) {
        // A retry after a response loss resumes the same Checkout Session; it
        // never creates a second chargeable attempt for the same local UUID.
        session = await provider.stripe.checkout.sessions.retrieve(attempt.provider_reference);
      } else {
        const amount = Number(attempt.amount_aed);
        if (!Number.isFinite(amount) || amount < 0) throw unavailable();
        session = await provider.stripe.checkout.sessions.create(
          {
            mode: "payment",
            currency: "aed",
            line_items: [
              {
                price_data: {
                  currency: "aed",
                  product_data: { name: `Corner Mex order #${attempt.order_number}` },
                  unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
              },
            ],
            success_url: `${provider.applicationUrl}/order-confirmed?order=${attempt.order_id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${provider.applicationUrl}/checkout`,
            metadata: {
              order_id: attempt.order_id,
              payment_attempt_id: attempt.payment_id,
              order_number: attempt.order_number,
            },
            // Refund events are correlated by this trusted ID, never by data
            // supplied from a browser redirect.
            payment_intent_data: {
              metadata: {
                order_id: attempt.order_id,
                payment_attempt_id: attempt.payment_id,
              },
            },
          },
          { idempotencyKey: `cm-pay-stripe-attempt-${attempt.payment_id}` },
        );
        if (!session.id || !session.url) throw unavailable();
        const { error: bindError } = await database.rpc("cm_pay_bind_stripe_checkout_session_v1", {
          p_payment_id: attempt.payment_id,
          p_session_id: session.id,
          p_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
        if (bindError) throw new Error("binding_failed");
      }
      if (!session.url) throw unavailable();
      return { url: session.url };
    } catch (error) {
      // A network/provider error is ambiguous. Keep this attempt resumable so
      // the next call uses the SAME Stripe idempotency key rather than opening
      // a second possibly chargeable Checkout Session.
      await database.rpc("cm_pay_note_stripe_attempt_degraded_v1", {
        p_payment_id: attempt.payment_id,
      });
      if (error instanceof PaymentProviderUnavailableError) throw error;
      throw unavailable();
    }
  });

export const getOrderPaymentConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, payment_status, total_aed")
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .single();
    if (error || !order) throw new Error("ORDER_NOT_FOUND");
    // Read-only by design. A success URL is useful customer feedback only and
    // is categorically incapable of completing a payment or fulfillment.
    return order;
  });

// Compatibility surface retained for the existing COD-only confirmation route.
// It is read-only and cannot be used as payment proof.
export const getOrderForConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertCheckoutExecutionEnabled();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, total_aed, subtotal_aed, shipping_aed, tax_aed, shipping_address, created_at",
      )
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .single();
    if (error || !order) throw new Error("ORDER_NOT_FOUND");
    return order;
  });

// BNPL is deliberately not executable in this Stripe foundation. Keeping the
// boundary avoids reintroducing the historical browser/server "simulated paid"
// shortcut while callers receive a safe provider-unavailable result.
export const confirmBnplPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; provider: "tabby" | "tamara" }) =>
    z.object({ orderId: z.string().uuid(), provider: z.enum(["tabby", "tamara"]) }).parse(input),
  )
  .handler(async () => {
    assertCheckoutExecutionEnabled();
    throw unavailable();
  });

export const getAdminPaymentReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("FORBIDDEN");

    const [{ data: order, error: orderError }, { data: payments, error: paymentError }] =
      await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("id, payment_status, total_aed")
          .eq("id", data.orderId)
          .single(),
        supabaseAdmin
          .from("payments")
          .select(
            "id, provider, provider_reference, status, amount_aed, metadata, created_at, updated_at",
          )
          .eq("order_id", data.orderId)
          .order("created_at", { ascending: false }),
      ]);
    if (orderError || paymentError || !order) throw new Error("PAYMENT_RECONCILIATION_UNAVAILABLE");

    const attempts = (payments ?? []).map((payment) => {
      const metadata = paymentMetadata(payment.metadata);
      return {
        id: payment.id,
        provider: payment.provider,
        providerReference: payment.provider_reference,
        status: payment.status,
        amountAed: Number(payment.amount_aed),
        refundedAmountAed: Number(metadata.refunded_amount_aed ?? 0),
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      };
    });
    return {
      attempts,
      issues: reconcilePaymentState({
        orderPaymentStatus: order.payment_status,
        orderTotalAed: Number(order.total_aed),
        paymentMethod: order.payment_method,
        attempts,
      }),
    };
  });
