// The UAE ecommerce operation is DEFERRED (Founder decision 2026-10-05): no new
// UAE orders. The UAE order and payment entry points are kept as history, and
// this gate makes them inert in every build whose active market is not the UAE.
//
// It is a second lock. The first is operational: the UAE production service has
// CORNERMEX_CHECKOUT_ENABLED=false (docs/cornermex-mx/DEFERRED-UAE.md).
import { ACTIVE_MARKET } from "../config/market.ts";

export const UAE_MARKET_DEFERRED = "UAE_MARKET_DEFERRED";

export function isUaeMarketActive(): boolean {
  return ACTIVE_MARKET.code === "AE";
}

export function assertUaeMarketActive(): void {
  if (!isUaeMarketActive()) throw new Error(UAE_MARKET_DEFERRED);
}
