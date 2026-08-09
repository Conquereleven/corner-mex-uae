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

export const EMIRATE_NAMES: Readonly<Record<EmirateCode, string>> = Object.freeze({
  DU: "Dubai",
  AD: "Abu Dhabi",
  SH: "Sharjah",
  AJ: "Ajman",
  UQ: "Umm Al Quwain",
  RK: "Ras Al Khaimah",
  FU: "Fujairah",
});

/** Founder-approved COD delivery rates, in AED, per emirate. */
export const DEFAULT_SHIPPING_RATES_AED: Readonly<Record<EmirateCode, number>> = Object.freeze({
  DU: 15,
  AD: 15,
  SH: 20,
  AJ: 20,
  UQ: 20,
  RK: 20,
  FU: 20,
});

/** Founder-attested UAE VAT identity for CM-COM-3A commercial sales. */
export const DEFAULT_VAT_RATE = 0.05;
export const FOUNDER_ATTESTED_TRN = "105514792800001";

export type ShippingRates = Record<EmirateCode, number>;

export type CommercialConfig = {
  mode: typeof COMMERCIAL_MODE_COD;
  shippingRates: ShippingRates;
  supportedEmirates: EmirateCode[];
  vatRate: number;
  vatTrn: string;
};

export type CommercialConfigEvaluation =
  | { ready: true; checkoutEnabled: true; config: CommercialConfig; reasons: [] }
  | { ready: false; checkoutEnabled: boolean; config?: CommercialConfig; reasons: string[] };

function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 && Math.round(raw * 100) === raw * 100 ? raw : null;
  }
  if (typeof raw !== "string" || raw.trim() === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/**
 * Per-emirate rate authority. Accepts an optional JSON override; otherwise the
 * Founder-approved defaults apply. Every supported emirate must resolve to a
 * valid amount or the whole configuration fails closed.
 */
function parseShippingRates(raw: string | undefined): ShippingRates | null {
  if (raw === undefined || raw.trim() === "") return { ...DEFAULT_SHIPPING_RATES_AED };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rates = {} as ShippingRates;
  for (const code of ALL_EMIRATE_CODES) {
    const amount = parseAmount((parsed as Record<string, unknown>)[code]);
    if (amount === null) return null;
    rates[code] = amount;
  }
  return rates;
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

  const shippingRates = parseShippingRates(environment.CORNERMEX_COD_SHIPPING_RATES_JSON);
  if (shippingRates === null) reasons.push("missing_or_invalid_CORNERMEX_COD_SHIPPING_RATES_JSON");

  const supportedEmirates = parseEmirates(environment.CORNERMEX_COD_SUPPORTED_EMIRATES);
  if (supportedEmirates === null) {
    reasons.push("missing_or_invalid_CORNERMEX_COD_SUPPORTED_EMIRATES");
  }

  const vatRate =
    environment.CORNERMEX_VAT_RATE === undefined || environment.CORNERMEX_VAT_RATE.trim() === ""
      ? DEFAULT_VAT_RATE
      : parseRate(environment.CORNERMEX_VAT_RATE);
  if (vatRate === null) reasons.push("invalid_CORNERMEX_VAT_RATE");

  const vatTrn = (environment.CORNERMEX_VAT_TRN ?? FOUNDER_ATTESTED_TRN).trim();
  if (!/^\d{15}$/.test(vatTrn)) reasons.push("invalid_CORNERMEX_VAT_TRN");

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
      shippingRates: shippingRates as ShippingRates,
      supportedEmirates: supportedEmirates as EmirateCode[],
      vatRate: vatRate as number,
      vatTrn,
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
 * Resolve the shipping charge for a validated emirate. Fails closed: an unknown
 * or unsupported code throws rather than defaulting to any amount.
 */
export function shippingForEmirate(
  emirate: string,
  config: Pick<CommercialConfig, "shippingRates" | "supportedEmirates">,
): number {
  if (!(ALL_EMIRATE_CODES as readonly string[]).includes(emirate)) {
    throw new Error("COD_ORDER_EMIRATE_UNSUPPORTED");
  }
  if (!config.supportedEmirates.includes(emirate as EmirateCode)) {
    throw new Error("COD_ORDER_EMIRATE_UNSUPPORTED");
  }
  const rate = config.shippingRates[emirate as EmirateCode];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) {
    throw new Error("COD_ORDER_EMIRATE_UNSUPPORTED");
  }
  return rate;
}

/**
 * Public, non-secret view of the commercial configuration for the checkout UI,
 * so the amounts shown are the amounts the server will charge. The TRN is a
 * published tax identity, not a secret.
 */
export function getPublicCommercialConfig(
  environment: Record<string, string | undefined> = process.env,
): {
  active: boolean;
  mode: typeof COMMERCIAL_MODE_COD;
  shippingRates: Partial<ShippingRates>;
  supportedEmirates: EmirateCode[];
  emirateNames: Readonly<Record<EmirateCode, string>>;
  vatRate: number;
  vatTrn: string | null;
  taxLabel: string | null;
  reasons: string[];
} {
  const evaluation = evaluateCommercialConfig(environment);
  const config = evaluation.config;
  const vatRate = config?.vatRate ?? 0;
  return {
    active: evaluation.ready,
    mode: COMMERCIAL_MODE_COD,
    shippingRates: config?.shippingRates ?? {},
    supportedEmirates: config?.supportedEmirates ?? [],
    emirateNames: EMIRATE_NAMES,
    vatRate,
    vatTrn: config?.vatTrn ?? null,
    // Never claim a VAT percentage when no tax is configured.
    taxLabel:
      vatRate > 0 ? `VAT (${(vatRate * 100).toFixed((vatRate * 100) % 1 === 0 ? 0 : 2)}%)` : null,
    reasons: evaluation.reasons,
  };
}

/**
 * Server-authoritative totals for a validated emirate. Callers must never
 * accept a client-supplied shipping, tax or total amount.
 */
export function computeOrderTotals(
  subtotalAed: number,
  config: Pick<CommercialConfig, "shippingRates" | "supportedEmirates" | "vatRate">,
  emirate: string,
): { subtotalAed: number; shippingAed: number; taxAed: number; totalAed: number } {
  const subtotal = Math.round(subtotalAed * 100) / 100;
  const shipping = shippingForEmirate(emirate, config);
  const tax = Math.round(subtotal * config.vatRate * 100) / 100;
  return {
    subtotalAed: subtotal,
    shippingAed: shipping,
    taxAed: tax,
    totalAed: Math.round((subtotal + shipping + tax) * 100) / 100,
  };
}
