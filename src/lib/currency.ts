// Display-currency helpers.
//
// Every stored amount is in the active market's currency (src/config/market.ts).
// Mexico is a single-currency market, so there is no conversion and no currency
// switcher: `convert` returns the amount unchanged unless a rate for another
// currency is explicitly supplied.
import { ACTIVE_MARKET, formatMoney as formatMarketMoney } from "../config/market.ts";

export type Currency = string;
export type RateMap = Record<string, number>;

/** The currency amounts are stored in. */
export const BASE_CURRENCY: string = ACTIVE_MARKET.currency;

export function convert(amount: number, target: string, rates: RateMap): number {
  if (!target || target === BASE_CURRENCY) return amount;
  const r = rates[target];
  if (!r || r <= 0) return amount;
  return amount * r;
}

export function formatMoney(amount: number, currency: string = BASE_CURRENCY): string {
  if (currency === BASE_CURRENCY) return formatMarketMoney(amount);
  try {
    return new Intl.NumberFormat(ACTIVE_MARKET.locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const KEY = "cm:currency";
export function getStoredCurrency(): string {
  return BASE_CURRENCY;
}
export function setStoredCurrency(_c: string) {
  // Single-currency market: a stale preference from another market is cleared.
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
