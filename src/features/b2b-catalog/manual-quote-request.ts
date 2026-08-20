import type { B2bProduct } from "./wave1-products";

export const QUANTITY_INTERESTS = [
  "SAMPLE",
  "SMALL_VOLUME",
  "RECURRING_SUPPLY",
  "NOT_SURE",
] as const;

export const BUSINESS_TYPES = [
  "Retailer",
  "Restaurant / Café",
  "Distributor / Wholesaler",
  "Hotel / Hospitality",
  "E-commerce",
  "Other",
] as const;

export type QuantityInterest = (typeof QUANTITY_INTERESTS)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export type ManualQuoteRequestFields = {
  businessName: string;
  businessType: BusinessType | "";
  contactPerson: string;
  role: string;
  email: string;
  phone: string;
  emirate: string;
  notes: string;
  quantityInterest: QuantityInterest;
};

export type ManualQuoteRequestErrors = Partial<
  Record<keyof ManualQuoteRequestFields | "products", string>
>;

export const EMPTY_MANUAL_QUOTE_REQUEST: ManualQuoteRequestFields = {
  businessName: "",
  businessType: "",
  contactPerson: "",
  role: "",
  email: "",
  phone: "",
  emirate: "",
  notes: "",
  quantityInterest: "NOT_SURE",
};

export function validateManualQuoteRequest(
  fields: ManualQuoteRequestFields,
  products: ReadonlyArray<B2bProduct>,
): ManualQuoteRequestErrors {
  const errors: ManualQuoteRequestErrors = {};
  if (!fields.businessName.trim()) errors.businessName = "Enter the business name.";
  if (!fields.businessType) errors.businessType = "Select the business type.";
  if (!fields.contactPerson.trim()) errors.contactPerson = "Enter a contact person.";
  if (!fields.email.trim()) {
    errors.email = "Enter an email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!fields.emirate) errors.emirate = "Select an emirate.";
  if (products.length === 0) errors.products = "Select at least one Wave 1 product.";
  return errors;
}

export function formatManualQuoteRequest(
  fields: ManualQuoteRequestFields,
  products: ReadonlyArray<B2bProduct>,
): string {
  const lines = [
    "CornerMex B2B quote request",
    "Request only — not an order or confirmed quote",
    "",
    `Business: ${fields.businessName.trim()}`,
    `Business type: ${fields.businessType || "Not provided"}`,
    `Contact person: ${fields.contactPerson.trim()}`,
    `Role: ${fields.role.trim() || "Not provided"}`,
    `Email: ${fields.email.trim()}`,
    `Phone / WhatsApp: ${fields.phone.trim() || "Not provided"}`,
    `Emirate: ${fields.emirate}`,
    `Quantity interest: ${quantityInterestLabel(fields.quantityInterest)}`,
    "",
    "Selected products:",
    ...products.map(
      (product, index) =>
        `${index + 1}. ${product.brand ? `${product.brand} ` : ""}${product.name} — ${product.presentation}`,
    ),
    "",
    `Notes: ${fields.notes.trim() || "None"}`,
    "",
    "Pricing, availability, delivery and commercial terms require human confirmation. This request is not an order.",
  ];
  return lines.join("\n");
}

export function quantityInterestLabel(value: QuantityInterest): string {
  return {
    SAMPLE: "Sample",
    SMALL_VOLUME: "Small volume",
    RECURRING_SUPPLY: "Recurring supply",
    NOT_SURE: "Not sure",
  }[value];
}
