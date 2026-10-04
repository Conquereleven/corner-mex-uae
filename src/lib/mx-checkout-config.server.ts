// Mexico checkout configuration — server-authoritative and fail-closed.
//
// This is the MX counterpart of the retired UAE module
// (src/lib/commercial-config.server.ts, kept for history and its own tests).
// Nothing here knows about emirates, AED or UAE VAT.
//
// Checkout executes only when every item below is true. Each missing item is
// reported by name so the admin can see exactly what stands between the
// deployment and a first order:
//
//   * checkout execution is switched on
//   * a quote-signing secret exists (the browser can never set a shipping price)
//   * at least one shipping source exists: a manual rule, or an enabled carrier
//     provider together with a configured origin address
//   * the deployment points at its declared Mexico database (never a UAE one)
//   * at least one payment provider is enabled and fully configured. The launch
//     providers are Mercado Pago and Clip. Cash on delivery is OFF by default and
//     is never offered nationally: its flag only allows it for LOCAL_DELIVERY
//   * the Mexico legal documents are published (production only)
//
// No rate, origin address, tax rate or payment method is invented: the defaults
// keep the checkout inert.

import { ACTIVE_MARKET, taxLineLabel } from "../config/market.ts";
import { evaluateMarketDatabase } from "../config/market-database.ts";
import { isCheckoutExecutionEnabled } from "./checkout-execution.server.ts";
import {
  parseFulfillmentOrigin,
  parseManualShippingRules,
  type FulfillmentLocation,
  type ManualShippingRule,
} from "./shipping/fulfillment.ts";
import { configuredPaymentProviders, paymentConfigHealth } from "./payments/providers.ts";
import type { PaymentProvider, ProviderHealth as PaymentProviderHealth } from "./payments/types.ts";
import { configuredShippingProviders, shippingConfigHealth } from "./shipping/providers.ts";
import { QUOTE_SECRET_MIN_LENGTH } from "./shipping/quote-token.server.ts";
import type { ProviderHealth, RankingPolicy, ShippingProvider } from "./shipping/types.ts";

type Environment = Record<string, string | undefined>;

/** Payment methods the Mexico checkout can execute. */
export type MxPaymentMethod = "mercado_pago" | "clip" | "cod";

/** A method as the checkout is told about it. */
export type MxPaymentOption = {
  id: MxPaymentMethod;
  /** True when the method may only be used with a LOCAL_DELIVERY shipping option. */
  localDeliveryOnly: boolean;
};

export type MxCheckoutConfig = {
  origin: FulfillmentLocation | null;
  manualRules: ManualShippingRule[];
  providers: ShippingProvider[];
  rankingPolicy: RankingPolicy;
  paymentOptions: MxPaymentOption[];
  paymentProviders: PaymentProvider[];
  /** Rate added on top of the subtotal. 0 unless the market's tax model is ADDED. */
  addedTaxRate: number;
  quoteSecret: string;
};

export type MxCheckoutEvaluation =
  | { ready: true; checkoutEnabled: true; reasons: []; config: MxCheckoutConfig }
  | { ready: false; checkoutEnabled: boolean; reasons: string[]; config?: undefined };

const POLICIES: readonly RankingPolicy[] = ["CHEAPEST", "FASTEST", "BEST_VALUE"];

function addedTaxRate(environment: Environment, reasons: string[]): number {
  // UNDETERMINED and INCLUDED both add nothing on top of the catalogue price.
  if (ACTIVE_MARKET.tax.priceModel !== "ADDED") return 0;
  const raw = (environment.CORNERMEX_MX_TAX_RATE ?? "").trim();
  if (!/^0(\.\d{1,4})?$/.test(raw)) {
    reasons.push("missing_or_invalid_CORNERMEX_MX_TAX_RATE");
    return 0;
  }
  return Number(raw);
}

export function evaluateMxCheckout(environment: Environment = process.env): MxCheckoutEvaluation {
  const reasons: string[] = [];
  const checkoutEnabled = isCheckoutExecutionEnabled(environment.CORNERMEX_CHECKOUT_ENABLED);
  if (!checkoutEnabled) reasons.push("checkout_execution_disabled");

  const quoteSecret = (environment.CORNERMEX_QUOTE_SIGNING_SECRET ?? "").trim();
  if (quoteSecret.length < QUOTE_SECRET_MIN_LENGTH) {
    reasons.push("missing_CORNERMEX_QUOTE_SIGNING_SECRET");
  }

  const manualRules = parseManualShippingRules(environment.CORNERMEX_MX_MANUAL_SHIPPING_JSON);
  if (manualRules === null) reasons.push("invalid_CORNERMEX_MX_MANUAL_SHIPPING_JSON");

  const providers = configuredShippingProviders(environment);
  const origin = parseFulfillmentOrigin(environment.CORNERMEX_MX_ORIGIN_JSON);
  // A carrier cannot quote without knowing where the parcel leaves from.
  if (providers.length > 0 && !origin.location) {
    reasons.push(...origin.problems.map((problem) => `CORNERMEX_MX_ORIGIN_JSON:${problem}`));
  }
  const carrierQuoting = providers.length > 0 && origin.location !== null;
  if (!carrierQuoting && (manualRules?.length ?? 0) === 0) {
    reasons.push("no_shipping_source_configured");
  }

  const database = evaluateMarketDatabase(environment);
  reasons.push(...database.reasons.map((reason) => `market_database:${reason}`));

  const paymentProviders = configuredPaymentProviders(environment);
  const paymentOptions: MxPaymentOption[] = paymentProviders.map((provider) => ({
    id: provider.id,
    localDeliveryOnly: false,
  }));
  // Cash on delivery: a future, local-only capability. It can never be the only
  // way to pay for a parcel shipped across the country.
  if (environment.CORNERMEX_MX_COD_LOCAL_ENABLED === "true") {
    paymentOptions.push({ id: "cod", localDeliveryOnly: true });
  }
  if (paymentOptions.length === 0) reasons.push("no_payment_method_enabled");

  const policyRaw = (environment.CORNERMEX_MX_SHIPPING_RANKING ?? "BEST_VALUE").trim();
  const rankingPolicy = POLICIES.includes(policyRaw as RankingPolicy)
    ? (policyRaw as RankingPolicy)
    : null;
  if (rankingPolicy === null) reasons.push("invalid_CORNERMEX_MX_SHIPPING_RANKING");

  // Orders must not be taken in production under terms that do not exist yet.
  const production = (environment.CORNERMEX_APPLICATION_ENV ?? "development") === "production";
  if (production && environment.CORNERMEX_MX_LEGAL_DOCS_PUBLISHED !== "true") {
    reasons.push("mx_legal_documents_not_published");
  }

  const taxRate = addedTaxRate(environment, reasons);

  if (reasons.length > 0) return { ready: false, checkoutEnabled, reasons };
  return {
    ready: true,
    checkoutEnabled: true,
    reasons: [],
    config: {
      origin: origin.location,
      manualRules: manualRules as ManualShippingRule[],
      providers: carrierQuoting ? providers : [],
      rankingPolicy: rankingPolicy as RankingPolicy,
      paymentOptions,
      paymentProviders,
      addedTaxRate: taxRate,
      quoteSecret,
    },
  };
}

/** Non-secret view for the checkout UI and the admin readiness panel. */
export function getPublicMxCheckoutConfig(environment: Environment = process.env): {
  active: boolean;
  reasons: string[];
  market: { country: string; currency: string; locale: string };
  paymentOptions: MxPaymentOption[];
  taxLabel: string | null;
} {
  const evaluation = evaluateMxCheckout(environment);
  return {
    active: evaluation.ready,
    reasons: evaluation.reasons,
    market: {
      country: ACTIVE_MARKET.country,
      currency: ACTIVE_MARKET.currency,
      locale: ACTIVE_MARKET.locale,
    },
    paymentOptions: evaluation.ready ? evaluation.config.paymentOptions : [],
    taxLabel: evaluation.ready ? taxLineLabel(evaluation.config.addedTaxRate) : null,
  };
}

/** Shipping integration health from configuration alone. Never includes secrets. */
export function getShippingIntegrationHealth(
  environment: Environment = process.env,
): ProviderHealth[] {
  return shippingConfigHealth(environment);
}

/** Payment integration health from configuration alone. Never includes secrets. */
export function getPaymentIntegrationHealth(
  environment: Environment = process.env,
): PaymentProviderHealth[] {
  return paymentConfigHealth(environment);
}

/**
 * Whether a payment method may pay for a given shipping option. Cash on
 * delivery is allowed only with local delivery; the providers have no limit.
 */
export function paymentAllowedFor(
  option: MxPaymentOption | undefined,
  fulfillmentMode: string,
): boolean {
  if (!option) return false;
  return !option.localDeliveryOnly || fulfillmentMode === "LOCAL_DELIVERY";
}

/** Server-authoritative totals. The shipping amount comes from a verified quote token. */
export function computeMxTotals(
  subtotal: number,
  shipping: number,
  taxRate: number,
): { subtotal: number; shipping: number; tax: number; total: number } {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const roundedSubtotal = round(subtotal);
  const tax = round(roundedSubtotal * taxRate);
  return {
    subtotal: roundedSubtotal,
    shipping: round(shipping),
    tax,
    total: round(roundedSubtotal + shipping + tax),
  };
}
