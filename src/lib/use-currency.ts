import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrencyRates } from "@/lib/seller.functions";
import { convert, formatMoney, getStoredCurrency, setStoredCurrency, type RateMap } from "@/lib/currency";

export const CURRENCIES = ["AED", "USD", "EUR", "MXN", "SAR", "GBP"] as const;

export function useCurrency() {
  const fn = useServerFn(getCurrencyRates);
  const q = useQuery({
    queryKey: ["currency-rates"],
    queryFn: () => fn({}),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const [code, setCode] = useState<string>("AED");
  useEffect(() => {
    setCode(getStoredCurrency());
    const onChange = (e: any) => setCode(e.detail ?? getStoredCurrency());
    window.addEventListener("cm:currency-change", onChange);
    return () => window.removeEventListener("cm:currency-change", onChange);
  }, []);
  const rates: RateMap = (q.data?.rates ?? { AED: 1 }) as RateMap;
  return {
    code,
    setCode: (c: string) => { setStoredCurrency(c); setCode(c); },
    rates,
    convert: (aed: number) => convert(aed, code, rates),
    format: (aed: number) => formatMoney(convert(aed, code, rates), code),
  };
}