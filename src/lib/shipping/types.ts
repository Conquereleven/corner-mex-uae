// CornerMex shipping — canonical types.
//
// CornerMex Core owns the shipping model. Skydropx and Solo Envíos are adapters
// that translate to and from it; neither is a source of truth, and no checkout
// or admin code may depend on a provider's own field names.
//
// No imports beyond sibling modules, so this is usable in the browser bundle,
// in server functions and under node:test.

export type ShippingProviderId = "skydropx" | "solo_envios" | "manual";

/** How an order physically reaches the customer. */
export type FulfillmentMode = "LOCAL_DELIVERY" | "PARCEL_SHIPPING" | "PICKUP";

/**
 * Honest capability level of an integration (docs/cornermex-mx/SHIPPING.md).
 * LIVE may only be reported after real credentials and a verified production
 * call; nothing in code can promote an integration to LIVE by itself.
 */
export type IntegrationState = "NOT_CONFIGURED" | "SANDBOX" | "CONNECTED" | "DEGRADED" | "LIVE";

export type ProviderEnvironment = "sandbox" | "production";

/** One physical package. Metric: centimetres and kilograms. */
export type Parcel = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  /** Declared value in the market currency, when protection is requested. */
  declaredValue?: number;
};

/** The parts of an address a carrier needs to price a shipment. */
export type QuoteAddress = {
  country: "MX";
  postalCode: string;
  /** State name as carriers expect it, e.g. "Estado de México". */
  state: string;
  /** Municipio or alcaldía. */
  municipality: string;
  colonia: string;
};

/** A complete address for a label. */
export type ShipmentAddress = QuoteAddress & {
  name: string;
  company: string;
  phone: string;
  email: string;
  /** Street with exterior (and interior) number, as it prints on the label. */
  street: string;
  reference: string;
};

export type QuoteRequest = {
  origin: QuoteAddress;
  destination: QuoteAddress;
  parcels: Parcel[];
};

/**
 * A carrier offer, normalised. The customer never needs to know which
 * aggregator produced it.
 */
export type NormalizedQuote = {
  provider: ShippingProviderId;
  /** Carrier code as the provider names it, e.g. "fedex", "estafeta". */
  carrier: string;
  carrierName: string;
  service: string;
  serviceCode: string | null;
  /** Total the provider will charge CornerMex, taxes and fees included. */
  price: number;
  currency: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  /** Human estimate in the market language, or null when the carrier gave none. */
  deliveryEstimate: string | null;
  fulfillmentMode: FulfillmentMode;
  package: { count: number; totalWeightKg: number };
  insurance: { available: boolean; cost: number | null };
  pickupSupported: boolean;
  /** The provider's quotation id. */
  providerQuoteId: string;
  /** The provider's rate id — what a shipment is created from. */
  providerRateId: string;
  /** ISO 8601 instant after which this quote must not be used. */
  expiresAt: string;
};

export type RankingPolicy = "CHEAPEST" | "FASTEST" | "BEST_VALUE";

/**
 * CornerMex shipment lifecycle. Every provider status maps into one of these;
 * the raw provider status is always preserved alongside for debugging.
 */
export const SHIPMENT_STATUSES = [
  "QUOTE_CREATED",
  "LABEL_PENDING",
  "LABEL_CREATED",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
  "RETURNED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export type ShipmentPackage = {
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  status: ShipmentStatus;
  rawStatus: string | null;
};

export type NormalizedShipment = {
  provider: ShippingProviderId;
  providerShipmentId: string;
  carrier: string | null;
  status: ShipmentStatus;
  /** Provider workflow status exactly as received. */
  rawStatus: string | null;
  masterTrackingNumber: string | null;
  price: number | null;
  currency: string | null;
  packages: ShipmentPackage[];
  /** True when the provider answered from its idempotent replay cache. */
  replayed: boolean;
};

export type CreateShipmentRequest = {
  /** CornerMex order reference; never a provider id. */
  orderReference: string;
  providerRateId: string;
  origin: ShipmentAddress;
  destination: ShipmentAddress;
  parcels: Array<
    Parcel & {
      /** Carta Porte product code required by Mexican carriers. */
      consignmentNote: string;
      /** Carta Porte packaging code. */
      packageType: string;
    }
  >;
};

export type TrackingEvent = {
  status: ShipmentStatus;
  rawStatus: string | null;
  description: string | null;
  occurredAt: string | null;
  location: string | null;
};

export type NormalizedTracking = {
  provider: ShippingProviderId;
  trackingNumber: string;
  carrier: string;
  status: ShipmentStatus;
  rawStatus: string | null;
  events: TrackingEvent[];
};

export type CancelShipmentResult = {
  provider: ShippingProviderId;
  providerShipmentId: string;
  accepted: boolean;
  rawStatus: string | null;
};

export type ProviderHealth = {
  provider: ShippingProviderId;
  state: IntegrationState;
  environment: ProviderEnvironment | null;
  /** Names of missing configuration values. Never the values themselves. */
  missing: string[];
};

/**
 * What every shipping adapter implements. Methods a provider genuinely cannot
 * support throw ShippingError("NOT_SUPPORTED") instead of faking a result.
 */
export interface ShippingProvider {
  readonly id: ShippingProviderId;
  /** Obtains (or reuses) a credential. Resolves only when authenticated. */
  authenticate(): Promise<void>;
  quote(request: QuoteRequest): Promise<NormalizedQuote[]>;
  /**
   * Buys a label. Callers MUST have a confirmed payment (or an explicit business
   * rule permitting otherwise) before calling this — it spends money.
   */
  createShipment(request: CreateShipmentRequest): Promise<NormalizedShipment>;
  getShipment(providerShipmentId: string): Promise<NormalizedShipment>;
  cancelShipment(providerShipmentId: string, reason: string): Promise<CancelShipmentResult>;
  getTracking(trackingNumber: string, carrier: string): Promise<NormalizedTracking>;
  /** Label URLs for a shipment; empty while the label is still being generated. */
  getLabel(providerShipmentId: string): Promise<string[]>;
}

export type ShippingErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_SUPPORTED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "QUOTE_INCOMPLETE"
  | "QUOTE_EXPIRED"
  /**
   * A write may or may not have reached the provider. The caller must look the
   * shipment up before trying again — never blindly retry.
   */
  | "AMBIGUOUS_WRITE";

export class ShippingError extends Error {
  readonly code: ShippingErrorCode;
  readonly provider: ShippingProviderId | null;
  readonly status: number | null;
  /** True when repeating the same call is known to be safe. */
  readonly retryable: boolean;

  constructor(
    code: ShippingErrorCode,
    message: string,
    options: { provider?: ShippingProviderId; status?: number; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ShippingError";
    this.code = code;
    this.provider = options.provider ?? null;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}
