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
import { optionalSupabaseAuth } from "@/integrations/supabase/optional-auth-middleware";
import { buildPreviewLines, previewSubtotal, type TrustedVariantRow } from "@/lib/cod-preview";
import {
  computeMxTotals,
  evaluateMxCheckout,
  getPublicMxCheckoutConfig,
} from "@/lib/mx-checkout-config.server";
import { MX_STATES, MxAddress, toAddressSnapshot } from "@/lib/mx-address";
import { manualQuotes, quoteAddressOf } from "@/lib/shipping/fulfillment";
import { estimateParcels } from "@/lib/shipping/parcel";
import { rankQuotes, shopRates, type ProviderFailure } from "@/lib/shipping/quote-engine";
import { signQuote, verifyQuoteToken } from "@/lib/shipping/quote-token.server";
import type { FulfillmentMode, NormalizedQuote } from "@/lib/shipping/types";

export const MX_CHECKOUT_DISABLED = "MX_CHECKOUT_DISABLED";
export const MX_ORDER_VARIANT_UNAVAILABLE = "MX_ORDER_VARIANT_UNAVAILABLE";

const Items = z
  .array(z.object({ variant_id: z.string().uuid(), qty: z.number().int().min(1).max(500) }).strict())
  .min(1)
  .max(50);

// Enough of the address to price a shipment. Strict, so a request carrying a
// price or a total is rejected rather than ignored.
const QuoteDestination = z
  .object({
    postal_code: z.string().regex(/^\d{5}$/),
    state: z.enum(Object.keys(MX_STATES) as [keyof typeof MX_STATES, ...(keyof typeof MX_STATES)[]]),
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
      options: quotes.map((quote) => toOption(quote, signQuote(quote, binding, config.quoteSecret))),
      taxRate: config.addedTaxRate,
      parcelDataComplete: parcel.complete,
    };
  });

const LegalAcceptance = z.object({ terms: z.boolean(), privacy: z.boolean(), returns: z.boolean() });

export const PlaceMxOrderInput = z.object({
  // Idempotency key for this checkout attempt; the database fingerprints the
  // request against it, so a retry or a second tab replays the original order.
  operationId: z.string().uuid(),
  // Guest checkout only; ignored when a session is supplied.
  guest: z.object({ email: z.string().trim().toLowerCase().email().max(320) }).optional(),
  items: Items,
  address: MxAddress,
  /** The signed option returned by quoteMxShipping. */
  shipping_token: z.string().min(20).max(4000),
  payment_method: z.enum(["cod"]),
  legal_acceptance: LegalAcceptance,
});

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
  /** One-time guest tracking token; null for authenticated orders and replays. */
  guest_token: string | null;
};

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

    // 2. Only an enabled method may execute, whatever the client claims.
    if (!config.paymentMethods.includes(data.payment_method)) {
      throw new Error("MX_ORDER_PAYMENT_METHOD_UNAVAILABLE");
    }

    // 3. The shipping amount is taken from the signed option, bound to this
    //    destination and this cart. Nothing the browser sends can change it.
    const verified = verifyQuoteToken(
      data.shipping_token,
      { postalCode: data.address.postal_code, items: data.items },
      config.quoteSecret,
    );
    if (!verified.ok) throw new Error(verified.reason);
    const quote = verified.quote;
    if (quote.currency !== ACTIVE_MARKET.currency) throw new Error("SHIPPING_QUOTE_INVALID");

    // 4. Terms, privacy and returns must all be accepted before execution.
    const { terms, privacy, returns } = data.legal_acceptance;
    if (!terms || !privacy || !returns) throw new Error("MX_ORDER_LEGAL_ACCEPTANCE_REQUIRED");

    // 5. Exactly one identity, mirroring orders_identity_check in the database.
    const buyerId = (context as unknown as { userId: string | null }).userId ?? null;
    const guestEmail = buyerId ? null : (data.guest?.email ?? null);
    if (!buyerId && !guestEmail) throw new Error("MX_ORDER_IDENTITY_REQUIRED");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 6. The canonical transaction validates, prices, inserts and decrements
    //    stock atomically. No label is bought here: label purchase happens after
    //    the order exists and its payment rule is satisfied.
    const { data: result, error } = await supabaseAdmin.rpc(
      "cm_create_cod_order_v2" as never,
      {
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
        p_shipping_aed: quote.price,
        p_tax_rate: config.addedTaxRate,
        p_legal_acceptance: {
          accepted_at: new Date().toISOString(),
          terms: { accepted: terms, reference: "/terms" },
          privacy: { accepted: privacy, reference: "/privacy" },
          returns: { accepted: returns, reference: "/returns" },
        },
      } as never,
    );

    if (error) {
      // Surface the stable contract code without leaking database internals.
      const code =
        /COD_ORDER_[A-Z_]+|COD_(?:ITEMS|QTY)_INVALID|CHECKOUT_[A-Z_]+|LEGAL_ACCEPTANCE_REQUIRED/.exec(
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
    const totals = computeMxTotals(
      Number(payload.subtotal_aed),
      Number(payload.shipping_aed),
      0,
    );
    return {
      ok: true,
      order_id: payload.order_id,
      order_number: payload.order_number,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: Number(payload.tax_aed),
      total: Number(payload.total_aed),
      currency: ACTIVE_MARKET.currency,
      replayed: Boolean(payload.replayed),
      guest_token: payload.guest_token ?? null,
    };
  });
