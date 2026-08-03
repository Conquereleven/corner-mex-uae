import type { B2bProduct } from "./wave1-products";

export const QUANTITY_INTERESTS = [
  "SAMPLE",
  "SMALL_VOLUME",
  "RECURRING_SUPPLY",
  "NOT_SURE",
] as const;

export type QuantityInterest = (typeof QUANTITY_INTERESTS)[number];

export type ManualQuoteRequestFields = {
  businessName: string;
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
  if (!fields.contactPerson.trim()) errors.contactPerson = "Enter a contact person.";
  if (!fields.email.trim() && !fields.phone.trim()) {
    errors.email = "Add an email or phone / WhatsApp contact.";
    errors.phone = "Add an email or phone / WhatsApp contact.";
  }
  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
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
    "CornerMex manual quote request",
    "Prepared locally — not submitted",
    "",
    `Business: ${fields.businessName.trim()}`,
    `Contact person: ${fields.contactPerson.trim()}`,
    `Role: ${fields.role.trim() || "Not provided"}`,
    `Email: ${fields.email.trim() || "Not provided"}`,
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
    "Pricing and availability require manual confirmation. This request is not an order.",
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
