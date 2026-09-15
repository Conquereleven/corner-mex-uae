// GET-only operator command. Never import the accounting worker or write to Supabase.
import { readFile } from "node:fs/promises";
import { createZohoReadOnlyProvider } from "../../src/lib/zoho-readonly.server.ts";
import { invoiceTrn } from "../../src/lib/po/reconciliation.ts";
const facts = JSON.parse(
  await readFile(
    new URL("../../docs/intermex-zoho-test-activation/observed-facts.json", import.meta.url),
    "utf8",
  ),
);
if (!process.env.CORNERMEX_ZOHO_READONLY_ACCESS_TOKEN) {
  console.log(
    JSON.stringify({
      ok: false,
      blocked: true,
      code: "READ_ONLY_OAUTH_REQUIRED",
      providerCalls: 0,
    }),
  );
  process.exitCode = 2;
} else {
  try {
    const provider = createZohoReadOnlyProvider(
      {
        product: "books",
        organizationId: facts.organizationId,
        apiBaseUrl: facts.apiBaseUrl,
        accessToken: process.env.CORNERMEX_ZOHO_READONLY_ACCESS_TOKEN,
        vatTaxId: facts.taxId,
      },
      process.env,
    );
    const actual = await provider.getPoInvoice(facts.invoiceId);
    const checks = {
      invoice: actual.invoice_id === facts.invoiceId,
      number: actual.invoice_number === facts.invoiceNumber,
      customer: actual.customer_id === facts.customerId,
      reference: actual.reference_number === facts.referenceNumber,
      currency: actual.currency_code === facts.currency,
      date: actual.date === facts.invoiceDate,
      terms: actual.payment_terms === 0,
      trn: invoiceTrn(actual) === facts.customerTrn,
      placeOfSupply: actual.place_of_supply === facts.placeOfSupply,
      billing:
        actual.billing_address?.address === facts.billingAddress.address &&
        actual.billing_address?.country === facts.billingAddress.country &&
        actual.billing_address?.state === facts.billingAddress.state,
      subtotal: actual.sub_total === facts.subtotal,
      vat: actual.tax_total === facts.vat,
      total: actual.total === facts.total,
      line:
        actual.line_items?.length === 1 &&
        actual.line_items[0].item_id === facts.itemId &&
        actual.line_items[0].tax_id === facts.taxId &&
        actual.line_items[0].quantity === facts.quantity &&
        actual.line_items[0].rate === facts.rate &&
        actual.line_items[0].item_total === facts.subtotal,
    };
    const ok = Object.values(checks).every(Boolean);
    console.log(
      JSON.stringify(
        {
          ok,
          mode: "test",
          accountingWrites: 0,
          checks,
          fullMappingReconciliation: false,
          remaining: [
            "approval of place of supply policy for future orders",
            "original PO PDF certification",
          ],
        },
        null,
        2,
      ),
    );
    if (!ok) process.exitCode = 1;
  } catch {
    // Never print provider response, token, request headers, or transport causes.
    console.log(JSON.stringify({ ok: false, blocked: true, code: "READ_ONLY_INSPECTION_FAILED" }));
    process.exitCode = 1;
  }
}
