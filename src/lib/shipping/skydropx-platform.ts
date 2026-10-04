// Client for the Skydropx PRO API generation.
//
// Skydropx and Solo Envíos each publish an API reference
// (pro.skydropx.com/es-MX/api-docs and app.soloenvios.com/es-MX/api-docs). Read
// side by side on 2026-10-04 the two references are the same contract — same
// paths, same request and response fields, same webhook scheme — served from
// different hosts with different credentials. This module implements that
// contract once; skydropx.ts and solo-envios.ts bind it to each provider.
//
// They remain two independent providers to CornerMex: separate credentials,
// separate token caches, separate rate limits, separate health. If either
// provider's contract diverges, it gets its own client and this one keeps
// serving the other.
//
// Contract facts relied on here (all from the published references):
//   * POST /api/v1/oauth/token  {grant_type: client_credentials, client_id,
//     client_secret} → {access_token, token_type, expires_in, created_at}
//     "El token expira en 2 horas y permite hasta 2 solicitudes por segundo."
//   * POST /api/v1/quotations {quotation: {address_from, address_to, parcels}}
//     queues a quotation; GET /api/v1/quotations/{id} must be polled until
//     `is_completed` is true. "Los rates son válidos por 24 horas."
//   * POST /api/v1/shipments {shipment: {rate_id, unique_shipment, address_from,
//     address_to, packages}} buys the label. `unique_shipment: true` makes the
//     provider replay the original response for a repeated rate_id (200 on
//     replay, 409 while an earlier request is still in flight; cache 96 h).
//   * GET /api/v1/shipments/{id}, POST /api/v1/shipments/{id}/cancellations,
//     GET /api/v1/shipments/tracking?tracking_number=&carrier_name=
//
// Nothing here is exercised against a live account yet. Capability level:
// SCAFFOLDED (docs/cornermex-mx/SKYDROPX.md, SOLO-ENVIOS.md).

import { mapTrackingStatus, mapWorkflowStatus } from "./status.ts";
import {
  ShippingError,
  type CancelShipmentResult,
  type CreateShipmentRequest,
  type NormalizedQuote,
  type NormalizedShipment,
  type NormalizedTracking,
  type ProviderEnvironment,
  type QuoteAddress,
  type QuoteRequest,
  type ShipmentAddress,
  type ShipmentPackage,
  type ShippingProvider,
  type ShippingProviderId,
} from "./types.ts";

export type PlatformConfig = {
  id: Exclude<ShippingProviderId, "manual">;
  environment: ProviderEnvironment;
  /** Origin only, e.g. "https://sb-pro.skydropx.com". No trailing slash. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Injected for tests. */
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  requestTimeoutMs?: number;
  quotePollIntervalMs?: number;
  quotePollTimeoutMs?: number;
};

// "permite hasta 2 solicitudes por segundo"
const MIN_REQUEST_SPACING_MS = 500;
// Refresh this long before the documented expiry so a token never dies mid-call.
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
// "Los rates son válidos por 24 horas."
const RATE_VALIDITY_MS = 24 * 60 * 60 * 1000;
const SAFE_READ_ATTEMPTS = 3;

type Json = Record<string, unknown>;

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: Json;
  /**
   * `read`  — idempotent; retried on timeout, 429 and 5xx.
   * `write` — not retried. A timeout or 5xx is a definite, reportable failure
   *           that is safe for the caller to repeat (creating a quotation).
   * `spend` — not retried, and an unknown outcome is AMBIGUOUS_WRITE: money may
   *           have moved (buying a label).
   */
  kind: "read" | "write" | "spend";
  authenticated?: boolean;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : value == null ? null : String(value);

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clip = (value: string, max: number): string => value.trim().slice(0, max);

function quoteAddressBody(address: QuoteAddress): Json {
  return {
    country_code: address.country,
    postal_code: address.postalCode,
    area_level1: address.state,
    area_level2: address.municipality,
    area_level3: address.colonia,
  };
}

// Field limits are the documented ones: name 30, company 60, reference 30
// (origin) / 40 (destination).
function shipmentAddressBody(address: ShipmentAddress, referenceMax: number): Json {
  return {
    ...quoteAddressBody(address),
    street1: clip(address.street, 100),
    name: clip(address.name, 30),
    company: clip(address.company, 60),
    phone: address.phone,
    email: address.email,
    reference: clip(address.reference || "Sin referencias", referenceMax),
  };
}

function estimateText(days: number | null): string | null {
  if (days === null) return null;
  return days === 1 ? "1 día hábil" : `${days} días hábiles`;
}

export function createSkydropxPlatformProvider(config: PlatformConfig): ShippingProvider & {
  /** Exposed for health reporting and tests; never returns the token itself. */
  tokenExpiresAt(): number | null;
} {
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? (() => Date.now());
  const sleep =
    config.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = config.requestTimeoutMs ?? 15_000;
  const pollIntervalMs = config.quotePollIntervalMs ?? 1_000;
  const pollTimeoutMs = config.quotePollTimeoutMs ?? 20_000;
  const provider = config.id;

  let token: { value: string; expiresAt: number } | null = null;
  let tokenRequest: Promise<string> | null = null;
  let lastRequestAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  /** Serialises requests and spaces them to respect the documented 2 req/s. */
  function throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastRequestAt + MIN_REQUEST_SPACING_MS - now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = now();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function send(
    url: string,
    init: RequestInit,
  ): Promise<{ status: number; json: Json | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(url, { ...init, signal: controller.signal });
      const raw = await response.text();
      let json: Json | null = null;
      if (raw) {
        try {
          json = JSON.parse(raw) as Json;
        } catch {
          json = null;
        }
      }
      return { status: response.status, json };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchToken(): Promise<string> {
    let result: { status: number; json: Json | null };
    try {
      result = await throttled(() =>
        send(`${config.baseUrl}/api/v1/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }),
        }),
      );
    } catch {
      throw new ShippingError("TIMEOUT", "token request did not complete", {
        provider,
        retryable: true,
      });
    }
    const accessToken = text(result.json?.access_token);
    if (result.status === 429) {
      throw new ShippingError("RATE_LIMITED", "token request rate limited", {
        provider,
        status: 429,
        retryable: true,
      });
    }
    if (result.status < 200 || result.status >= 300 || !accessToken) {
      // Deliberately carries no response body: it may echo credentials.
      throw new ShippingError("AUTH_FAILED", "client credentials were rejected", {
        provider,
        status: result.status,
      });
    }
    const expiresIn = number(result.json?.expires_in) ?? 7200;
    token = {
      value: accessToken,
      expiresAt: now() + expiresIn * 1000 - TOKEN_REFRESH_SKEW_MS,
    };
    return accessToken;
  }

  /** One token request at a time, however many callers are waiting. */
  function accessToken(): Promise<string> {
    if (token && token.expiresAt > now()) return Promise.resolve(token.value);
    tokenRequest ??= fetchToken().finally(() => {
      tokenRequest = null;
    });
    return tokenRequest;
  }

  function failure(status: number, json: Json | null, kind: RequestOptions["kind"]): ShippingError {
    const detail =
      text(json?.error_description) ?? text(json?.message) ?? text(json?.error) ?? `HTTP ${status}`;
    if (status === 429) {
      // Rejected before processing, so repeating is safe even for a spend.
      return new ShippingError("RATE_LIMITED", detail, { provider, status, retryable: true });
    }
    if (status === 404) return new ShippingError("NOT_FOUND", detail, { provider, status });
    if (status === 401 || status === 403) {
      return new ShippingError("AUTH_FAILED", detail, { provider, status });
    }
    if (status >= 400 && status < 500) {
      return new ShippingError("INVALID_REQUEST", detail, { provider, status });
    }
    if (kind === "spend") {
      return new ShippingError("AMBIGUOUS_WRITE", detail, { provider, status });
    }
    return new ShippingError("PROVIDER_ERROR", detail, {
      provider,
      status,
      retryable: kind === "read",
    });
  }

  async function request(options: RequestOptions): Promise<{ status: number; json: Json }> {
    const attempts = options.kind === "read" ? SAFE_READ_ATTEMPTS : 1;
    let reauthenticated = false;
    let lastError: ShippingError | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const bearer = await accessToken();
      let result: { status: number; json: Json | null };
      try {
        result = await throttled(() =>
          send(`${config.baseUrl}${options.path}`, {
            method: options.method,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${bearer}`,
            },
            ...(options.body ? { body: JSON.stringify(options.body) } : {}),
          }),
        );
      } catch {
        // The request left this process and no answer came back.
        lastError =
          options.kind === "spend"
            ? new ShippingError("AMBIGUOUS_WRITE", "no response to a label purchase", { provider })
            : new ShippingError("TIMEOUT", "provider did not respond", {
                provider,
                retryable: true,
              });
        if (options.kind === "read" && attempt < attempts) {
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }

      // An expired or revoked token: drop it and try once more. The provider
      // rejected the call before doing anything, so this is safe for a spend.
      if (result.status === 401 && !reauthenticated) {
        token = null;
        reauthenticated = true;
        attempt -= 1;
        continue;
      }

      if (result.status >= 200 && result.status < 300) {
        return { status: result.status, json: result.json ?? {} };
      }

      lastError = failure(result.status, result.json, options.kind);
      const transient = result.status === 429 || result.status >= 500;
      if (options.kind === "read" && transient && attempt < attempts) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
    throw lastError ?? new ShippingError("PROVIDER_ERROR", "request failed", { provider });
  }

  function normalizeRates(
    quotation: Json,
    requestParcels: QuoteRequest["parcels"],
  ): NormalizedQuote[] {
    const quotationId = text(quotation.id) ?? "";
    const rates = Array.isArray(quotation.rates) ? (quotation.rates as Json[]) : [];
    const totalWeightKg = requestParcels.reduce((sum, parcel) => sum + parcel.weightKg, 0);
    const expiresAt = new Date(now() + RATE_VALIDITY_MS).toISOString();
    const quotes: NormalizedQuote[] = [];

    for (const rate of rates) {
      // `success: false` means the carrier could not price these parameters.
      if (rate.success !== true) continue;
      const rateId = text(rate.id);
      const price = number(rate.total);
      const currency = text(rate.currency_code);
      if (!rateId || price === null || price < 0 || !currency) continue;
      const days = number(rate.days);
      quotes.push({
        provider,
        carrier: text(rate.provider_name) ?? "unknown",
        carrierName: text(rate.provider_display_name) ?? text(rate.provider_name) ?? "",
        service: text(rate.provider_service_name) ?? "",
        serviceCode: text(rate.provider_service_code),
        price,
        currency,
        estimatedDaysMin: days,
        estimatedDaysMax: days,
        deliveryEstimate: estimateText(days),
        fulfillmentMode: "PARCEL_SHIPPING",
        package: { count: requestParcels.length, totalWeightKg },
        insurance: {
          available: rate.insurable === true,
          cost: number(rate.protection_value_total),
        },
        pickupSupported: rate.pickup === true || rate.pickup_automatic === true,
        providerQuoteId: quotationId,
        providerRateId: rateId,
        expiresAt,
      });
    }
    return quotes;
  }

  function normalizeShipment(json: Json, replayed: boolean): NormalizedShipment {
    const data = (json.data ?? {}) as Json;
    const attributes = (data.attributes ?? {}) as Json;
    const included = Array.isArray(json.included) ? (json.included as Json[]) : [];
    const rawStatus = text(attributes.workflow_status);
    const status = mapWorkflowStatus(rawStatus) ?? "LABEL_PENDING";

    const packages: ShipmentPackage[] = included
      .map((entry) => (entry.attributes ?? {}) as Json)
      // Packages are the included records that carry tracking fields; addresses
      // are included too and are skipped.
      .filter((attrs) => "tracking_status" in attrs || "tracking_number" in attrs)
      .map((attrs) => {
        const raw = text(attrs.tracking_status);
        return {
          trackingNumber: text(attrs.tracking_number),
          trackingUrl: text(attrs.tracking_url_provider),
          labelUrl: text(attrs.label_url),
          status: mapTrackingStatus(raw) ?? status,
          rawStatus: raw,
        };
      });

    const providerShipmentId = text(data.id) ?? text(attributes.id);
    if (!providerShipmentId) {
      throw new ShippingError("PROVIDER_ERROR", "shipment response carried no id", { provider });
    }
    return {
      provider,
      providerShipmentId,
      carrier: text(attributes.carrier_name),
      status,
      rawStatus,
      masterTrackingNumber: text(attributes.master_tracking_number),
      price: number(attributes.total),
      // The contract documents shipment totals in Mexican pesos.
      currency: number(attributes.total) === null ? null : "MXN",
      packages,
      replayed,
    };
  }

  return {
    id: provider,

    tokenExpiresAt: () => token?.expiresAt ?? null,

    async authenticate() {
      await accessToken();
    },

    async quote(input) {
      if (input.parcels.length === 0) {
        throw new ShippingError("INVALID_REQUEST", "a quote needs at least one parcel", {
          provider,
        });
      }
      const created = await request({
        method: "POST",
        path: "/api/v1/quotations",
        kind: "write",
        body: {
          quotation: {
            address_from: quoteAddressBody(input.origin),
            address_to: quoteAddressBody(input.destination),
            parcels: input.parcels.map((parcel) => ({
              // The contract types dimensions as integers; round up so a parcel
              // is never quoted smaller than it is.
              length: Math.ceil(parcel.lengthCm),
              width: Math.ceil(parcel.widthCm),
              height: Math.ceil(parcel.heightCm),
              weight: parcel.weightKg,
              ...(parcel.declaredValue
                ? { package_protected: true, declared_value: parcel.declaredValue }
                : {}),
            })),
          },
        },
      });

      let quotation = created.json;
      const quotationId = text(quotation.id);
      if (!quotationId) {
        throw new ShippingError("PROVIDER_ERROR", "quotation response carried no id", { provider });
      }

      // Rates arrive asynchronously; the reference says to wait for is_completed.
      const deadline = now() + pollTimeoutMs;
      while (quotation.is_completed !== true && now() < deadline) {
        await sleep(pollIntervalMs);
        quotation = (
          await request({
            method: "GET",
            path: `/api/v1/quotations/${encodeURIComponent(quotationId)}`,
            kind: "read",
          })
        ).json;
      }

      const quotes = normalizeRates(quotation, input.parcels);
      if (quotation.is_completed !== true && quotes.length === 0) {
        throw new ShippingError("QUOTE_INCOMPLETE", "quotation did not complete in time", {
          provider,
          retryable: true,
        });
      }
      return quotes;
    },

    async createShipment(input) {
      const { status, json } = await request({
        method: "POST",
        path: "/api/v1/shipments",
        kind: "spend",
        body: {
          shipment: {
            rate_id: input.providerRateId,
            // Provider-side idempotency keyed on the rate: repeating this exact
            // call can never buy a second label.
            unique_shipment: true,
            address_from: shipmentAddressBody(input.origin, 30),
            address_to: shipmentAddressBody(input.destination, 40),
            packages: input.parcels.map((parcel, index) => ({
              package_number: String(index + 1),
              consignment_note: parcel.consignmentNote,
              package_type: parcel.packageType,
              package_protected: Boolean(parcel.declaredValue),
              ...(parcel.declaredValue ? { declared_value: parcel.declaredValue } : {}),
            })),
          },
        },
      }).catch((error: unknown) => {
        // 409: an earlier request for this rate is still being processed. The
        // label may exist shortly — that is an unknown outcome, not a failure.
        if (error instanceof ShippingError && error.status === 409) {
          throw new ShippingError("AMBIGUOUS_WRITE", "a label purchase is already in progress", {
            provider,
            status: 409,
          });
        }
        throw error;
      });
      // 201 is a new label; 200 is the provider replaying the original response.
      return normalizeShipment(json, status === 200);
    },

    async getShipment(providerShipmentId) {
      const { json } = await request({
        method: "GET",
        path: `/api/v1/shipments/${encodeURIComponent(providerShipmentId)}`,
        kind: "read",
      });
      return normalizeShipment(json, false);
    },

    async cancelShipment(providerShipmentId, reason) {
      try {
        const { json } = await request({
          method: "POST",
          path: `/api/v1/shipments/${encodeURIComponent(providerShipmentId)}/cancellations`,
          kind: "write",
          body: { reason },
        });
        const attributes = (((json.data ?? {}) as Json).attributes ?? {}) as Json;
        return {
          provider,
          providerShipmentId,
          accepted: true,
          rawStatus: text(attributes.status) ?? text(json.status),
        } satisfies CancelShipmentResult;
      } catch (error) {
        // 422 "El envío no se puede cancelar" is an answer, not an outage.
        if (error instanceof ShippingError && error.status === 422) {
          return { provider, providerShipmentId, accepted: false, rawStatus: error.message };
        }
        throw error;
      }
    },

    async getTracking(trackingNumber, carrier) {
      const query = new URLSearchParams({ tracking_number: trackingNumber, carrier_name: carrier });
      const { json } = await request({
        method: "GET",
        path: `/api/v1/shipments/tracking?${query.toString()}`,
        kind: "read",
      });
      const rows = Array.isArray(json.data) ? (json.data as Json[]) : [];
      const events = rows.map((row) => {
        const attributes = (row.attributes ?? {}) as Json;
        const raw = text(attributes.status);
        return {
          status: mapTrackingStatus(raw) ?? "IN_TRANSIT",
          rawStatus: raw,
          description: text(attributes.event_description) ?? text(attributes.description),
          occurredAt: text(attributes.date),
          location: text(attributes.location),
        };
      });
      // Newest event decides the current status, whatever order they arrive in.
      const latest = [...events].sort((a, b) =>
        String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? "")),
      )[0];
      return {
        provider,
        trackingNumber,
        carrier,
        status: latest?.status ?? "LABEL_CREATED",
        rawStatus: latest?.rawStatus ?? null,
        events,
      } satisfies NormalizedTracking;
    },

    async getLabel(providerShipmentId) {
      const shipment = await this.getShipment(providerShipmentId);
      return shipment.packages.flatMap((entry) => (entry.labelUrl ? [entry.labelUrl] : []));
    },
  };
}
