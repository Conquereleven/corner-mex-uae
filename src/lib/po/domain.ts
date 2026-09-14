import { z } from "zod";

export const PO_VERSION = "intermex-po-v1";
export class PoError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
const text = z.string().trim().min(1).max(200);
const decimal = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/);
const money = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const PoSchema = z
  .object({
    poNumber: text.regex(/^[A-Za-z0-9][A-Za-z0-9 /_.-]*$/),
    customer: text,
    customerTrn: z.string().regex(/^\d{15}$/),
    location: text,
    invoiceDate: date,
    currency: z.literal("AED"),
    paymentTerms: z.number().int().min(0).max(100),
    lines: z
      .array(
        z
          .object({
            sku: text,
            description: text,
            unit: text,
            quantity: decimal,
            rate: money,
            net: money,
            vat: money,
            vatPercent: z.literal("5"),
            total: money,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    subtotal: money,
    vat: money,
    total: money,
  })
  .strict();
export type PurchaseOrder = z.infer<typeof PoSchema>;
export const MappingSchema = z
  .object({
    version: z.literal(PO_VERSION),
    mode: z.enum(["test", "live"]),
    organizationId: text,
    evidenceRef: text,
    approvedAt: z.string().datetime(),
    validUntil: z.string().datetime(),
    // Test needs separate organizational custody, never a label on the live organization.
    testOrganizationVerified: z.boolean(),
    customers: z
      .array(
        z
          .object({
            key: text,
            aliases: z.array(text).min(1),
            trn: z.string().regex(/^\d{15}$/),
            customerId: text,
            billingAddressId: text,
            billingAddress: z
              .object({
                address: text,
                city: text,
                state: text,
                country: text,
                zip: z.string().max(30),
                street2: z.string().max(200),
              })
              .strict(),
            invoiceDatePolicy: z.enum(["explicit", "po_date"]),
            taxTreatment: z.literal("vat_registered"),
            currency: z.literal("AED"),
            paymentTerms: z.number().int().min(0).max(100),
            locations: z
              .array(
                z
                  .object({
                    key: text,
                    aliases: z.array(text).min(1),
                    orderLabel: text,
                    placeOfSupply: z.enum(["AB", "AJ", "DU", "FU", "RA", "SH", "UM"]),
                    shippingAddressId: text.optional(),
                  })
                  .strict(),
              )
              .min(1),
            products: z
              .array(
                z
                  .object({
                    aliases: z.array(text).min(1),
                    itemId: text,
                    sku: text,
                    unit: text,
                    unitAliases: z.array(text).default([]),
                    approvedRate: money,
                    taxId: text,
                    vatPercent: z.literal("5"),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type PoMappings = z.infer<typeof MappingSchema>;
export const normalize = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
export function minor(s: string, scale = 2): bigint {
  if (!/^\d+(\.\d+)?$/.test(s)) throw new PoError("DECIMAL_INVALID");
  const [a, b = ""] = s.split(".");
  if (b.length > scale) throw new PoError("DECIMAL_PRECISION");
  return BigInt(a) * 10n ** BigInt(scale) + BigInt(b.padEnd(scale, "0"));
}
const rounded = (n: bigint, denominator: bigint) => (n + denominator / 2n) / denominator;
const unique = <T>(items: T[], code: string): T => {
  if (items.length !== 1) throw new PoError(code);
  return items[0];
};
export function composePo(raw: unknown, mappingInput: unknown, now = new Date()) {
  const parsed = PoSchema.safeParse(raw);
  if (!parsed.success) throw new PoError("PO_SCHEMA_INVALID");
  const parsedMappings = MappingSchema.safeParse(mappingInput);
  if (!parsedMappings.success) throw new PoError("MAPPINGS_INVALID");
  const po = parsed.data,
    mappings = parsedMappings.data;
  if (
    Date.parse(mappings.approvedAt) > now.getTime() ||
    Date.parse(mappings.validUntil) <= now.getTime()
  )
    throw new PoError("MAPPINGS_EXPIRED");
  if (
    mappings.mode === "test" &&
    (!mappings.testOrganizationVerified || mappings.organizationId === "773588238")
  )
    throw new PoError("TEST_ORGANIZATION_UNVERIFIED");
  const customer = unique(
    mappings.customers.filter(
      (c) =>
        c.trn === po.customerTrn && c.aliases.some((a) => normalize(a) === normalize(po.customer)),
    ),
    "CUSTOMER_MAPPING_AMBIGUOUS",
  );
  const location = unique(
    customer.locations.filter((l) =>
      l.aliases.some((a) => normalize(a) === normalize(po.location)),
    ),
    "LOCATION_MAPPING_AMBIGUOUS",
  );
  if (customer.paymentTerms !== po.paymentTerms) throw new PoError("PAYMENT_TERMS_MISMATCH");
  let subtotal = 0n,
    tax = 0n;
  const lineItems = po.lines.map((line) => {
    const product = unique(
      customer.products.filter((p) => p.aliases.some((a) => normalize(a) === normalize(line.sku))),
      "SKU_MAPPING_AMBIGUOUS",
    );
    if (
      normalize(product.unit) !== normalize(line.unit) &&
      !(product.unitAliases ?? []).some((a) => normalize(a) === normalize(line.unit))
    )
      throw new PoError("UNIT_MISMATCH");
    if (minor(product.approvedRate) !== minor(line.rate)) throw new PoError("PRICE_MISMATCH");
    const qty = minor(line.quantity, 4),
      rate = minor(line.rate);
    if (qty <= 0n || rate <= 0n) throw new PoError("LINE_NON_POSITIVE");
    const net = rounded(qty * rate, 10000n),
      vat = rounded(net * 5n, 100n);
    if (net !== minor(line.net) || vat !== minor(line.vat) || net + vat !== minor(line.total))
      throw new PoError("LINE_TOTAL_MISMATCH");
    subtotal += net;
    tax += vat;
    return {
      item_id: product.itemId,
      name: product.sku,
      description: line.description,
      quantity: Number(line.quantity),
      rate: Number(line.rate),
      tax_id: product.taxId,
    };
  });
  if (
    subtotal !== minor(po.subtotal) ||
    tax !== minor(po.vat) ||
    subtotal + tax !== minor(po.total)
  )
    throw new PoError("PO_TOTAL_MISMATCH");
  const reference = `${normalize(po.poNumber)} ${location.orderLabel}`;
  if (reference.length > 100) throw new PoError("ORDER_NUMBER_TOO_LONG");
  return {
    version: PO_VERSION,
    mode: mappings.mode,
    organizationId: mappings.organizationId,
    customerKey: customer.key,
    locationKey: location.key,
    poNumber: normalize(po.poNumber),
    mappingEvidence: mappings.evidenceRef,
    mappingValidUntil: mappings.validUntil,
    identity: [mappings.mode, mappings.organizationId, customer.customerId, normalize(po.poNumber)],
    expected: {
      subtotal: po.subtotal,
      vat: po.vat,
      total: po.total,
      lineNets: po.lines.map((l) => l.net),
      billingAddress: customer.billingAddress,
    },
    payload: {
      customer_id: customer.customerId,
      reference_number: reference,
      currency_code: "AED",
      date: po.invoiceDate,
      payment_terms: po.paymentTerms,
      payment_terms_label: po.paymentTerms === 0 ? "Due on Receipt" : `Net ${po.paymentTerms}`,
      billing_address_id: customer.billingAddressId,
      ...(location.shippingAddressId ? { shipping_address_id: location.shippingAddressId } : {}),
      tax_treatment: customer.taxTreatment,
      vat_reg_no: customer.trn,
      place_of_supply: location.placeOfSupply,
      is_inclusive_tax: false,
      line_items: lineItems,
      notes: "THANKS FOR YOUR SUPPORT!",
    },
  };
}
export type ComposedPo = ReturnType<typeof composePo>;

/** Explicit, versioned interchange grammar. Unknown PDF layouts go to attention, never guessed. */
export function parsePoText(value: string): PurchaseOrder {
  if (value.length > 200_000 || !value.trim()) throw new PoError("DOCUMENT_TEXT_INVALID");
  const rows = value
    .replace(/\r/g, "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const fields: Record<string, string> = {},
    lines: Record<string, string>[] = [];
  const labels = [
    "PO",
    "Customer",
    "TRN",
    "Store",
    "Invoice Date",
    "Currency",
    "Terms",
    "Subtotal",
    "VAT",
    "Total",
  ];
  for (const row of rows) {
    if (row === "INTERMEX PO v1") continue;
    if (row.startsWith("Item |")) {
      const values = row
        .split("|")
        .map((v) => v.trim())
        .slice(1);
      if (values.length !== 9) throw new PoError("LINE_LAYOUT_UNSUPPORTED");
      lines.push(
        Object.fromEntries(
          [
            "sku",
            "description",
            "unit",
            "quantity",
            "rate",
            "net",
            "vatPercent",
            "vat",
            "total",
          ].map((k, i) => [k, values[i]]),
        ),
      );
      continue;
    }
    const index = row.indexOf(":"),
      key = row.slice(0, index);
    if (index < 0 || !labels.includes(key) || key in fields)
      throw new PoError("DOCUMENT_LAYOUT_UNSUPPORTED");
    fields[key] = row.slice(index + 1).trim();
  }
  if (labels.some((k) => !fields[k]) || !/^\d{1,3}$/.test(fields.Terms))
    throw new PoError("PO_FIELDS_MISSING");
  const result = PoSchema.safeParse({
    poNumber: fields.PO,
    customer: fields.Customer,
    customerTrn: fields.TRN,
    location: fields.Store,
    invoiceDate: fields["Invoice Date"],
    currency: fields.Currency,
    paymentTerms: Number(fields.Terms),
    lines,
    subtotal: fields.Subtotal,
    vat: fields.VAT,
    total: fields.Total,
  });
  if (!result.success) throw new PoError("PO_SCHEMA_INVALID");
  return result.data;
}
