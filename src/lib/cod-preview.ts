// CM-COM-3A — trusted checkout preview contract.
//
// Kept free of path aliases and server-only imports so the money rules can be
// exercised directly by the test runner. Everything here derives amounts from
// TRUSTED database rows; nothing accepts a monetary value from the browser.

import { z } from "zod";

import { ALL_EMIRATE_CODES } from "./commercial-config.server.ts";

const EmirateEnum = z.enum(ALL_EMIRATE_CODES as unknown as [string, ...string[]]);

export const COD_ORDER_VARIANT_UNAVAILABLE = "COD_ORDER_VARIANT_UNAVAILABLE";

export const PreviewInput = z
  .object({
    // Identities and quantities only. There is deliberately no field capable of
    // carrying a price, subtotal, shipping, tax or total from the browser.
    items: z
      .array(
        z.object({ variant_id: z.string().uuid(), qty: z.number().int().min(1).max(500) }).strict(),
      )
      .min(1)
      .max(50),
    emirate: EmirateEnum,
    // Strict: an input carrying a price, subtotal or total is rejected outright
    // rather than silently ignored, so the browser cannot even attempt to send
    // money to the preview.
  })
  .strict();

export type TrustedVariantRow = {
  id: string;
  format_label: string | null;
  price_aed: number | string;
  is_active: boolean;
  product: { status: string; translations: Array<{ lang: string; name: string }> } | null;
};

export type CodPreviewLine = {
  variant_id: string;
  product_name: string;
  variant_label: string | null;
  qty: number;
  unit_price_aed: number;
  line_total_aed: number;
};

/**
 * Build the preview lines from TRUSTED variant rows. Every amount is derived
 * from the database price; the requested items contribute identity and
 * quantity only. A missing, inactive or non-active-product variant is refused
 * rather than silently priced or skipped.
 */
export function buildPreviewLines(
  requested: Array<{ variant_id: string; qty: number }>,
  rows: Map<string, TrustedVariantRow>,
): CodPreviewLine[] {
  return requested.map((item) => {
    const row = rows.get(item.variant_id);
    if (!row || !row.is_active || row.product?.status !== "active") {
      throw new Error(COD_ORDER_VARIANT_UNAVAILABLE);
    }
    const unitPrice = Math.round(Number(row.price_aed) * 100) / 100;
    const translations = row.product?.translations ?? [];
    const name =
      translations.find((translation) => translation.lang === "en")?.name ??
      translations[0]?.name ??
      "";
    return {
      variant_id: item.variant_id,
      product_name: name,
      variant_label: row.format_label,
      qty: item.qty,
      unit_price_aed: unitPrice,
      line_total_aed: Math.round(unitPrice * item.qty * 100) / 100,
    };
  });
}

export function previewSubtotal(lines: CodPreviewLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.line_total_aed, 0) * 100) / 100;
}
