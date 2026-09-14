import { minor, normalize, type ComposedPo } from "./domain.ts";
export type ZohoPoInvoice = {
  invoice_id: string;
  invoice_number?: string;
  reference_number: string;
  customer_id: string;
  currency_code: string;
  date: string;
  payment_terms: number;
  tax_treatment: string;
  place_of_supply: string;
  billing_address_id?: string;
  billing_address?: Record<string, string>;
  vat_reg_no: string;
  is_inclusive_tax: boolean;
  sub_total: number;
  tax_total: number;
  total: number;
  status: string;
  invoice_url?: string;
  line_items: Array<{
    item_id: string;
    quantity: number;
    rate: number;
    tax_id: string;
    item_total: number;
  }>;
};
const cents = (n: unknown) => {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error("INVALID_AMOUNT");
  return minor(String(n));
};
export function reconcilePo(expected: ComposedPo, actual: ZohoPoInvoice) {
  const reasons: string[] = [];
  const p = expected.payload;
  try {
    if (!actual.invoice_id) reasons.push("INVOICE_ID_MISSING");
    if (actual.customer_id !== p.customer_id) reasons.push("CUSTOMER_MISMATCH");
    // A known PO with another store label is a conflict, not permission to create again.
    if (normalize(actual.reference_number) !== normalize(p.reference_number))
      reasons.push("REFERENCE_MISMATCH");
    if (actual.currency_code !== "AED") reasons.push("CURRENCY_MISMATCH");
    if (actual.date !== p.date || actual.payment_terms !== p.payment_terms)
      reasons.push("DATE_TERMS_MISMATCH");
    if (
      actual.tax_treatment !== p.tax_treatment ||
      actual.vat_reg_no !== p.vat_reg_no ||
      actual.place_of_supply !== p.place_of_supply ||
      actual.is_inclusive_tax !== false
    )
      reasons.push("TAX_CONTEXT_MISMATCH");
    if (actual.billing_address_id && actual.billing_address_id !== p.billing_address_id)
      reasons.push("BILLING_MISMATCH");
    for (const [key, value] of Object.entries(expected.expected.billingAddress)) {
      if (normalize(actual.billing_address?.[key] ?? "") !== normalize(value))
        reasons.push("BILLING_MISMATCH");
    }
    if (
      !["draft", "sent", "viewed", "unpaid", "overdue", "partially_paid", "paid"].includes(
        actual.status,
      )
    )
      reasons.push("INVOICE_STATUS_INVALID");
    if (
      cents(actual.sub_total) !== minor(expected.expected.subtotal) ||
      cents(actual.tax_total) !== minor(expected.expected.vat) ||
      cents(actual.total) !== minor(expected.expected.total)
    )
      reasons.push("TOTAL_MISMATCH");
    if (actual.line_items.length !== p.line_items.length) reasons.push("LINES_MISMATCH");
    else
      p.line_items.forEach((l, i) => {
        const a = actual.line_items[i];
        if (
          a.item_id !== l.item_id ||
          a.quantity !== l.quantity ||
          cents(a.rate) !== cents(l.rate) ||
          a.tax_id !== l.tax_id ||
          cents(a.item_total) !== minor(expected.expected.lineNets[i])
        )
          reasons.push("LINE_MISMATCH");
      });
  } catch {
    reasons.push("PROVIDER_RESPONSE_INCOMPLETE");
  }
  return { matches: reasons.length === 0, reasons: [...new Set(reasons)] };
}
