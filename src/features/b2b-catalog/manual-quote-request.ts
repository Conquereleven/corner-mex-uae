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
  /** State (entidad federativa) the business operates in. */
  location: string;
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
  location: "",
  notes: "",
  quantityInterest: "NOT_SURE",
};

export function validateManualQuoteRequest(
  fields: ManualQuoteRequestFields,
  products: ReadonlyArray<B2bProduct>,
): ManualQuoteRequestErrors {
  const errors: ManualQuoteRequestErrors = {};
  if (!fields.businessName.trim()) errors.businessName = "Escribe el nombre del negocio.";
  if (!fields.businessType) errors.businessType = "Selecciona el tipo de negocio.";
  if (!fields.contactPerson.trim()) errors.contactPerson = "Escribe el nombre de la persona de contacto.";
  if (!fields.email.trim()) {
    errors.email = "Escribe un correo electrónico.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = "Escribe un correo electrónico válido.";
  }
  if (!fields.location) errors.location = "Selecciona un estado.";
  if (products.length === 0) errors.products = "Selecciona al menos un producto.";
  return errors;
}

export function formatManualQuoteRequest(
  fields: ManualQuoteRequestFields,
  products: ReadonlyArray<B2bProduct>,
): string {
  const lines = [
    "Solicitud de cotización CornerMex",
    "Solo es una solicitud: no es un pedido ni una cotización confirmada",
    "",
    `Negocio: ${fields.businessName.trim()}`,
    `Tipo de negocio: ${fields.businessType || "No indicado"}`,
    `Persona de contacto: ${fields.contactPerson.trim()}`,
    `Puesto: ${fields.role.trim() || "No indicado"}`,
    `Correo: ${fields.email.trim()}`,
    `Teléfono / WhatsApp: ${fields.phone.trim() || "No indicado"}`,
    `Estado: ${fields.location}`,
    `Volumen de interés: ${quantityInterestLabel(fields.quantityInterest)}`,
    "",
    "Productos seleccionados:",
    ...products.map(
      (product, index) =>
        `${index + 1}. ${product.brand ? `${product.brand} ` : ""}${product.name} — ${product.presentation}`,
    ),
    "",
    `Notas: ${fields.notes.trim() || "None"}`,
    "",
    "Los precios, la disponibilidad, la entrega y las condiciones comerciales requieren confirmación de una persona. Esta solicitud no es un pedido.",
  ];
  return lines.join("\n");
}

export function quantityInterestLabel(value: QuantityInterest): string {
  return {
    SAMPLE: "Sample",
    SMALL_VOLUME: "Volumen pequeño",
    RECURRING_SUPPLY: "Abasto recurrente",
    NOT_SURE: "Aún no lo sé",
  }[value];
}
