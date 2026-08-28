export const ACCOUNTING_PROVIDER = "zoho" as const;
export const ACCOUNTING_CURRENCY = "AED" as const;

export type ZohoProduct = "books" | "invoice";
export type AccountingFailureCategory =
  | "auth"
  | "validation"
  | "rate_limit"
  | "provider_unavailable"
  | "mapping_error"
  | "conflict"
  | "unknown";
export type AccountingJobStatus =
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "requires_attention"
  | "succeeded";

export type CanonicalCustomer = {
  localId: string;
  displayName: string;
  email: string;
  phone?: string | null;
  taxRegistrationNumber?: string | null;
  billingAddress?: Record<string, string | null>;
};

export type CanonicalInvoiceLine = {
  localId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPriceAed: number;
  lineTotalAed: number;
};

export type CanonicalOrderInvoice = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  customer: CanonicalCustomer;
  lines: CanonicalInvoiceLine[];
  subtotalAed: number;
  shippingAed: number;
  discountAed: number;
  taxAed: number | null;
  totalAed: number;
  currency: typeof ACCOUNTING_CURRENCY;
  createdAt: string;
};

export type ExternalCustomer = { id: string };
export type ExternalInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  url: string | null;
  pdfSupported: boolean;
  totalAed: number;
};
export type ExternalPayment = { id: string; status: string | null };

export type EntityMapping = {
  entityType: "customer" | "invoice" | "payment";
  localEntityId: string;
  externalId: string;
  metadata?: Record<string, unknown>;
};

export type AccountingProvider = {
  readonly product: ZohoProduct;
  findCustomer(customer: CanonicalCustomer): Promise<ExternalCustomer[]>;
  createCustomer(customer: CanonicalCustomer): Promise<ExternalCustomer>;
  findInvoiceByReference(orderNumber: string): Promise<ExternalInvoice[]>;
  createInvoice(input: CanonicalOrderInvoice, externalCustomerId: string): Promise<ExternalInvoice>;
  updateInvoice(
    externalInvoiceId: string,
    input: CanonicalOrderInvoice,
    externalCustomerId: string,
  ): Promise<ExternalInvoice>;
  recordPayment(input: {
    invoiceId: string;
    amountAed: number;
    provider: string;
    providerReference: string;
    paidAt: string;
  }): Promise<ExternalPayment>;
  getInvoice(externalInvoiceId: string): Promise<ExternalInvoice>;
};

export type AccountingStateStore = {
  getMapping(
    entityType: EntityMapping["entityType"],
    localEntityId: string,
  ): Promise<EntityMapping | null>;
  saveMapping(mapping: EntityMapping): Promise<void>;
  audit(event: {
    correlationId: string;
    action: string;
    outcome: "started" | "succeeded" | "failed" | "skipped";
    category?: AccountingFailureCategory;
    externalId?: string;
  }): Promise<void>;
};

export class AccountingIntegrationError extends Error {
  readonly category: AccountingFailureCategory;
  readonly retryable: boolean;
  readonly safeCode: string;
  readonly retryAfterMs?: number;

  constructor(
    category: AccountingFailureCategory,
    retryable: boolean,
    safeCode: string,
    options?: { cause?: unknown; retryAfterMs?: number },
  ) {
    super(safeCode, options);
    this.name = "AccountingIntegrationError";
    this.category = category;
    this.retryable = retryable;
    this.safeCode = safeCode;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

export function validateCanonicalInvoice(input: CanonicalOrderInvoice): void {
  if (input.currency !== ACCOUNTING_CURRENCY) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_CURRENCY_NOT_AED");
  }
  if (!input.customer.localId || !input.customer.displayName || !input.customer.email) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_CUSTOMER_REQUIRED");
  }
  if (input.taxAed === null || !Number.isFinite(input.taxAed) || input.taxAed < 0) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_TAX_DATA_REQUIRED");
  }
  if (!input.lines.length) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_LINES_REQUIRED");
  }
  for (const line of input.lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0 ||
      cents(line.unitPriceAed * line.quantity) !== cents(line.lineTotalAed)
    ) {
      throw new AccountingIntegrationError("validation", false, "ACCOUNTING_LINE_TOTAL_INVALID");
    }
  }
  const lineSubtotal = input.lines.reduce((sum, line) => sum + cents(line.lineTotalAed), 0);
  if (lineSubtotal !== cents(input.subtotalAed)) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_SUBTOTAL_MISMATCH");
  }
  const expected =
    cents(input.subtotalAed) +
    cents(input.shippingAed) -
    cents(input.discountAed) +
    cents(input.taxAed);
  if (expected !== cents(input.totalAed)) {
    throw new AccountingIntegrationError("validation", false, "ACCOUNTING_TOTAL_MISMATCH");
  }
}

async function resolveCustomer(
  input: CanonicalOrderInvoice,
  provider: AccountingProvider,
  store: AccountingStateStore,
): Promise<string> {
  const mapping = await store.getMapping("customer", input.customer.localId);
  if (mapping) return mapping.externalId;

  const matches = await provider.findCustomer(input.customer);
  if (matches.length > 1) {
    throw new AccountingIntegrationError("conflict", false, "ACCOUNTING_CUSTOMER_CONFLICT");
  }
  const customer = matches[0] ?? (await provider.createCustomer(input.customer));
  await store.saveMapping({
    entityType: "customer",
    localEntityId: input.customer.localId,
    externalId: customer.id,
  });
  return customer.id;
}

async function resolveInvoice(
  input: CanonicalOrderInvoice,
  provider: AccountingProvider,
  store: AccountingStateStore,
  externalCustomerId: string,
  syncInvoice: boolean,
): Promise<ExternalInvoice> {
  const mapping = await store.getMapping("invoice", input.orderId);
  if (mapping)
    return syncInvoice
      ? provider.updateInvoice(mapping.externalId, input, externalCustomerId)
      : provider.getInvoice(mapping.externalId);

  // Recovery lookup runs before every create. If Zoho accepted an earlier call
  // but the response timed out, retry adopts that invoice instead of duplicating it.
  const matches = await provider.findInvoiceByReference(input.orderNumber);
  if (matches.length > 1) {
    throw new AccountingIntegrationError("conflict", false, "ACCOUNTING_INVOICE_CONFLICT");
  }
  const invoice = matches[0] ?? (await provider.createInvoice(input, externalCustomerId));
  await store.saveMapping({
    entityType: "invoice",
    localEntityId: input.orderId,
    externalId: invoice.id,
    metadata: {
      number: invoice.number,
      status: invoice.status,
      url: invoice.url,
      pdfSupported: invoice.pdfSupported,
    },
  });
  return invoice;
}

export async function processOrderToInvoice(input: {
  correlationId: string;
  order: CanonicalOrderInvoice;
  provider: AccountingProvider;
  store: AccountingStateStore;
  syncInvoice?: boolean;
}): Promise<{ invoice: ExternalInvoice; payment?: ExternalPayment; recovered: boolean }> {
  const { correlationId, order, provider, store, syncInvoice = true } = input;
  await store.audit({ correlationId, action: "order_to_invoice", outcome: "started" });
  try {
    validateCanonicalInvoice(order);
    const preexistingInvoice = await store.getMapping("invoice", order.orderId);
    const customerId = await resolveCustomer(order, provider, store);
    const invoice = await resolveInvoice(order, provider, store, customerId, syncInvoice);
    let payment: ExternalPayment | undefined;

    // Stripe/payment-provider state is only consumed. Zoho never changes the
    // canonical payment state, and a payment is recorded only with provider proof.
    if (order.paymentStatus === "paid" && order.paymentProvider && order.paymentReference) {
      const paymentMappingKey = `${order.paymentProvider}:${order.paymentReference}`;
      const paymentMapping = await store.getMapping("payment", paymentMappingKey);
      if (!paymentMapping) {
        payment = await provider.recordPayment({
          invoiceId: invoice.id,
          amountAed: order.totalAed,
          provider: order.paymentProvider,
          providerReference: order.paymentReference,
          paidAt: order.createdAt,
        });
        await store.saveMapping({
          entityType: "payment",
          localEntityId: paymentMappingKey,
          externalId: payment.id,
          metadata: { status: payment.status, provider: order.paymentProvider },
        });
      }
    }
    await store.audit({
      correlationId,
      action: "order_to_invoice",
      outcome: "succeeded",
      externalId: invoice.id,
    });
    return { invoice, payment, recovered: Boolean(!preexistingInvoice) };
  } catch (error) {
    const classified = classifyAccountingError(error);
    await store.audit({
      correlationId,
      action: "order_to_invoice",
      outcome: "failed",
      category: classified.category,
    });
    throw classified;
  }
}

export function reconcileInvoice(
  canonical: CanonicalOrderInvoice,
  external: ExternalInvoice,
): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (cents(canonical.totalAed) !== cents(external.totalAed)) reasons.push("total_mismatch");
  if (!external.id) reasons.push("external_id_missing");
  return { matches: reasons.length === 0, reasons };
}

export function retryDelayMs(attempt: number, retryAfterMs?: number): number {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  const exponential = Math.min(60_000 * 2 ** (boundedAttempt - 1), 30 * 60_000);
  return Math.min(Math.max(retryAfterMs ?? 0, exponential), 30 * 60_000);
}

export function classifyAccountingError(error: unknown): AccountingIntegrationError {
  if (error instanceof AccountingIntegrationError) return error;
  if (error instanceof Error && /timeout|network|fetch/i.test(error.message)) {
    return new AccountingIntegrationError(
      "provider_unavailable",
      true,
      "ACCOUNTING_PROVIDER_UNAVAILABLE",
      { cause: error },
    );
  }
  return new AccountingIntegrationError("unknown", true, "ACCOUNTING_UNKNOWN_FAILURE", {
    cause: error,
  });
}
