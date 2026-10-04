// CornerMex payments — canonical types.
//
// CornerMex Core owns the payment model. Mercado Pago and Clip are adapters
// behind `PaymentProvider`; neither is a source of truth. The amount charged is
// always the order's total as computed by the database — an adapter is handed
// that number and must never accept one from the browser.
//
// No imports beyond sibling modules, so this is usable in the browser bundle,
// in server functions and under node:test.

export type PaymentProviderId = "mercado_pago" | "clip";

export type ProviderEnvironment = "sandbox" | "production";

/** Honest capability level (docs/cornermex-mx/PAYMENTS.md). */
export type IntegrationState = "NOT_CONFIGURED" | "SANDBOX" | "CONNECTED" | "DEGRADED" | "LIVE";

/**
 * Normalised payment state. This is a VIEW over the canonical stored statuses
 * (payments.status / orders.payment_status), not a second source of truth —
 * see `toCanonicalStatus`.
 */
export const PAYMENT_STATES = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

/** The statuses the canonical schema stores (commerce_foundation_a2). */
export type CanonicalPaymentStatus =
  | "pending"
  | "under_review"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type NormalizedPayment = {
  provider: PaymentProviderId;
  /** The provider's id for this payment (Mercado Pago order id, Clip payment request id). */
  providerPaymentId: string;
  /** The CornerMex order reference the provider echoes back. */
  externalReference: string | null;
  /** Null when the provider status is one CornerMex does not recognise. */
  state: PaymentState | null;
  /** Provider status exactly as received, for debugging and audit. */
  rawStatus: string | null;
  rawStatusDetail: string | null;
  amount: number | null;
  currency: string | null;
  refundedAmount: number;
  /** Where to send the customer to pay, when the flow is a redirect. */
  redirectUrl: string | null;
  /** Off-line payment instructions (e.g. an OXXO ticket), when applicable. */
  instructions: { url: string | null; reference: string | null } | null;
  /** True when the provider answered an idempotent replay of an earlier request. */
  replayed: boolean;
};

/** How the customer pays. Card data never passes through CornerMex in the clear. */
export type PaymentMethodRequest =
  /** Provider-hosted page: the customer is redirected away to pay. */
  | { kind: "redirect" }
  /** A cash / transfer method that needs no card data, e.g. OXXO. */
  | { kind: "offline"; methodId: string; methodType: string }
  /** A card token minted in the browser by the provider's own SDK. */
  | { kind: "card_token"; token: string; methodId: string; installments: number };

export type CreatePaymentRequest = {
  /** CornerMex order reference. Also what reconciliation matches on. */
  orderReference: string;
  /** The order total, from the database. */
  amount: number;
  currency: string;
  /** One key per payment attempt. Repeating a key can never charge twice. */
  idempotencyKey: string;
  description: string;
  payer: { email: string; firstName?: string; lastName?: string };
  method: PaymentMethodRequest;
  returnUrls: { success: string; failure: string; pending: string };
  /** Where the provider should deliver events, when it is set per request. */
  webhookUrl?: string;
};

export type RefundRequest = {
  providerPaymentId: string;
  /** Omit for a full refund. */
  amount?: number;
  idempotencyKey: string;
};

export type WebhookRequest = {
  rawBody: string;
  /** Lower-cased header names. */
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
};

export type WebhookVerification = { ok: true } | { ok: false; reason: string };

export type PaymentEvent = {
  provider: PaymentProviderId;
  /** Stable identity used for replay protection. */
  externalEventId: string;
  /** sha256 of the raw body, hex. */
  payloadHash: string;
  providerPaymentId: string;
  externalReference: string | null;
  /**
   * The state the event CLAIMS. Never applied on its own: the processor re-reads
   * the payment from the provider and applies what the provider says.
   */
  claimedState: PaymentState | null;
  rawStatus: string | null;
  action: string | null;
};

export type ProviderHealth = {
  provider: PaymentProviderId;
  state: IntegrationState;
  environment: ProviderEnvironment | null;
  /** Names of missing configuration values. Never the values themselves. */
  missing: string[];
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** The payment-method kinds this adapter can execute. */
  readonly supports: ReadonlyArray<PaymentMethodRequest["kind"]>;
  createPayment(request: CreatePaymentRequest): Promise<NormalizedPayment>;
  getPayment(providerPaymentId: string): Promise<NormalizedPayment>;
  cancelPayment(providerPaymentId: string, idempotencyKey: string): Promise<NormalizedPayment>;
  refund(request: RefundRequest): Promise<NormalizedPayment>;
  /** Authenticates an incoming event. A failure must be answered with 401. */
  verifyWebhook(request: WebhookRequest): WebhookVerification;
  /** Parses a verified event. Null for a body that is not a payment event. */
  parseWebhook(request: WebhookRequest): PaymentEvent | null;
}

export type PaymentErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_SUPPORTED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "AMOUNT_MISMATCH"
  /**
   * A money-moving call may or may not have reached the provider. Repeat it only
   * with the SAME idempotency key, or look the payment up.
   */
  | "AMBIGUOUS_WRITE";

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly provider: PaymentProviderId | null;
  readonly status: number | null;

  constructor(
    code: PaymentErrorCode,
    message: string,
    options: { provider?: PaymentProviderId; status?: number } = {},
  ) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.provider = options.provider ?? null;
    this.status = options.status ?? null;
  }
}
