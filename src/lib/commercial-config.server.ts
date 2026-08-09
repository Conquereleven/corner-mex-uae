// CM-COM-3A — server-authoritative commercial configuration for the COD MVP.
//
// Everything a customer is charged is derived here, on the server, from
// environment configuration. The client never supplies shipping, tax or price.
//
// Fail-closed by construction: if commercial execution is switched on but any
// required value is missing or invalid, `evaluateCommercialConfig` reports
// `ready: false` with reasons, and the order path must refuse to execute.
//
// No rate, emirate list or tax rate is invented here. The defaults keep the
// system inert (no shipping configured, tax 0) until real values are supplied
// under the activation gate.

import { isCheckoutExecutionEnabled } from "./checkout-execution.server.ts";
import type { EmirateCode } from "./payment-methods.ts";

export const COMMERCIAL_MODE_COD = "cod" as const;

export const ALL_EMIRATE_CODES: readonly EmirateCode[] = ["DU", "AD", "SH", "AJ", "UQ", "RK", "FU"];

export type CommercialConfig = {
  mode: typeof COMMERCIAL_MODE_COD;
  shippingAed: number;
  supportedEmirates: EmirateCode[];
  vatRate: number;
};

export type CommercialConfigEvaluation =
  | { ready: true; checkoutEnabled: true; config: CommercialConfig; reasons: [] }
  | { ready: false; checkoutEnabled: boolean; config?: CommercialConfig; reasons: string[] };

function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

function parseRate(raw: string | undefined): number | null {
  // Absent tax configuration means zero tax, never an assumed rate.
  if (raw === undefined || raw.trim() === "") return 0;
  if (!/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

function parseEmirates(raw: string | undefined): EmirateCode[] | null {
  if (raw === undefined || raw.trim() === "") return null;
  const codes = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  if (codes.length === 0) return null;
  if (new Set(codes).size !== codes.length) return null;
  if (!codes.every((code) => (ALL_EMIRATE_CODES as readonly string[]).includes(code))) return null;
  return codes as EmirateCode[];
}

/**
 * Evaluate the commercial configuration.
 *
 * `ready` is true only when checkout execution is enabled AND every required
 * value is present and valid. Callers must treat `ready: false` as "do not
 * execute".
 */
export function evaluateCommercialConfig(
  environment: Record<string, string | undefined> = process.env,
): CommercialConfigEvaluation {
  const checkoutEnabled = isCheckoutExecutionEnabled(environment.CORNERMEX_CHECKOUT_ENABLED);
  const reasons: string[] = [];

  const mode = (environment.CORNERMEX_COMMERCE_ACTIVE_MODE ?? COMMERCIAL_MODE_COD).trim();
  if (mode !== COMMERCIAL_MODE_COD) reasons.push("commerce_mode_must_be_cod");

  const shippingAed = parseAmount(environment.CORNERMEX_COD_SHIPPING_AED);
  if (shippingAed === null) reasons.push("missing_or_invalid_CORNERMEX_COD_SHIPPING_AED");

  const supportedEmirates = parseEmirates(environment.CORNERMEX_COD_SUPPORTED_EMIRATES);
  if (supportedEmirates === null) {
    reasons.push("missing_or_invalid_CORNERMEX_COD_SUPPORTED_EMIRATES");
  }

  const vatRate = parseRate(environment.CORNERMEX_VAT_RATE);
  if (vatRate === null) reasons.push("invalid_CORNERMEX_VAT_RATE");

  if (!checkoutEnabled) reasons.push("checkout_execution_disabled");

  if (reasons.length > 0) {
    return { ready: false, checkoutEnabled, reasons };
  }

  return {
    ready: true,
    checkoutEnabled: true,
    reasons: [],
    config: {
      mode: COMMERCIAL_MODE_COD,
      shippingAed: shippingAed as number,
      supportedEmirates: supportedEmirates as EmirateCode[],
      vatRate: vatRate as number,
    },
  };
}

/** True only when a real COD order may be executed right now. */
export function isCommercialActive(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return evaluateCommercialConfig(environment).ready;
}

/**
 * Public, non-secret view of the commercial configuration for the checkout UI,
 * so the amount shown is the amount the server will charge.
 */
export function getPublicCommercialConfig(
  environment: Record<string, string | undefined> = process.env,
): {
  active: boolean;
  mode: typeof COMMERCIAL_MODE_COD;
  shippingAed: number | null;
  supportedEmirates: EmirateCode[];
  vatRate: number;
  taxLabel: string | null;
} {
  const evaluation = evaluateCommercialConfig(environment);
  const config = evaluation.config;
  const vatRate = config?.vatRate ?? 0;
  return {
    active: evaluation.ready,
    mode: COMMERCIAL_MODE_COD,
    shippingAed: config?.shippingAed ?? null,
    supportedEmirates: config?.supportedEmirates ?? [],
    vatRate,
    // Never claim a VAT percentage when no tax is configured.
    taxLabel:
      vatRate > 0 ? `VAT (${(vatRate * 100).toFixed((vatRate * 100) % 1 === 0 ? 0 : 2)}%)` : null,
  };
}

/** Server-authoritative totals. Callers must not accept client amounts. */
export function computeOrderTotals(
  subtotalAed: number,
  config: Pick<CommercialConfig, "shippingAed" | "vatRate">,
): { subtotalAed: number; shippingAed: number; taxAed: number; totalAed: number } {
  const subtotal = Math.round(subtotalAed * 100) / 100;
  const shipping = Math.round(config.shippingAed * 100) / 100;
  const tax = Math.round(subtotal * config.vatRate * 100) / 100;
  return {
    subtotalAed: subtotal,
    shippingAed: shipping,
    taxAed: tax,
    totalAed: Math.round((subtotal + shipping + tax) * 100) / 100,
  };
}
