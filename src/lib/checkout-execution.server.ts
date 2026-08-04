export const CHECKOUT_EXECUTION_DISABLED = "CHECKOUT_EXECUTION_DISABLED";

export function isCheckoutExecutionEnabled(value = process.env.CORNERMEX_CHECKOUT_ENABLED) {
  return value === "true";
}

export function assertCheckoutExecutionEnabled(
  value = process.env.CORNERMEX_CHECKOUT_ENABLED,
) {
  if (!isCheckoutExecutionEnabled(value)) {
    throw new Error(CHECKOUT_EXECUTION_DISABLED);
  }
}
