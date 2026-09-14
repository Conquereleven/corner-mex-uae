import { PoError, normalize, type ComposedPo } from "./po/domain.ts";
import type { ZohoPoInvoice } from "./po/reconciliation.ts";
import { ZohoTokenSource, type ZohoRefreshConfig } from "./zoho-token.server.ts";
import {
  AccountingIntegrationError,
  type AccountingProvider,
  type CanonicalCustomer,
  type CanonicalOrderInvoice,
  type ExternalInvoice,
  type ZohoProduct,
} from "./accounting-integration.ts";

// Repository-only implementation. A separate reviewed activation change must
// turn this constant on after Intermex confirms product, organization, data
// center and UAE VAT mappings. Credentials alone can never authorize writes.
export const ZOHO_LIVE_ACTIVATION_AUTHORIZED = false as const;

export type ZohoRuntimeConfig = {
  product: ZohoProduct;
  organizationId: string;
  apiBaseUrl: string;
  accessToken: string;
  vatTaxId: string;
  refresh?: ZohoRefreshConfig;
};

export type ZohoActivationState =
  | { ready: true; config: ZohoRuntimeConfig }
  | { ready: false; reasons: string[] };

export function evaluateZohoActivation(
  environment: Record<string, string | undefined> = process.env,
): ZohoActivationState {
  const reasons: string[] = [];
  if (!ZOHO_LIVE_ACTIVATION_AUTHORIZED) reasons.push("repository_activation_not_authorized");
  if (environment.CORNERMEX_ZOHO_LIVE_WRITES_ENABLED !== "true")
    reasons.push("live_writes_disabled");
  const product = environment.CORNERMEX_ZOHO_PRODUCT;
  if (product !== "books" && product !== "invoice") reasons.push("product_unconfirmed");
  if (!environment.CORNERMEX_ZOHO_ORGANIZATION_ID) reasons.push("organization_unconfirmed");
  if (!environment.CORNERMEX_ZOHO_API_BASE_URL) reasons.push("data_center_unconfirmed");
  if (!environment.CORNERMEX_ZOHO_ACCESS_TOKEN) reasons.push("credentials_not_configured");
  if (!environment.CORNERMEX_ZOHO_VAT_TAX_ID) reasons.push("vat_mapping_unconfirmed");
  if (reasons.length) return { ready: false, reasons };
  return {
    ready: true,
    config: {
      product: product as ZohoProduct,
      organizationId: environment.CORNERMEX_ZOHO_ORGANIZATION_ID as string,
      apiBaseUrl: environment.CORNERMEX_ZOHO_API_BASE_URL as string,
      accessToken: environment.CORNERMEX_ZOHO_ACCESS_TOKEN as string,
      vatTaxId: environment.CORNERMEX_ZOHO_VAT_TAX_ID as string,
    },
  };
}

type FetchLike = typeof fetch;

function safeRetryAfter(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

function toInvoice(value: Record<string, unknown>): ExternalInvoice {
  return {
    id: String(value.invoice_id ?? ""),
    referenceNumber: value.reference_number ? String(value.reference_number) : null,
    currency: value.currency_code ? String(value.currency_code) : null,
    number: value.invoice_number ? String(value.invoice_number) : null,
    status: value.status ? String(value.status) : null,
    url: value.invoice_url ? String(value.invoice_url) : null,
    issuedDate: value.date ? String(value.date) : null,
    pdfSupported: true,
    totalAed: Number(value.total ?? 0),
  };
}

export class ZohoAccountingProvider implements AccountingProvider {
  readonly product: ZohoProduct;
  private readonly config: ZohoRuntimeConfig;
  private readonly transport: FetchLike;
  private readonly tokens: ZohoTokenSource;

  constructor(config: ZohoRuntimeConfig, transport: FetchLike = fetch) {
    this.config = config;
    this.transport = transport;
    this.product = config.product;
    this.tokens = new ZohoTokenSource(config.accessToken, config.refresh, transport);
  }

  private async request(
    path: string,
    init: RequestInit = {},
    refreshed = false,
  ): Promise<Record<string, unknown>> {
    const base = this.config.apiBaseUrl.replace(/\/$/, "");
    const productPath = this.product === "books" ? "books" : "invoice";
    const url = new URL(`${base}/${productPath}/v3/${path.replace(/^\//, "")}`);
    if (this.product === "books")
      url.searchParams.set("organization_id", this.config.organizationId);
    const headers = new Headers(init.headers);
    const token = this.tokens.current();
    headers.set("Authorization", `Zoho-oauthtoken ${token}`);
    headers.set("Content-Type", "application/json");
    if (this.product === "invoice")
      headers.set("X-com-zoho-invoice-organizationid", this.config.organizationId);

    let response: Response;
    try {
      response = await this.transport(url, {
        ...init,
        redirect: "error",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new AccountingIntegrationError(
        "provider_unavailable",
        true,
        "ZOHO_TRANSPORT_UNAVAILABLE",
        { cause: error },
      );
    }
    if (response.status === 401 && !refreshed) {
      await this.tokens.refresh(token);
      return this.request(path, init, true);
    }
    if (response.status === 401 || response.status === 403)
      throw new AccountingIntegrationError("auth", false, "ZOHO_AUTH_FAILED");
    if (response.status === 429)
      throw new AccountingIntegrationError("rate_limit", true, "ZOHO_RATE_LIMITED", {
        retryAfterMs: safeRetryAfter(response),
      });
    if (response.status >= 500)
      throw new AccountingIntegrationError(
        "provider_unavailable",
        true,
        "ZOHO_PROVIDER_UNAVAILABLE",
      );
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || Number(body.code ?? 0) !== 0) {
      throw new AccountingIntegrationError("validation", false, "ZOHO_REQUEST_REJECTED");
    }
    return body;
  }

  private assertPoScope(po: ComposedPo) {
    if (this.product !== "books" || po.organizationId !== this.config.organizationId)
      throw new PoError("ZOHO_PO_SCOPE_MISMATCH");
  }

  async findByPo(po: ComposedPo): Promise<ZohoPoInvoice[]> {
    this.assertPoScope(po);
    const matches: ZohoPoInvoice[] = [];
    // search_text catches historical PO + store suffixes, including operator typos.
    // Never interpret a truncated search as proof that no invoice exists.
    for (let page = 1; page <= 20; page++) {
      const query = new URLSearchParams({
        customer_id: po.payload.customer_id,
        search_text: po.poNumber,
        page: String(page),
        per_page: "200",
      });
      const body = await this.request(`invoices?${query}`);
      if (!Array.isArray(body.invoices)) throw new PoError("INVOICE_SEARCH_INCOMPLETE");
      for (const row of body.invoices as Record<string, unknown>[]) {
        const ref = normalize(String(row.reference_number ?? ""));
        if (ref === po.poNumber || ref.startsWith(po.poNumber + " ")) {
          if (String(row.customer_id) !== po.payload.customer_id || !row.invoice_id)
            throw new PoError("INVOICE_SEARCH_INCOMPLETE");
          matches.push(await this.getPoInvoice(String(row.invoice_id)));
        }
      }
      const context = body.page_context as { has_more_page?: boolean } | undefined;
      if (context?.has_more_page === false) return matches;
      if (context?.has_more_page !== true) throw new PoError("INVOICE_SEARCH_INCOMPLETE");
    }
    throw new PoError("INVOICE_SEARCH_LIMIT");
  }

  async createPoInvoice(po: ComposedPo): Promise<ZohoPoInvoice> {
    this.assertPoScope(po);
    const result = await this.request("invoices?send=false", {
      method: "POST",
      body: JSON.stringify(po.payload),
    });
    if (!result.invoice || typeof result.invoice !== "object")
      throw new PoError("CREATE_OUTCOME_UNKNOWN");
    return result.invoice as ZohoPoInvoice;
  }

  async getPoInvoice(id: string): Promise<ZohoPoInvoice> {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new PoError("INVOICE_ID_INVALID");
    const result = await this.request(`invoices/${encodeURIComponent(id)}`);
    if (!result.invoice || typeof result.invoice !== "object")
      throw new PoError("INVOICE_RESPONSE_INCOMPLETE");
    return result.invoice as ZohoPoInvoice;
  }

  async findCustomer(customer: CanonicalCustomer) {
    const body = await this.request(`contacts?search_text=${encodeURIComponent(customer.email)}`);
    return ((body.contacts as Array<Record<string, unknown>> | undefined) ?? [])
      .filter(
        (contact) =>
          typeof contact.email === "string" &&
          String(contact.email).toLowerCase() === customer.email.toLowerCase(),
      )
      .map((contact) => ({ id: String(contact.contact_id) }));
  }

  async createCustomer(customer: CanonicalCustomer) {
    const body = await this.request("contacts", {
      method: "POST",
      body: JSON.stringify({
        contact_name: customer.displayName,
        contact_type: "customer",
        currency_code: "AED",
        email: customer.email,
        phone: customer.phone ?? undefined,
        vat_reg_no: customer.taxRegistrationNumber ?? undefined,
        notes: `CornerMex:${customer.localId}`,
      }),
    });
    const contact = body.contact as Record<string, unknown>;
    return { id: String(contact.contact_id) };
  }

  async findInvoiceByReference(orderNumber: string) {
    const body = await this.request(`invoices?reference_number=${encodeURIComponent(orderNumber)}`);
    return ((body.invoices as Array<Record<string, unknown>> | undefined) ?? []).map(toInvoice);
  }

  private invoicePayload(input: CanonicalOrderInvoice, externalCustomerId: string) {
    return {
      customer_id: externalCustomerId,
      reference_number: input.orderNumber,
      currency_code: "AED",
      date: input.createdAt.slice(0, 10),
      line_items: input.lines.map((line) => ({
        name: line.name,
        description: line.description ?? undefined,
        rate: line.unitPriceAed,
        quantity: line.quantity,
        tax_id: this.config.vatTaxId,
      })),
      shipping_charge: input.shippingAed,
      discount: input.discountAed,
      discount_type: "entity_level",
      is_discount_before_tax: true,
      notes: `CornerMex order ${input.orderNumber}; payment authority remains ${input.paymentProvider ?? "pending"}.`,
    };
  }

  async createInvoice(input: CanonicalOrderInvoice, externalCustomerId: string) {
    const body = await this.request("invoices?send=false", {
      method: "POST",
      body: JSON.stringify(this.invoicePayload(input, externalCustomerId)),
    });
    return toInvoice(body.invoice as Record<string, unknown>);
  }

  async updateInvoice(id: string, input: CanonicalOrderInvoice, externalCustomerId: string) {
    const body = await this.request(`invoices/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(this.invoicePayload(input, externalCustomerId)),
    });
    return toInvoice(body.invoice as Record<string, unknown>);
  }

  async findPaymentByReference(providerReference: string) {
    const body = await this.request(
      `customerpayments?reference_number=${encodeURIComponent(providerReference)}`,
    );
    return (
      (body.customerpayments as Array<Record<string, unknown>> | undefined) ??
      (body.payments as Array<Record<string, unknown>> | undefined) ??
      []
    ).map((payment) => ({
      id: String(payment.payment_id ?? payment.customerpayment_id ?? ""),
      status: payment.status ? String(payment.status) : null,
    }));
  }

  async recordPayment(input: {
    invoiceId: string;
    customerId: string;
    amountAed: number;
    provider: string;
    providerReference: string;
    paidAt: string;
  }) {
    const body = await this.request("customerpayments", {
      method: "POST",
      body: JSON.stringify({
        customer_id: input.customerId,
        payment_mode:
          input.provider.toLowerCase() === "stripe" || input.provider.toLowerCase() === "card"
            ? "creditcard"
            : input.provider.toLowerCase() === "bank_transfer"
              ? "banktransfer"
              : input.provider.toLowerCase() === "cod"
                ? "cash"
                : "others",
        amount: input.amountAed,
        date: input.paidAt.slice(0, 10),
        reference_number: input.providerReference,
        invoices: [{ invoice_id: input.invoiceId, amount_applied: input.amountAed }],
      }),
    });
    const payment = (body.payment ?? body.customerpayment) as Record<string, unknown>;
    return {
      id: String(payment.payment_id ?? payment.customerpayment_id ?? ""),
      status: payment.status ? String(payment.status) : null,
    };
  }

  async getInvoice(id: string) {
    const body = await this.request(`invoices/${encodeURIComponent(id)}`);
    return toInvoice(body.invoice as Record<string, unknown>);
  }
}

export function createActivatedZohoProvider(
  environment: Record<string, string | undefined> = process.env,
  transport: FetchLike = fetch,
): ZohoAccountingProvider {
  const activation = evaluateZohoActivation(environment);
  if (!activation.ready) {
    throw new AccountingIntegrationError("auth", false, "ZOHO_LIVE_ACTIVATION_BLOCKED");
  }
  return new ZohoAccountingProvider(activation.config, transport);
}
