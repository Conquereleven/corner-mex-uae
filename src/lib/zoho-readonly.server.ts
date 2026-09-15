import { ZohoAccountingProvider, type ZohoRuntimeConfig } from "./zoho-accounting.server.ts";
import { PoError, type ComposedPo } from "./po/domain.ts";
import { reconcilePo } from "./po/reconciliation.ts";

/** Independent capability: never grant the accounting worker a write-capable provider for test. */
export function createZohoReadOnlyProvider(
  config: ZohoRuntimeConfig,
  environment: Record<string, string | undefined>,
  transport: typeof fetch = fetch,
) {
  const base = new URL(config.apiBaseUrl);
  if (
    environment.CORNERMEX_ZOHO_MODE !== "test" ||
    environment.CORNERMEX_ZOHO_LIVE_WRITES_ENABLED !== "false" ||
    config.product !== "books" ||
    !/^\d+$/.test(config.organizationId) ||
    !/^https:\/\/www\.zohoapis\.(com|eu|in|com\.au|jp|ca|com\.cn|sa)$/.test(config.apiBaseUrl)
  )
    throw new PoError("READ_ONLY_CONFIGURATION_REQUIRED");
  // Deliberately no automatic refresh here: use an existing READ-scoped access token.
  // OAuth credential issuance/refresh has separate custody from this GET-only capability.
  const provider = new ZohoAccountingProvider(
    { ...config, refresh: undefined },
    async (input, init) => {
      const url = new URL(String(input));
      if (
        (init?.method ?? "GET").toUpperCase() !== "GET" ||
        init?.body != null ||
        url.origin !== base.origin ||
        url.username ||
        url.password ||
        !/^\/books\/v3\/invoices(?:\/[a-zA-Z0-9_-]+)?$/.test(url.pathname) ||
        url.searchParams.get("organization_id") !== config.organizationId
      )
        throw new PoError("READ_ONLY_TRANSPORT_BLOCKED");
      return transport(url, { ...init, method: "GET", redirect: "error" });
    },
  );
  return Object.freeze({
    findByPo: provider.findByPo.bind(provider),
    getPoInvoice: provider.getPoInvoice.bind(provider),
  });
}

/** No store, create intent, completion mutation, or fallback POST exists on this path. */
export async function reconcileExistingPo(
  po: ComposedPo,
  provider: Pick<ZohoAccountingProvider, "findByPo" | "getPoInvoice">,
) {
  const matches = await provider.findByPo(po);
  if (matches.length !== 1)
    return {
      ok: false as const,
      code: matches.length ? "MULTIPLE_EXISTING_INVOICES" : "NO_EXISTING_INVOICE_READ_ONLY",
    };
  const invoice = await provider.getPoInvoice(matches[0].invoice_id);
  const result = reconcilePo(po, invoice);
  return { ok: result.matches, invoiceId: invoice.invoice_id, reasons: result.reasons };
}
