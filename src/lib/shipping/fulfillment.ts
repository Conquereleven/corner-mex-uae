// Fulfilment locations and manual shipping rules.
//
// Initial operation: one stock point near Tecámac, Estado de México. The Central
// de Abastos is where CornerMex buys, not where it ships from, so the location's
// address is configuration — it is never assumed or hardcoded here.
//
// The model is deliberately small: a list of locations with exactly one default.
// Multi-warehouse routing is not built; `locations` being a list is the only
// concession to it.
//
// Manual rules are the safe fallback when no carrier API is configured or a
// carrier cannot price an order. They also express LOCAL_DELIVERY, which no
// aggregator offers. No rule ships with a default price: an unconfigured
// deployment offers no shipping at all rather than an invented rate.

import { MX_STATES, type MxStateCode } from "../mx-address.ts";
import type {
  FulfillmentMode,
  NormalizedQuote,
  QuoteAddress,
  ShipmentAddress,
} from "./types.ts";

export type FulfillmentLocation = {
  id: string;
  name: string;
  isDefault: boolean;
  address: ShipmentAddress;
};

export const DEFAULT_LOCATION_ID = "mx-tecamac";
export const DEFAULT_LOCATION_NAME = "CornerMex MX - Tecámac";

type Json = Record<string, unknown>;

const str = (value: unknown, min: number, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
};

/**
 * Parses the origin address (CORNERMEX_MX_ORIGIN_JSON). Returns the names of
 * the invalid or missing fields so configuration errors are actionable.
 */
export function parseFulfillmentOrigin(raw: string | undefined): {
  location: FulfillmentLocation | null;
  problems: string[];
} {
  if (!raw || raw.trim() === "") return { location: null, problems: ["origin_not_configured"] };
  let parsed: Json;
  try {
    parsed = JSON.parse(raw) as Json;
  } catch {
    return { location: null, problems: ["origin_not_json"] };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { location: null, problems: ["origin_not_object"] };
  }

  const problems: string[] = [];
  const field = (name: string, min: number, max: number): string => {
    const value = str(parsed[name], min, max);
    if (value === null) problems.push(`origin.${name}`);
    return value ?? "";
  };

  const stateCode = str(parsed.state, 3, 3)?.toUpperCase() as MxStateCode | undefined;
  if (!stateCode || !(stateCode in MX_STATES)) problems.push("origin.state");
  const postalCode = field("postal_code", 5, 5);
  if (postalCode && !/^\d{5}$/.test(postalCode)) problems.push("origin.postal_code");
  const phone = field("phone", 10, 10);
  if (phone && !/^\d{10}$/.test(phone)) problems.push("origin.phone");

  const address: ShipmentAddress = {
    country: "MX",
    postalCode,
    state: stateCode && stateCode in MX_STATES ? MX_STATES[stateCode] : "",
    municipality: field("municipality", 2, 120),
    colonia: field("colonia", 2, 120),
    name: field("name", 2, 30),
    company: field("company", 2, 60),
    phone,
    email: field("email", 5, 254),
    street: field("street", 2, 100),
    reference: str(parsed.reference, 0, 30) ?? "",
  };
  if (problems.length > 0) return { location: null, problems: [...new Set(problems)] };

  return {
    location: {
      id: str(parsed.id, 1, 60) ?? DEFAULT_LOCATION_ID,
      name: str(parsed.location_name, 1, 80) ?? DEFAULT_LOCATION_NAME,
      isDefault: true,
      address,
    },
    problems: [],
  };
}

export function quoteAddressOf(address: ShipmentAddress): QuoteAddress {
  return {
    country: address.country,
    postalCode: address.postalCode,
    state: address.state,
    municipality: address.municipality,
    colonia: address.colonia,
  };
}

export type ManualShippingRule = {
  id: string;
  label: string;
  mode: Extract<FulfillmentMode, "LOCAL_DELIVERY" | "PARCEL_SHIPPING">;
  /**
   * Postal-code prefixes this rule serves, e.g. ["557", "558"]. The single
   * value "*" serves every Mexican postal code.
   */
  postalPrefixes: string[];
  price: number;
  daysMin: number;
  daysMax: number;
  /** Orders at or above this subtotal ship free under this rule. */
  freeFromSubtotal: number | null;
};

/** Parses CORNERMEX_MX_MANUAL_SHIPPING_JSON. Null when absent or invalid. */
export function parseManualShippingRules(raw: string | undefined): ManualShippingRule[] | null {
  if (!raw || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const rules: ManualShippingRule[] = [];
  const ids = new Set<string>();
  for (const entry of parsed as Json[]) {
    if (!entry || typeof entry !== "object") return null;
    const id = str(entry.id, 1, 40);
    const label = str(entry.label, 1, 80);
    const mode = entry.mode;
    const prefixes = entry.postalPrefixes;
    const price = entry.price;
    const daysMin = entry.daysMin;
    const daysMax = entry.daysMax;
    const freeFrom = entry.freeFromSubtotal ?? null;
    if (
      !id ||
      ids.has(id) ||
      !label ||
      (mode !== "LOCAL_DELIVERY" && mode !== "PARCEL_SHIPPING") ||
      !Array.isArray(prefixes) ||
      prefixes.length === 0 ||
      !prefixes.every((prefix) => prefix === "*" || /^\d{1,5}$/.test(String(prefix))) ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      Math.round(price * 100) !== price * 100 ||
      !Number.isInteger(daysMin) ||
      !Number.isInteger(daysMax) ||
      (daysMin as number) < 0 ||
      (daysMax as number) < (daysMin as number) ||
      (freeFrom !== null && (typeof freeFrom !== "number" || freeFrom < 0))
    ) {
      return null;
    }
    ids.add(id);
    rules.push({
      id,
      label,
      mode,
      postalPrefixes: prefixes.map(String),
      price,
      daysMin: daysMin as number,
      daysMax: daysMax as number,
      freeFromSubtotal: freeFrom as number | null,
    });
  }
  return rules;
}

const serves = (rule: ManualShippingRule, postalCode: string): boolean =>
  rule.postalPrefixes.some((prefix) => prefix === "*" || postalCode.startsWith(prefix));

/**
 * Manual quotes for a destination. A specific prefix beats the "*" catch-all
 * for the same fulfilment mode, so a local rule and a national rule can coexist.
 */
export function manualQuotes(
  rules: ManualShippingRule[],
  input: { postalCode: string; subtotal: number; currency: string; totalWeightKg: number },
  nowMs: number = Date.now(),
): NormalizedQuote[] {
  const matching = rules.filter((rule) => serves(rule, input.postalCode));
  const specific = new Set(
    matching.filter((rule) => !rule.postalPrefixes.includes("*")).map((rule) => rule.mode),
  );
  return matching
    .filter((rule) => !rule.postalPrefixes.includes("*") || !specific.has(rule.mode))
    .map((rule) => {
      const free = rule.freeFromSubtotal !== null && input.subtotal >= rule.freeFromSubtotal;
      const range =
        rule.daysMin === rule.daysMax ? `${rule.daysMax}` : `${rule.daysMin}–${rule.daysMax}`;
      return {
        provider: "manual" as const,
        carrier: "cornermex",
        carrierName: "CornerMex",
        service: rule.label,
        serviceCode: rule.id,
        price: free ? 0 : rule.price,
        currency: input.currency,
        estimatedDaysMin: rule.daysMin,
        estimatedDaysMax: rule.daysMax,
        deliveryEstimate: `${range} ${rule.daysMax === 1 ? "día hábil" : "días hábiles"}`,
        fulfillmentMode: rule.mode,
        package: { count: 1, totalWeightKg: input.totalWeightKg },
        insurance: { available: false, cost: null },
        pickupSupported: false,
        providerQuoteId: `manual:${rule.id}`,
        providerRateId: `manual:${rule.id}`,
        // Manual rules do not expire with a carrier; bound them to the session.
        expiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
      };
    });
}
