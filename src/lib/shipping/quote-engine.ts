// Rate shopping.
//
//   CornerMex → quote every configured provider in parallel → normalise →
//   de-duplicate → rank → present.
//
// The engine never picks a carrier on price alone and then discards the rest:
// every option keeps its delivery estimate and provenance, the ranking policy
// only decides the ORDER and which option is recommended.
//
// One provider failing does not fail the quote. Its failure is reported next to
// the options the others returned, so the customer still gets a price and
// operations still sees the outage.

import {
  ShippingError,
  type NormalizedQuote,
  type QuoteRequest,
  type RankingPolicy,
  type ShippingErrorCode,
  type ShippingProvider,
  type ShippingProviderId,
} from "./types.ts";

export type ProviderFailure = {
  provider: ShippingProviderId;
  code: ShippingErrorCode;
  message: string;
};

export type QuoteOutcome = {
  /** Ranked best-first under the requested policy. */
  quotes: NormalizedQuote[];
  /** The first quote, or null when nothing could be quoted. */
  recommended: NormalizedQuote | null;
  failures: ProviderFailure[];
  policy: RankingPolicy;
};

const UNKNOWN_DAYS = Number.POSITIVE_INFINITY;

const days = (quote: NormalizedQuote): number => quote.estimatedDaysMax ?? UNKNOWN_DAYS;

function byPrice(a: NormalizedQuote, b: NormalizedQuote): number {
  return a.price - b.price || days(a) - days(b);
}

function bySpeed(a: NormalizedQuote, b: NormalizedQuote): number {
  // An option with no delivery estimate can never be called the fastest.
  return days(a) - days(b) || a.price - b.price;
}

/**
 * BEST_VALUE scores each option on price and speed, both normalised to the
 * range actually on offer, and weights price slightly higher. An option with no
 * delivery estimate is treated as the slowest on offer.
 */
function bestValueOrder(quotes: NormalizedQuote[]): NormalizedQuote[] {
  if (quotes.length < 2) return [...quotes];
  const prices = quotes.map((quote) => quote.price);
  const known = quotes.map(days).filter((value) => value !== UNKNOWN_DAYS);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDays = known.length ? Math.min(...known) : 0;
  const maxDays = known.length ? Math.max(...known) : 0;
  const scale = (value: number, min: number, max: number) =>
    max === min ? 0 : (value - min) / (max - min);

  const score = (quote: NormalizedQuote): number => {
    const speed = days(quote) === UNKNOWN_DAYS ? 1 : scale(days(quote), minDays, maxDays);
    return 0.6 * scale(quote.price, minPrice, maxPrice) + 0.4 * speed;
  };
  return [...quotes].sort((a, b) => score(a) - score(b) || byPrice(a, b));
}

export function rankQuotes(quotes: NormalizedQuote[], policy: RankingPolicy): NormalizedQuote[] {
  switch (policy) {
    case "CHEAPEST":
      return [...quotes].sort(byPrice);
    case "FASTEST":
      return [...quotes].sort(bySpeed);
    case "BEST_VALUE":
      return bestValueOrder(quotes);
  }
}

/**
 * Both aggregators can resell the same carrier service. Offering the customer
 * "FedEx Express" twice is noise, so for an identical carrier + service the
 * cheaper offer is kept (the faster one on a price tie).
 */
export function dedupeQuotes(quotes: NormalizedQuote[]): NormalizedQuote[] {
  const best = new Map<string, NormalizedQuote>();
  for (const quote of quotes) {
    const key = `${quote.fulfillmentMode}|${quote.carrier.toLowerCase()}|${(
      quote.serviceCode ?? quote.service
    ).toLowerCase()}`;
    const existing = best.get(key);
    if (!existing || byPrice(quote, existing) < 0) best.set(key, quote);
  }
  return [...best.values()];
}

/** Drops anything already past its expiry or priced in another currency. */
export function usableQuotes(
  quotes: NormalizedQuote[],
  currency: string,
  nowMs: number = Date.now(),
): NormalizedQuote[] {
  return quotes.filter(
    (quote) =>
      quote.currency === currency &&
      Number.isFinite(quote.price) &&
      quote.price >= 0 &&
      Date.parse(quote.expiresAt) > nowMs,
  );
}

export async function shopRates(
  providers: ShippingProvider[],
  request: QuoteRequest,
  options: { policy?: RankingPolicy; currency: string; now?: () => number },
): Promise<QuoteOutcome> {
  const policy = options.policy ?? "BEST_VALUE";
  const settled = await Promise.allSettled(providers.map((provider) => provider.quote(request)));

  const collected: NormalizedQuote[] = [];
  const failures: ProviderFailure[] = [];
  settled.forEach((result, index) => {
    const provider = providers[index].id;
    if (result.status === "fulfilled") {
      collected.push(...result.value);
      return;
    }
    const reason = result.reason;
    failures.push({
      provider,
      code: reason instanceof ShippingError ? reason.code : "PROVIDER_ERROR",
      message: reason instanceof Error ? reason.message : "unknown provider failure",
    });
  });

  const quotes = rankQuotes(
    dedupeQuotes(usableQuotes(collected, options.currency, options.now?.() ?? Date.now())),
    policy,
  );
  return { quotes, recommended: quotes[0] ?? null, failures, policy };
}
