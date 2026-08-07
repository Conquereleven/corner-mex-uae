import { WAVE_1_PRODUCTS, WAVE_1_PRODUCT_IDS } from "./wave1-products.ts";

export const QUOTE_SELECTION_STORAGE_KEY = "cm.quoteSelection";

type SessionStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function sanitizeQuoteSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter((productId): productId is string => {
      return typeof productId === "string" && WAVE_1_PRODUCT_IDS.has(productId);
    }),
  );
  return WAVE_1_PRODUCTS.filter((product) => selected.has(product.id)).map((product) => product.id);
}

function browserSessionStorage(): SessionStorageAdapter | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage;
}

export function readQuoteSelection(
  storage: SessionStorageAdapter | undefined = browserSessionStorage(),
): string[] {
  if (!storage) return [];
  try {
    const stored = storage.getItem(QUOTE_SELECTION_STORAGE_KEY);
    return stored ? sanitizeQuoteSelection(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function writeQuoteSelection(
  productIds: ReadonlyArray<string>,
  storage: SessionStorageAdapter | undefined = browserSessionStorage(),
): string[] {
  const safeIds = sanitizeQuoteSelection(productIds);
  if (!storage) return safeIds;
  try {
    if (safeIds.length === 0) clearQuoteSelection(storage);
    else storage.setItem(QUOTE_SELECTION_STORAGE_KEY, JSON.stringify(safeIds));
  } catch {
    return [];
  }
  return safeIds;
}

export function clearQuoteSelection(
  storage: SessionStorageAdapter | undefined = browserSessionStorage(),
) {
  if (!storage) return;
  storage.removeItem(QUOTE_SELECTION_STORAGE_KEY);
}
