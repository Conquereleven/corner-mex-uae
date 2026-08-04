import { QUOTE_SELECTION_STORAGE_KEY } from "@/features/b2b-catalog/quote-selection";
import { B2C_CART_STORAGE_KEY } from "@/lib/cart";

export const COMMERCE_FLOW_BOUNDARIES = Object.freeze({
  b2c: Object.freeze({
    entry: "/shop",
    preparation: "/cart",
    execution: "/checkout",
    storage: "localStorage",
    storageKey: B2C_CART_STORAGE_KEY,
  }),
  b2b: Object.freeze({
    entry: "/b2b/catalog",
    preparation: "/b2b/quote",
    execution: null,
    storage: "sessionStorage",
    storageKey: QUOTE_SELECTION_STORAGE_KEY,
  }),
});

export function commerceFlowsAreIndependent() {
  const { b2c, b2b } = COMMERCE_FLOW_BOUNDARIES;
  return b2c.storage !== b2b.storage && b2c.storageKey !== b2b.storageKey;
}
