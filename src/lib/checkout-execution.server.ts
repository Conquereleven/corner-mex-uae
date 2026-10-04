import { assertUaeMarketActive } from "./uae-market-gate.ts";

export const CHECKOUT_EXECUTION_DISABLED = "CHECKOUT_EXECUTION_DISABLED";

export function isCheckoutExecutionEnabled(value = process.env.CORNERMEX_CHECKOUT_ENABLED) {
  return value === "true";
}

/**
 * Gate for the retired UAE order and payment functions (orders.functions.ts,
 * payments.functions.ts) — its only callers. The Mexico checkout has its own
 * fail-closed evaluation (mx-checkout-config.server.ts) and never calls this, so
 * with the UAE market deferred these functions cannot execute in any build
 * whose active market is not the UAE, even when checkout is switched on.
 */
export function assertCheckoutExecutionEnabled(value = process.env.CORNERMEX_CHECKOUT_ENABLED) {
  if (!isCheckoutExecutionEnabled(value)) {
    throw new Error(CHECKOUT_EXECUTION_DISABLED);
  }
  assertUaeMarketActive();
}
