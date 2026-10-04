// Market configuration — the single place that says which country CornerMex is
// selling in and what that implies for currency, locale, addresses and tax
// presentation.
//
// Founder decision 2026-10-04 (docs/cornermex-mx/MIGRATION-AUDIT.md): CornerMex
// launches in MEXICO. The UAE implementation stays in the repository as
// history, but nothing customer-facing may read from it.
//
// Rules for the rest of the codebase:
//   * Components and server functions read ACTIVE_MARKET; they do not hardcode a
//     currency code, a locale, a country name or an address shape.
//   * A deployment serves exactly one market. ACTIVE_MARKET is a constant, not a
//     request-time switch, so there is never a per-request MX/UAE branch.
//   * Facts the Founder or the accountant has not supplied (seller entity, RFC,
//     tax treatment) are `null` here. Surfaces must render without them and must
//     never substitute an invented value.
//
// This file has no imports on purpose: it is read by the browser bundle, by
// server functions and directly by the node:test runner.

export type MarketCode = "MX" | "AE";

export type MarketStatus = "ACTIVE" | "DEFERRED";

/** Which address form and validator a market uses. */
export type AddressModel = "mx" | "ae-emirate";

/**
 * How tax relates to the catalogue price.
 *   UNDETERMINED — nobody with authority has said. No tax line is shown and no
 *                  tax is added on top of the price.
 *   INCLUDED     — the catalogue price already contains tax; it may be itemised
 *                  but is never added.
 *   ADDED        — tax is computed on top of the subtotal.
 */
export type TaxPriceModel = "UNDETERMINED" | "INCLUDED" | "ADDED";

export type MarketConfig = {
  code: MarketCode;
  status: MarketStatus;
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  /** Country name in the market's own default language. */
  countryNameLocal: string;
  /** ISO 4217. Every stored amount in this market's database is in this currency. */
  currency: string;
  /** BCP 47 locale used for number, money and date formatting. */
  locale: string;
  /** IANA timezone used for business dates (cut-offs, delivery estimates). */
  timezone: string;
  defaultLanguage: "es" | "en" | "ar";
  /** Languages offered in the storefront language switcher, default first. */
  languages: ReadonlyArray<"es" | "en" | "ar">;
  measurements: "metric" | "imperial";
  phone: {
    /** E.164 country calling code without the plus sign. */
    callingCode: string;
    /** Length of the national significant number. */
    nationalDigits: number;
  };
  address: { model: AddressModel };
  tax: {
    priceModel: TaxPriceModel;
    /** Customer-facing tax name, shown only when priceModel is not UNDETERMINED. */
    label: string | null;
  };
  /**
   * Legal identity of the seller in this market. `null` means "not supplied
   * yet" — it is a launch gate, not something to fill with a guess.
   */
  legal: {
    sellerEntity: string | null;
    taxId: string | null;
    taxIdLabel: string | null;
    fiscalAddress: string | null;
  };
};

export const MX_MARKET: MarketConfig = Object.freeze({
  code: "MX",
  status: "ACTIVE",
  country: "MX",
  countryName: "Mexico",
  countryNameLocal: "México",
  currency: "MXN",
  locale: "es-MX",
  timezone: "America/Mexico_City",
  defaultLanguage: "es",
  languages: Object.freeze(["es", "en"] as const),
  measurements: "metric",
  phone: Object.freeze({ callingCode: "52", nationalDigits: 10 }),
  address: Object.freeze({ model: "mx" }),
  // docs/cornermex-mx/MX-LAUNCH-PLAN.md "Legal / tax boundary": the tax treatment
  // and the seller's fiscal identity must come from the Founder's accountant.
  tax: Object.freeze({ priceModel: "UNDETERMINED", label: null }),
  legal: Object.freeze({
    sellerEntity: null,
    taxId: null,
    taxIdLabel: "RFC",
    fiscalAddress: null,
  }),
}) as MarketConfig;

/**
 * The UAE market as it was configured before the Mexico decision. DEFERRED: kept
 * so historical orders and the retained UAE modules stay readable. It is not
 * reachable from any active customer or admin surface.
 */
export const AE_MARKET: MarketConfig = Object.freeze({
  code: "AE",
  status: "DEFERRED",
  country: "AE",
  countryName: "United Arab Emirates",
  countryNameLocal: "United Arab Emirates",
  currency: "AED",
  locale: "en-AE",
  timezone: "Asia/Dubai",
  defaultLanguage: "en",
  languages: Object.freeze(["en", "es", "ar"] as const),
  measurements: "metric",
  phone: Object.freeze({ callingCode: "971", nationalDigits: 9 }),
  address: Object.freeze({ model: "ae-emirate" }),
  tax: Object.freeze({ priceModel: "ADDED", label: "VAT" }),
  legal: Object.freeze({
    sellerEntity: "RodMor TradeCo LLC",
    taxId: null,
    taxIdLabel: "TRN",
    fiscalAddress: null,
  }),
}) as MarketConfig;

export const MARKETS: Readonly<Record<MarketCode, MarketConfig>> = Object.freeze({
  MX: MX_MARKET,
  AE: AE_MARKET,
});

/** The market this deployment sells in. */
export const ACTIVE_MARKET: MarketConfig = MX_MARKET;

/** Format an amount held in the active market's currency, e.g. "$1,234.50". */
export function formatMoney(amount: number | string, market: MarketConfig = ACTIVE_MARKET): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * Money with an explicit ISO code, e.g. "$1,234.50 MXN". Use where the currency
 * must be unambiguous: order totals, confirmations, emails, quotes.
 */
export function formatMoneyWithCode(
  amount: number | string,
  market: MarketConfig = ACTIVE_MARKET,
): string {
  return `${formatMoney(amount, market)} ${market.currency}`;
}

/** A calendar date in the market's locale and timezone. */
export function formatDate(
  value: string | number | Date,
  market: MarketConfig = ACTIVE_MARKET,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(market.locale, { timeZone: market.timezone, ...options }).format(
    new Date(value),
  );
}

/**
 * The tax line label for a rate, or null when no tax line may be shown. A market
 * whose tax model is UNDETERMINED never produces a label, so the storefront
 * cannot state a tax position nobody has confirmed.
 */
export function taxLineLabel(rate: number, market: MarketConfig = ACTIVE_MARKET): string | null {
  if (market.tax.priceModel === "UNDETERMINED" || !market.tax.label) return null;
  if (!(rate > 0)) return null;
  const percent = rate * 100;
  const shown = percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(2);
  return market.tax.priceModel === "INCLUDED"
    ? `${market.tax.label} incluido (${shown}%)`
    : `${market.tax.label} (${shown}%)`;
}
