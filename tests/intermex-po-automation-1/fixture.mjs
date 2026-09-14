export const source = `INTERMEX PO v1
PO: B202609-37789
Customer: Majid Al Futtaim Cinemas LLC
TRN: 100000000000001
Store: AJMAN CITY CENTRE CINEMA STORE
Invoice Date: 2026-09-13
Currency: AED
Terms: 0
Item | PR 0077 | Sweet Nachos 1kg | kg | 2.50 | 47.00 | 117.50 | 5 | 5.88 | 123.38
Subtotal: 117.50
VAT: 5.88
Total: 123.38`;
export function mappings() {
  return {
    version: "intermex-po-v1",
    mode: "test",
    organizationId: "offline-fixture-org",
    evidenceRef: "offline representative fixture; not production-approved",
    approvedAt: "2026-01-01T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
    testOrganizationVerified: true,
    customers: [
      {
        key: "maf",
        aliases: ["Majid Al Futtaim Cinemas LLC"],
        trn: "100000000000001",
        customerId: "fixture-customer",
        billingAddressId: "fixture-billing",
        billingAddress: {
          address: "Fixture street",
          city: "Dubai",
          state: "Dubai",
          country: "United Arab Emirates",
          zip: "60811",
          street2: "",
        },
        invoiceDatePolicy: "po_date",
        taxTreatment: "vat_registered",
        currency: "AED",
        paymentTerms: 0,
        locations: [
          {
            key: "ajman",
            aliases: ["AJMAN CITY CENTRE CINEMA STORE", "AJMAN CITY CENTRE CINEME STORE"],
            orderLabel: "AJMAN CITY CENTRE CINEMA STORE",
            placeOfSupply: "DU",
          },
        ],
        products: [
          {
            aliases: ["PR 0077", "Sweet Nachos 1kg", "Sweet Nachos"],
            itemId: "fixture-item",
            sku: "PR 0077",
            unit: "kg",
            unitAliases: ["Kilogram"],
            approvedRate: "47.00",
            taxId: "fixture-vat",
            vatPercent: "5",
          },
        ],
      },
    ],
  };
}
export function invoice(po) {
  return {
    ...po.payload,
    billing_address: po.expected.billingAddress,
    invoice_id: "fixture-invoice",
    invoice_number: "TEST-001",
    sub_total: 117.5,
    tax_total: 5.88,
    total: 123.38,
    status: "draft",
    line_items: po.payload.line_items.map((l) => ({ ...l, item_total: 117.5 })),
  };
}
export function pdf(text = source) {
  const esc = (s) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const stream = `BT /F1 8 Tf 20 800 Td 13 TL\n${text
    .split("\n")
    .map((s) => `(${esc(s)}) Tj T*`)
    .join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((s, i) => {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${s}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(output));
}

export const mafSource = `Majid Al Futtaim Cinemas LLC
PURCHASE ORDER
SUPPLIER: Intermex Pro General Trading LLC
Bill To: Majid Al Futtaim Cinemas LLC
TRN # 100000000000001
Purchase Order No: B202609-37789
Order Date: 13.09.2026
Delivery Date: 14.09.2026
Request No: i26-226913
Stock Location: AJMAN CITY CENTRE CINEMA STORE
No. Item Code Item Description Qty Unit Unit Price Price aft Disc Net Total VAT 5% Total
1 Sweet Nachos 2.50 Kilogram 47.00 47.00 117.50 5.88 123.38
GRAND TOTAL INCLUDING VAT (AFTER DISCOUNT) For AJMAN CITY CENTRE CINEMA STORE AED 123.38
GROSS TOTAL AED 117.50
DISCOUNT TOTAL AED 0.00
NET TOTAL (AFTER DISCOUNT) AED 117.50`;
