import { PoError, type ComposedPo } from "./domain.ts";
import { reconcilePo, type ZohoPoInvoice } from "./reconciliation.ts";
export interface PoProvider {
  findByPo(po: ComposedPo): Promise<ZohoPoInvoice[]>;
  createPoInvoice(po: ComposedPo): Promise<ZohoPoInvoice>;
  getPoInvoice(id: string): Promise<ZohoPoInvoice>;
}
export interface PoExecutionStore {
  assert(): Promise<void>;
  beginCreate(): Promise<boolean>;
  complete(invoice: ZohoPoInvoice): Promise<void>;
  attention(code: string): Promise<void>;
}
/** Shared GO-LIVE-2 rule: a durable intent precedes HTTP; ambiguous POSTs are lookup-only forever. */
export async function processPo(po: ComposedPo, provider: PoProvider, store: PoExecutionStore) {
  try {
    await store.assert();
    const existing = await provider.findByPo(po);
    if (existing.length > 1) throw new PoError("MULTIPLE_EXISTING_INVOICES");
    let invoice = existing[0];
    if (!invoice) {
      await store.assert();
      if (!(await store.beginCreate())) throw new PoError("CREATE_OUTCOME_UNKNOWN");
      invoice = await provider.createPoInvoice(po);
      if (!invoice.invoice_id) throw new PoError("CREATE_OUTCOME_UNKNOWN");
    }
    await store.assert();
    invoice = await provider.getPoInvoice(invoice.invoice_id);
    const result = reconcilePo(po, invoice);
    if (!result.matches) throw new PoError(`RECONCILIATION_${result.reasons[0]}`);
    await store.complete(invoice);
    return { ok: true as const, invoiceId: invoice.invoice_id };
  } catch (e) {
    const code = e instanceof PoError ? e.code : "PROVIDER_OUTCOME_REQUIRES_ATTENTION";
    await store.attention(code);
    return { ok: false as const, code };
  }
}
