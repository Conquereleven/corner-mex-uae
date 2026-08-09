// CM-COM-3A — single-merchant COD order execution.
//
// A deliberately clean path that matches the verified A2 canonical schema. It
// does not touch sellers, commissions, coupons, loyalty, shipping zones or any
// payment provider, because production has none of those.
//
// Trust boundary: the client sends only variant ids, quantities and the
// delivery address. Prices, subtotal, shipping, tax and the total are computed
// server-side; any amount supplied by the client is ignored.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeOrderTotals,
  evaluateCommercialConfig,
  getPublicCommercialConfig,
} from "@/lib/commercial-config.server";
import { ALL_EMIRATE_CODES } from "@/lib/commercial-config.server";

export const COD_ORDER_DISABLED = "COD_ORDER_EXECUTION_DISABLED";
export const COD_ORDER_METHOD_INVALID = "COD_ORDER_PAYMENT_METHOD_INVALID";
export const COD_ORDER_EMIRATE_UNSUPPORTED = "COD_ORDER_EMIRATE_UNSUPPORTED";

const EmirateEnum = z.enum(ALL_EMIRATE_CODES as unknown as [string, ...string[]]);

const DeliveryAddress = z.object({
  recipient_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  emirate: EmirateEnum,
  area: z.string().trim().min(2).max(160),
  street: z.string().trim().max(160).optional().nullable(),
  building: z.string().trim().max(160).optional().nullable(),
  floor_apartment: z.string().trim().max(160).optional().nullable(),
  landmark: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const LegalAcceptance = z.object({
  terms: z.boolean(),
  privacy: z.boolean(),
  returns: z.boolean(),
});

// Only variant ids and quantities are accepted. There is intentionally no
// price, subtotal, shipping or total field: the client cannot influence money.
export const PlaceCodOrderInput = z.object({
  items: z
    .array(z.object({ variant_id: z.string().uuid(), qty: z.number().int().min(1).max(500) }))
    .min(1)
    .max(50),
  address: DeliveryAddress,
  payment_method: z.literal("cod"),
  legal_acceptance: LegalAcceptance,
});

export type PlaceCodOrderResult = {
  ok: true;
  order_id: string;
  order_number: string;
  subtotal_aed: number;
  shipping_aed: number;
  tax_aed: number;
  total_aed: number;
};

/**
 * Public, non-secret commercial configuration for the checkout UI so the
 * displayed amounts match what the server will charge.
 */
export const getCommercialCheckoutConfig = createServerFn({ method: "GET" }).handler(async () =>
  getPublicCommercialConfig(),
);

export const placeCodOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof PlaceCodOrderInput>) => PlaceCodOrderInput.parse(input))
  .handler(async ({ data, context }): Promise<PlaceCodOrderResult> => {
    // 1. Execution gate + complete commercial configuration, or refuse.
    const evaluation = evaluateCommercialConfig();
    if (!evaluation.ready || !evaluation.config) {
      throw new Error(`${COD_ORDER_DISABLED}: ${evaluation.reasons.join(",")}`);
    }
    const config = evaluation.config;

    // 2. COD is the only executable method in CM-COM-3A, even if a client
    //    forges another value (the schema also rejects it).
    if (data.payment_method !== "cod") {
      throw new Error(COD_ORDER_METHOD_INVALID);
    }

    // 3. Delivery must be inside a configured emirate.
    if (!config.supportedEmirates.includes(data.address.emirate as never)) {
      throw new Error(COD_ORDER_EMIRATE_UNSUPPORTED);
    }

    // 4. Terms, privacy and returns must all be accepted before execution.
    const { terms, privacy, returns } = data.legal_acceptance;
    if (!terms || !privacy || !returns) {
      throw new Error("COD_ORDER_LEGAL_ACCEPTANCE_REQUIRED");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 5. The transactional function performs validation, pricing, insertion and
    //    the stock decrement atomically. Prices come from the database only.
    const { data: result, error } = await supabaseAdmin.rpc(
      "place_cod_order_v1" as never,
      {
        p_buyer_id: context.userId,
        p_items: data.items,
        p_shipping_address: {
          recipient_name: data.address.recipient_name,
          phone: data.address.phone,
          emirate: data.address.emirate,
          area: data.address.area,
          street: data.address.street ?? null,
          building: data.address.building ?? null,
          floor_apartment: data.address.floor_apartment ?? null,
          landmark: data.address.landmark ?? null,
          notes: data.address.notes ?? null,
        },
        p_shipping_aed: config.shippingAed,
        p_tax_rate: config.vatRate,
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
      const code = /COD_ORDER_[A-Z_]+/.exec(error.message)?.[0] ?? "COD_ORDER_FAILED";
      throw new Error(code);
    }

    const payload = result as unknown as {
      order_id: string;
      order_number: string;
      subtotal_aed: number;
      shipping_aed: number;
      tax_aed: number;
      total_aed: number;
    };

    return {
      ok: true,
      order_id: payload.order_id,
      order_number: payload.order_number,
      subtotal_aed: Number(payload.subtotal_aed),
      shipping_aed: Number(payload.shipping_aed),
      tax_aed: Number(payload.tax_aed),
      total_aed: Number(payload.total_aed),
    };
  });

/** Preview totals for the checkout summary, using the same server authority. */
export const previewCodOrderTotals = createServerFn({ method: "GET" })
  .inputValidator((input: { subtotal_aed: number }) =>
    z.object({ subtotal_aed: z.number().min(0).max(1_000_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const evaluation = evaluateCommercialConfig();
    if (!evaluation.ready || !evaluation.config) {
      return { available: false as const, reasons: evaluation.reasons };
    }
    return {
      available: true as const,
      ...computeOrderTotals(data.subtotal_aed, evaluation.config),
    };
  });
