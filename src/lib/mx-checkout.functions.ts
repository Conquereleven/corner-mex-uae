// Mexico checkout — server functions.
//
//   customer + Mexico address → shipping options → selection → payment → order
//
// This path reuses the canonical order transaction unchanged
// (cm_create_cod_order_v2): one order engine, one inventory truth, the same
// idempotency, guest identity and stock rules that PR #81 established. What is
// new is everything around it — the address model, where the shipping amount
// comes from, and which payment methods exist.
//
// Trust boundary: the browser sends variant ids, quantities, an address and an
// opaque shipping token. It never sends a price, a shipping amount, a tax or a
// total. Item prices come from the database; the shipping amount comes from a
// token this server signed.
//
// The canonical money columns are named `*_aed` for historical reasons. In a
// Mexico database they hold MXN: the column name is not a currency statement
// (docs/cornermex-mx/MARKET-CONFIG.md, "Stored amounts").

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ACTIVE_MARKET } from "@/config/market";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionalSupabaseAuth } from "@/integrations/supabase/optional-auth-middleware";
import { buildPreviewLines, previewSubtotal, type TrustedVariantRow } from "@/lib/cod-preview";
import { clipWebhookToken } from "@/lib/payments/clip";
import { PaymentError, type NormalizedPayment } from "@/lib/payments/types";
import {
  computeMxTotals,
  evaluateMxCheckout,
  getPublicMxCheckoutConfig,
  paymentAllowedFor,
} from "@/lib/mx-checkout-config.server";
import {
  assertMexicoDatabase,
  reconcileOrderPayment,
  type RpcClient,
} from "@/lib/mx-payments.server";
import { paymentProviderById } from "@/lib/payments/providers";
import { siteUrl } from "@/lib/site-url";
import { MX_STATES, MxAddress, toAddressSnapshot } from "@/lib/mx-address";
import { manualQuotes, quoteAddressOf } from "@/lib/shipping/fulfillment";
import { estimateParcels } from "@/lib/shipping/parcel";
import { rankQuotes, shopRates, type ProviderFailure } from "@/lib/shipping/quote-engine";
import { signQuote, verifyQuoteToken } from "@/lib/shipping/quote-token.server";
import type { FulfillmentMode, NormalizedQuote } from "@/lib/shipping/types";

export const MX_CHECKOUT_DISABLED = "MX_CHECKOUT_DISABLED";
export const MX_ORDER_VARIANT_UNAVAILABLE = "MX_ORDER_VARIANT_UNAVAILABLE";

const Items = z
  .array(
    z.object({ variant_id: z.string().uuid(), qty: z.number().int().min(1).max(500) }).strict(),
  )
  .min(1)
  .max(50);

// Enough of the address to price a shipment. Strict, so a request carrying a
// price or a total is rejected rather than ignored.
const QuoteDestination = z
  .object({
    postal_code: z.string().regex(/^\d{5}$/),
    state: z.enum(
      Object.keys(MX_STATES) as [keyof typeof MX_STATES, ...(keyof typeof MX_STATES)[]],
    ),
    municipality: z.string().trim().min(2).max(120),
    colonia: z.string().trim().min(2).max(120),
  })
  .strict();

const QuoteInput = z.object({ items: Items, destination: QuoteDestination }).strict();

/** What the browser is shown for one shipping option. */
export type MxShippingOption = {
  /** Opaque, signed. Sent back unchanged when the order is placed. */
  token: string;
  carrierName: string;
  service: string;
  price: number;
  deliveryEstimate: string | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  fulfillmentMode: FulfillmentMode;
};

export type MxQuoteResult =
  | { available: false; reasons: string[] }
  | {
      available: true;
      lines: ReturnType<typeof buildPreviewLines>;
      subtotal: number;
      options: MxShippingOption[];
      taxRate: number;
      /** False when the parcel was estimated from incomplete SKU data. */
      parcelDataComplete: boolean;
    };

type VariantRow = TrustedVariantRow & { sku: string | null; weight_grams: number | null };

async function loadVariants(ids: string[]): Promise<Map<string, VariantRow> | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Prices are only ever read from a database that says it is Mexico / MXN.
  await assertMexicoDatabase(supabaseAdmin as unknown as RpcClient);
  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .select(
      `id, sku, weight_grams, format_label, price_aed, is_active,
       product:products!inner(status, translations:product_translations(lang, name))`,
    )
    .in("id", ids);
  if (error) return null;
  return new Map((data ?? []).map((row) => [row.id as string, row as unknown as VariantRow]));
}

function toOption(quote: NormalizedQuote, token: string): MxShippingOption {
  return {
    token,
    carrierName: quote.carrierName,
    service: quote.service,
    price: quote.price,
    deliveryEstimate: quote.deliveryEstimate,
    estimatedDaysMin: quote.estimatedDaysMin,
    estimatedDaysMax: quote.estimatedDaysMax,
    fulfillmentMode: quote.fulfillmentMode,
  };
}

/** Public, non-secret configuration for the checkout UI. */
export const getMxCheckoutConfig = createServerFn({ method: "GET" }).handler(async () =>
  getPublicMxCheckoutConfig(),
);

/**
 * Prices the cart from the database and returns signed shipping options for the
 * destination. Carrier providers and manual rules are quoted together and
 * ranked as one list.
 */
export const quoteMxShipping = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof QuoteInput>) => QuoteInput.parse(input))
  .handler(async ({ data }): Promise<MxQuoteResult> => {
    const evaluation = evaluateMxCheckout();
    if (!evaluation.ready) return { available: false, reasons: evaluation.reasons };
    const config = evaluation.config;

    const rows = await loadVariants([...new Set(data.items.map((item) => item.variant_id))]);
    if (!rows) return { available: false, reasons: ["MX_ORDER_PREVIEW_FAILED"] };

    let lines;
    try {
      lines = buildPreviewLines(data.items, rows);
    } catch {
      return { available: false, reasons: [MX_ORDER_VARIANT_UNAVAILABLE] };
    }
    const subtotal = previewSubtotal(lines);

    const parcel = estimateParcels(
      data.items.map((item) => ({
        sku: rows.get(item.variant_id)?.sku ?? null,
        qty: item.qty,
        weightGrams: rows.get(item.variant_id)?.weight_grams ?? null,
      })),
    );
    const totalWeightKg = parcel.parcels.reduce((sum, entry) => sum + entry.weightKg, 0);

    const failures: ProviderFailure[] = [];
    let carrierQuotes: NormalizedQuote[] = [];
    // An oversize order is not auto-quoted: the parcel would be wrong.
    if (config.providers.length > 0 && config.origin && !parcel.oversize) {
      const outcome = await shopRates(
        config.providers,
        {
          origin: quoteAddressOf(config.origin.address),
          destination: {
            country: "MX",
            postalCode: data.destination.postal_code,
            state: MX_STATES[data.destination.state],
            municipality: data.destination.municipality,
            colonia: data.destination.colonia,
          },
          parcels: parcel.parcels,
        },
        { policy: config.rankingPolicy, currency: ACTIVE_MARKET.currency },
      );
      carrierQuotes = outcome.quotes;
      failures.push(...outcome.failures);
    }
    if (failures.length > 0) {
      // Operational signal only: provider id and error code, never a payload.
      console.warn(
        "[mx-shipping] provider quote failures",
        failures.map((failure) => `${failure.provider}:${failure.code}`).join(","),
      );
    }

    const quotes = rankQuotes(
      [
        ...carrierQuotes,
        ...manualQuotes(config.manualRules, {
          postalCode: data.destination.postal_code,
          subtotal,
          currency: ACTIVE_MARKET.currency,
          totalWeightKg,
        }),
      ],
      config.rankingPolicy,
    );
    if (quotes.length === 0) return { available: false, reasons: ["MX_SHIPPING_UNAVAILABLE"] };

    const binding = { postalCode: data.destination.postal_code, items: data.items };
    return {
      available: true,
      lines,
      subtotal,
      options: quotes.map((quote) =>
        toOption(quote, signQuote(quote, binding, config.quoteSecret)),
      ),
      taxRate: config.addedTaxRate,
      parcelDataComplete: parcel.complete,
    };
  });

const LegalAcceptance = z.object({
  terms: z.boolean(),
  privacy: z.boolean(),
  returns: z.boolean(),
});

export const PlaceMxOrderInput = z.object({
  // Idempotency key for this checkout attempt. The database fingerprints the
  // request against it, and the same key is the payment's idempotency key, so a
  // retry or a second tab replays the original order AND the original payment.
  operationId: z.string().uuid(),
  // Guest checkout only; ignored when a session is supplied.
  guest: z.object({ email: z.string().trim().toLowerCase().email().max(320) }).optional(),
  items: Items,
  address: MxAddress,
  /** The signed option returned by quoteMxShipping. */
  shipping_token: z.string().min(20).max(4000),
  payment_method: z.enum(["mercado_pago", "clip", "cod"]),
  // A single-use token minted in the browser by Mercado Pago's own SDK. Card
  // number, expiry and security code never reach this server. Without it,
  // Mercado Pago is asked for its cash method.
  card: z
    .object({
      token: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
      payment_method_id: z.string().regex(/^[a-z0-9_]{2,24}$/),
      installments: z.number().int().min(1).max(24),
    })
    .strict()
    .optional(),
  /** Contact email for a signed-in customer's payment receipt. */
  payer_email: z.string().trim().toLowerCase().email().max(320).optional(),
  legal_acceptance: LegalAcceptance,
});

/** What the customer must do next to pay. Null for cash on delivery. */
export type MxPaymentStep =
  /** A card payment the provider has already answered. */
  | { kind: "settled"; state: string }
  | { kind: "redirect"; url: string }
  | { kind: "instructions"; url: string | null; reference: string | null }
  /** The provider did not answer. The order exists; repeating the checkout is safe. */
  | { kind: "retry" };

export type PlaceMxOrderResult = {
  ok: true;
  order_id: string;
  order_number: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  replayed: boolean;
  payment_method: "mercado_pago" | "clip" | "cod";
  payment: MxPaymentStep | null;
  /** One-time guest tracking token; null for authenticated orders and replays. */
  guest_token: string | null;
};

// Mercado Pago method offered until the card Brick is built: a cash voucher
// needs no card data, so nothing PCI-sensitive passes through the storefront.
const MERCADO_PAGO_METHOD = { kind: "offline", methodId: "oxxo", methodType: "ticket" } as const;

function paymentStep(payment: NormalizedPayment): MxPaymentStep {
  if (payment.redirectUrl) return { kind: "redirect", url: payment.redirectUrl };
  return {
    kind: "instructions",
    url: payment.instructions?.url ?? null,
    reference: payment.instructions?.reference ?? null,
  };
}

export const placeMxOrder = createServerFn({ method: "POST" })
  // Buying never requires an account: an identity is resolved when a session is
  // presented, otherwise the guest contact on the request is used.
  .middleware([optionalSupabaseAuth])
  .inputValidator((input: z.input<typeof PlaceMxOrderInput>) => PlaceMxOrderInput.parse(input))
  .handler(async ({ data, context }): Promise<PlaceMxOrderResult> => {
    // 1. Execution gate and complete configuration, or refuse.
    const evaluation = evaluateMxCheckout();
    if (!evaluation.ready) {
      throw new Error(`${MX_CHECKOUT_DISABLED}: ${evaluation.reasons.join(",")}`);
    }
    const config = evaluation.config;

    // 2. The shipping amount is taken from the signed option, bound to this
    //    destination and this cart. Nothing the browser sends can change it.
    const verified = verifyQuoteToken(
      data.shipping_token,
      { postalCode: data.address.postal_code, items: data.items },
      config.quoteSecret,
    );
    if (!verified.ok) throw new Error(verified.reason);
    const quote = verified.quote;
    if (quote.currency !== ACTIVE_MARKET.currency) throw new Error("SHIPPING_QUOTE_INVALID");

    // 3. Only an enabled method may execute, and cash on delivery only with a
    //    local delivery option — never for a parcel shipped across the country.
    const option = config.paymentOptions.find((entry) => entry.id === data.payment_method);
    if (!paymentAllowedFor(option, quote.fulfillmentMode)) {
      throw new Error("MX_ORDER_PAYMENT_METHOD_UNAVAILABLE");
    }
    const provider =
      data.payment_method === "cod"
        ? null
        : (config.paymentProviders.find((entry) => entry.id === data.payment_method) ?? null);
    if (data.payment_method !== "cod" && !provider) {
      throw new Error("MX_ORDER_PAYMENT_METHOD_UNAVAILABLE");
    }

    // 4. Terms, privacy and returns must all be accepted before execution.
    const { terms, privacy, returns } = data.legal_acceptance;
    if (!terms || !privacy || !returns) throw new Error("MX_ORDER_LEGAL_ACCEPTANCE_REQUIRED");

    // 5. Exactly one identity, mirroring orders_identity_check in the database.
    const buyerId = (context as unknown as { userId: string | null }).userId ?? null;
    const guestEmail = buyerId ? null : (data.guest?.email ?? null);
    if (!buyerId && !guestEmail) throw new Error("MX_ORDER_IDENTITY_REQUIRED");
    const payerEmail = guestEmail ?? data.payer_email ?? null;
    if (provider && !payerEmail) throw new Error("MX_ORDER_PAYER_EMAIL_REQUIRED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as RpcClient;
    await assertMexicoDatabase(db);

    // 6. The canonical transaction validates, prices, inserts and takes stock
    //    atomically, and refuses any item that is not launch-ACTIVE. No label is
    //    bought here: a label is reserved only after payment is confirmed.
    const { data: result, error } = await db.rpc("cm_mx_create_order_v1", {
      p_buyer_id: buyerId,
      p_guest_email: guestEmail,
      p_operation_id: data.operationId,
      p_items: data.items,
      p_shipping_address: {
        ...toAddressSnapshot(data.address),
        // What the customer chose and was promised, snapshotted with the order.
        shipping_option: {
          provider: quote.provider,
          carrier: quote.carrier,
          carrier_name: quote.carrierName,
          service: quote.service,
          service_code: quote.serviceCode,
          fulfillment_mode: quote.fulfillmentMode,
          price: quote.price,
          currency: quote.currency,
          estimated_days_min: quote.estimatedDaysMin,
          estimated_days_max: quote.estimatedDaysMax,
          provider_quote_id: quote.providerQuoteId,
          provider_rate_id: quote.providerRateId,
          expires_at: quote.expiresAt,
        },
      },
      p_shipping: quote.price,
      p_tax_rate: config.addedTaxRate,
      p_legal_acceptance: {
        accepted_at: new Date().toISOString(),
        terms: { accepted: terms, reference: "/terms" },
        privacy: { accepted: privacy, reference: "/privacy" },
        returns: { accepted: returns, reference: "/returns" },
      },
      p_payment_method: data.payment_method,
    });

    if (error) {
      // Surface the stable contract code without leaking database internals.
      const code =
        /MX_ORDER_[A-Z_]+|COD_ORDER_[A-Z_]+|COD_(?:ITEMS|QTY)_INVALID|CHECKOUT_[A-Z_]+|LEGAL_ACCEPTANCE_REQUIRED/.exec(
          error.message,
        )?.[0] ?? "MX_ORDER_FAILED";
      throw new Error(code);
    }

    const payload = result as unknown as {
      replayed?: boolean;
      guest_token?: string;
      order_id: string;
      order_number: string;
      subtotal_aed: number;
      shipping_aed: number;
      tax_aed: number;
      total_aed: number;
    };
    // Totals are the database's. computeMxTotals only normalises rounding.
    const totals = computeMxTotals(Number(payload.subtotal_aed), Number(payload.shipping_aed), 0);
    const base = {
      ok: true as const,
      order_id: payload.order_id,
      order_number: payload.order_number,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: Number(payload.tax_aed),
      total: Number(payload.total_aed),
      currency: ACTIVE_MARKET.currency,
      replayed: Boolean(payload.replayed),
      payment_method: data.payment_method,
      guest_token: payload.guest_token ?? null,
    };
    if (!provider) return { ...base, payment: null };

    // 7. Open the payment attempt. Its amount is read from the order row by the
    //    database; this code never passes one in.
    const { data: attemptData, error: attemptError } = await db.rpc(
      "cm_mx_start_payment_attempt_v1",
      {
        p_order_id: payload.order_id,
        p_provider: provider.id,
        p_idempotency_key: data.operationId,
      },
    );
    if (attemptError) {
      throw new Error(/MX_PAYMENT_[A-Z_]+/.exec(attemptError.message)?.[0] ?? "MX_PAYMENT_FAILED");
    }
    const attempt = attemptData as unknown as {
      attempt_id: string;
      amount: number | string;
      currency: string;
      provider_payment_id: string | null;
      redirect_url: string | null;
    };

    // 8. Ask the provider. A replay of this checkout reuses the same key, so the
    //    provider can never be asked to charge the order twice.
    const returnUrl = siteUrl(`/order-confirmed?order=${payload.order_id}`);
    const webhookSecret = process.env.CLIP_WEBHOOK_SECRET ?? "";
    let payment: NormalizedPayment;
    try {
      payment = attempt.provider_payment_id
        ? await provider.getPayment(attempt.provider_payment_id)
        : await provider.createPayment({
            orderReference: payload.order_number,
            amount: Number(attempt.amount),
            currency: attempt.currency,
            idempotencyKey: data.operationId,
            description: `Pedido ${payload.order_number} · CornerMex`,
            payer: { email: payerEmail as string, firstName: data.address.recipient_name },
            method:
              provider.id !== "mercado_pago"
                ? { kind: "redirect" }
                : data.card
                  ? {
                      kind: "card_token",
                      token: data.card.token,
                      methodId: data.card.payment_method_id,
                      installments: data.card.installments,
                    }
                  : MERCADO_PAGO_METHOD,
            returnUrls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
            ...(provider.id === "clip"
              ? {
                  webhookUrl: siteUrl(
                    `/api/public/hooks/clip?ref=${encodeURIComponent(payload.order_number)}&token=${clipWebhookToken(payload.order_number, webhookSecret)}`,
                  ),
                }
              : {}),
          });
    } catch (caught) {
      // Unknown outcome: the order and its attempt exist, and repeating this
      // exact checkout is safe. A definite rejection is reported as a failure.
      if (caught instanceof PaymentError && caught.code === "AMBIGUOUS_WRITE") {
        return { ...base, payment: { kind: "retry" } };
      }
      throw new Error("MX_PAYMENT_PROVIDER_REJECTED");
    }

    if (!attempt.provider_payment_id) {
      const { error: bindError } = await db.rpc("cm_mx_bind_payment_attempt_v1", {
        p_attempt_id: attempt.attempt_id,
        p_provider_payment_id: payment.providerPaymentId,
        p_raw_status: payment.rawStatus,
        p_raw_status_detail: payment.rawStatusDetail,
        p_redirect_url: payment.redirectUrl,
      });
      if (bindError) throw new Error("MX_PAYMENT_FAILED");
    }

    // A card payment is answered at once. It is applied the same way as any
    // other: the payment is re-read from the provider and checked against the
    // order before the database records it. A declined card cancels the order
    // and returns its stock.
    if (data.card && provider.id === "mercado_pago") {
      const outcome = await reconcileOrderPayment(db, payload.order_id, () => provider);
      const state =
        outcome.outcome === "CHANGED"
          ? outcome.change.to
          : outcome.outcome === "UNCHANGED"
            ? outcome.state
            : "PENDING";
      return { ...base, payment: { kind: "settled", state } };
    }
    return { ...base, payment: paymentStep(payment) };
  });

/**
 * Called by the confirmation page. It does not take the browser's word for
 * anything: it re-reads the order's payment from the provider and applies what
 * the provider says. Safe to call by anyone, any number of times.
 */
export const refreshMxOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data }): Promise<{ state: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const outcome = await reconcileOrderPayment(
        supabaseAdmin as unknown as RpcClient,
        data.orderId,
        (id) => paymentProviderById(id),
      );
      if (outcome.outcome === "CHANGED") return { state: outcome.change.to };
      if (outcome.outcome === "UNCHANGED") return { state: outcome.state };
      return { state: outcome.outcome };
    } catch {
      // The page falls back to whatever the order already says.
      return { state: "UNAVAILABLE" };
    }
  });

/**
 * A signed-in customer's own order, for the confirmation page. Read-only, and
 * never proof of payment: the status it returns was written by
 * refreshMxOrderPayment or a verified webhook.
 */
export const getMxOrderForConfirmation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, payment_status, payment_method, total_aed, created_at")
      .eq("id", data.orderId)
      .eq("buyer_id", context.userId)
      .single();
    if (error || !order) throw new Error("ORDER_NOT_FOUND");
    return order;
  });
