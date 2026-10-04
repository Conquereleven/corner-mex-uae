// Signed shipping selection.
//
// The browser chooses a shipping option, but it must never be able to choose
// the PRICE. Each option the server offers is returned with a token: the
// option's fields, the destination postal code and a fingerprint of the cart,
// signed with a server secret. At order time the server verifies the token and
// takes the shipping amount from it — any amount the browser sends is ignored.
//
// A token is refused when its signature is wrong, when it has expired, when the
// destination postal code changed, or when the cart changed. Stateless on
// purpose: no quote table is needed to keep the price honest.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { NormalizedQuote } from "./types.ts";

export const QUOTE_TOKEN_VERSION = 1;
export const QUOTE_SECRET_MIN_LENGTH = 32;

export type CartLine = { variant_id: string; qty: number };

/** Order-independent fingerprint of the cart contents. */
export function cartFingerprint(items: CartLine[]): string {
  const canonical = [...items]
    .map((item) => `${item.variant_id}:${item.qty}`)
    .sort()
    .join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

type Payload = {
  v: number;
  quote: NormalizedQuote;
  postalCode: string;
  cart: string;
};

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function assertSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < QUOTE_SECRET_MIN_LENGTH) {
    throw new Error("QUOTE_SIGNING_SECRET_NOT_CONFIGURED");
  }
}

export function signQuote(
  quote: NormalizedQuote,
  binding: { postalCode: string; items: CartLine[] },
  secret: string | undefined,
): string {
  assertSecret(secret);
  const payload: Payload = {
    v: QUOTE_TOKEN_VERSION,
    quote,
    postalCode: binding.postalCode,
    cart: cartFingerprint(binding.items),
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export type QuoteTokenFailure =
  | "SHIPPING_QUOTE_INVALID"
  | "SHIPPING_QUOTE_EXPIRED"
  | "SHIPPING_QUOTE_DESTINATION_CHANGED"
  | "SHIPPING_QUOTE_CART_CHANGED";

export type QuoteTokenResult =
  | { ok: true; quote: NormalizedQuote }
  | { ok: false; reason: QuoteTokenFailure };

export function verifyQuoteToken(
  token: string,
  binding: { postalCode: string; items: CartLine[] },
  secret: string | undefined,
  nowMs: number = Date.now(),
): QuoteTokenResult {
  assertSecret(secret);
  const invalid: QuoteTokenResult = { ok: false, reason: "SHIPPING_QUOTE_INVALID" };

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body, secret), "base64url");
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return invalid;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return invalid;
  }
  if (payload?.v !== QUOTE_TOKEN_VERSION || !payload.quote) return invalid;

  const quote = payload.quote;
  if (typeof quote.price !== "number" || !Number.isFinite(quote.price) || quote.price < 0) {
    return invalid;
  }
  if (!(Date.parse(quote.expiresAt) > nowMs)) return { ok: false, reason: "SHIPPING_QUOTE_EXPIRED" };
  if (payload.postalCode !== binding.postalCode) {
    return { ok: false, reason: "SHIPPING_QUOTE_DESTINATION_CHANGED" };
  }
  if (payload.cart !== cartFingerprint(binding.items)) {
    return { ok: false, reason: "SHIPPING_QUOTE_CART_CHANGED" };
  }
  return { ok: true, quote };
}
