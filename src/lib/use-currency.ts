import { BASE_CURRENCY, formatMoney } from "@/lib/currency";

/** Currencies offered to the customer. One per market; Mexico sells in MXN. */
export const CURRENCIES = [BASE_CURRENCY] as const;

/**
 * Price formatting for storefront components. Amounts are already in the
 * market currency, so nothing is converted and no rate is fetched.
 */
export function useCurrency() {
  return {
    code: BASE_CURRENCY,
    setCode: (_code: string) => undefined,
    rates: { [BASE_CURRENCY]: 1 } as Record<string, number>,
    convert: (amount: number) => amount,
    format: (amount: number) => formatMoney(amount),
  };
}
