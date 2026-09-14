import {
  MappingSchema,
  PoError,
  PoSchema,
  normalize,
  minor,
  type PurchaseOrder,
} from "./domain.ts";
/** MAF layout transcribed from the supplied video. Byte-level PDF fixture still needs customer sign-off. */
export function parseMafPoText(text: string, mappingInput: unknown): PurchaseOrder {
  const s = text.replace(/\s+/g, " ").trim(),
    m = MappingSchema.safeParse(mappingInput);
  if (!m.success) throw new PoError("MAPPINGS_REQUIRED");
  if (!/Majid Al Futtaim Cinemas LLC/i.test(s) || !/PURCHASE ORDER/.test(s))
    throw new PoError("DOCUMENT_LAYOUT_UNSUPPORTED");
  const take = (re: RegExp, code: string) => {
    const matches = [...s.matchAll(new RegExp(re.source, "gi"))];
    if (matches.length !== 1) throw new PoError(code);
    return matches[0];
  };
  const poNumber = take(/Purchase Order No\s*:\s*(B\d{6}-\d+)/, "PO_NUMBER_AMBIGUOUS")[1];
  const date = take(/Order Date\s*:\s*(\d{2})\.(\d{2})\.(\d{4})/, "PO_DATE_AMBIGUOUS");
  const trn = take(/TRN\s*#?\s*:?\s*(\d{15})/, "PO_TRN_AMBIGUOUS")[1];
  const customers = m.data.customers.filter(
    (c) => c.trn === trn && c.aliases.some((a) => normalize(a) === "MAJID AL FUTTAIM CINEMAS LLC"),
  );
  if (customers.length !== 1) throw new PoError("CUSTOMER_MAPPING_AMBIGUOUS");
  const customer = customers[0];
  if (customer.invoiceDatePolicy !== "po_date") throw new PoError("INVOICE_DATE_POLICY_REQUIRED");
  const location = take(
    /Stock Location\s*:\s*(.*?)\s+No\.?\s+Item Code\s+Item Description\s+Qty\s+Unit\s+Unit Price\s+Price aft Disc\s+Net Total\s+VAT\s+5%\s+Total/,
    "MAF_TABLE_HEADER_UNSUPPORTED",
  )[1];
  const table = take(
    /No\.?\s+Item Code\s+Item Description\s+Qty\s+Unit\s+Unit Price\s+Price aft Disc\s+Net Total\s+VAT\s+5%\s+Total\s+(.*?)\s+GRAND TOTAL/,
    "MAF_TABLE_AMBIGUOUS",
  )[1];
  const row =
    /(\d+)\s+(.+?)\s+(\d+\.\d{2})\s+([A-Za-z]+)\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+(\d+\.\d{2})(?:\s+|$)/g;
  let end = 0,
    vat = 0n;
  const lines: PurchaseOrder["lines"] = [];
  for (const match of table.matchAll(row)) {
    if (match.index !== end || Number(match[1]) !== lines.length + 1)
      throw new PoError("MAF_LINE_LAYOUT_UNSUPPORTED");
    end = match.index + match[0].length;
    if (minor(match[5]) !== minor(match[6])) throw new PoError("DISCOUNT_POLICY_REQUIRED");
    vat += minor(match[8]);
    lines.push({
      sku: match[2].trim(),
      description: match[2].trim(),
      quantity: match[3],
      unit: match[4],
      rate: match[6],
      net: match[7],
      vat: match[8],
      total: match[9],
      vatPercent: "5",
    });
  }
  if (end !== table.length || !lines.length) throw new PoError("MAF_LINE_LAYOUT_UNSUPPORTED");
  const subtotal = take(/GROSS TOTAL\s+AED\s+(\d+\.\d{2})/, "MAF_TOTALS_UNSUPPORTED")[1];
  const discount = take(/DISCOUNT TOTAL\s+AED\s+(\d+\.\d{2})/, "MAF_TOTALS_UNSUPPORTED")[1];
  const net = take(
    /NET TOTAL\s*\(AFTER DISCOUNT\)\s+AED\s+(\d+\.\d{2})/,
    "MAF_TOTALS_UNSUPPORTED",
  )[1];
  const total = take(
    /GRAND TOTAL INCLUDING VAT\s*\(AFTER DISCOUNT\).*?\bAED\s+(\d+\.\d{2})/,
    "MAF_TOTALS_UNSUPPORTED",
  )[1];
  if (minor(discount) !== 0n || minor(net) !== minor(subtotal))
    throw new PoError("DISCOUNT_POLICY_REQUIRED");
  return PoSchema.parse({
    poNumber,
    customer: "Majid Al Futtaim Cinemas LLC",
    customerTrn: trn,
    location,
    invoiceDate: `${date[3]}-${date[2]}-${date[1]}`,
    currency: "AED",
    paymentTerms: customer.paymentTerms,
    lines,
    subtotal,
    vat: `${vat / 100n}.${String(vat % 100n).padStart(2, "0")}`,
    total,
  });
}
