// Shared HTTP plumbing for payment adapters.
//
// The one rule that matters: a money-moving call is never blindly retried. If
// such a call times out or the provider answers 5xx, the outcome is unknown and
// is reported as AMBIGUOUS_WRITE. The caller repeats it with the SAME
// idempotency key, or looks the payment up — it never mints a new key.

import { PaymentError, type PaymentProviderId } from "./types.ts";

export type Json = Record<string, unknown>;

export type HttpOptions = {
  provider: PaymentProviderId;
  fetch: typeof fetch;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
};

export type HttpRequest = {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: Json;
  /** `read` is retried on timeout / 429 / 5xx. `money` never is. */
  kind: "read" | "money";
};

const READ_ATTEMPTS = 3;

export const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== ""
    ? value
    : typeof value === "number"
      ? String(value)
      : null;

export const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function failure(
  provider: PaymentProviderId,
  status: number,
  json: Json | null,
  kind: HttpRequest["kind"],
): PaymentError {
  // Provider error bodies can echo request fields; keep only short identifiers.
  const detail =
    text(json?.message) ?? text(json?.error) ?? text(json?.error_description) ?? `HTTP ${status}`;
  const message = detail.slice(0, 200);
  if (status === 429) return new PaymentError("RATE_LIMITED", message, { provider, status });
  if (status === 404) return new PaymentError("NOT_FOUND", message, { provider, status });
  if (status === 401 || status === 403) {
    return new PaymentError("AUTH_FAILED", message, { provider, status });
  }
  if (status >= 400 && status < 500) {
    return new PaymentError("INVALID_REQUEST", message, { provider, status });
  }
  return new PaymentError(kind === "money" ? "AMBIGUOUS_WRITE" : "PROVIDER_ERROR", message, {
    provider,
    status,
  });
}

export async function send(
  options: HttpOptions,
  request: HttpRequest,
): Promise<{ status: number; json: Json }> {
  const attempts = request.kind === "read" ? READ_ATTEMPTS : 1;
  let last: PaymentError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    let status: number;
    let json: Json | null = null;
    try {
      const response = await options.fetch(request.url, {
        method: request.method,
        headers: { Accept: "application/json", ...request.headers },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        signal: controller.signal,
      });
      status = response.status;
      const raw = await response.text();
      if (raw) {
        try {
          json = JSON.parse(raw) as Json;
        } catch {
          json = null;
        }
      }
    } catch {
      last =
        request.kind === "money"
          ? new PaymentError("AMBIGUOUS_WRITE", "no response to a payment request", {
              provider: options.provider,
            })
          : new PaymentError("TIMEOUT", "provider did not respond", { provider: options.provider });
      if (request.kind === "read" && attempt < attempts) {
        await options.sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      throw last;
    } finally {
      clearTimeout(timer);
    }

    if (status >= 200 && status < 300) return { status, json: json ?? {} };
    last = failure(options.provider, status, json, request.kind);
    if (request.kind === "read" && (status === 429 || status >= 500) && attempt < attempts) {
      await options.sleep(500 * 2 ** (attempt - 1));
      continue;
    }
    throw last;
  }
  throw last ?? new PaymentError("PROVIDER_ERROR", "request failed", { provider: options.provider });
}
