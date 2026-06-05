export type Currency = "AED" | "USD" | "EUR" | "MXN" | "SAR" | "GBP";
export type RateMap = Record<string, number>;

const SYMBOLS: Record<string, string> = { AED: "AED", USD: "$", EUR: "€", MXN: "MX$", SAR: "SAR", GBP: "£" };
const LOCALES: Record<string, string> = { AED: "en-AE", USD: "en-US", EUR: "en-DE", MXN: "es-MX", SAR: "ar-SA", GBP: "en-GB" };

export function convert(amountAed: number, target: string, rates: RateMap): number {
  if (!target || target === "AED") return amountAed;
  const r = rates[target];
  if (!r || r <= 0) return amountAed;
  return amountAed * r;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALES[currency] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${SYMBOLS[currency] ?? currency} ${amount.toFixed(2)}`;
  }
}

export function formatFromAed(amountAed: number, target: string, rates: RateMap): string {
  return formatMoney(convert(amountAed, target, rates), target);
}

const KEY = "cm:currency";
export function getStoredCurrency(): string {
  if (typeof window === "undefined") return "AED";
  return localStorage.getItem(KEY) || "AED";
}
export function setStoredCurrency(c: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, c);
  window.dispatchEvent(new CustomEvent("cm:currency-change", { detail: c }));
}