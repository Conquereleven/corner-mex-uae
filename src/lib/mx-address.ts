// Mexico delivery address model.
//
// This is the address shape for the MX market: street, exterior and interior
// number, colonia, municipio/alcaldía, state and a five-digit postal code. It
// replaces the UAE emirate/area/building model on every active surface.
//
// Kept free of path aliases and server-only imports so the validator runs in
// the browser, in server functions and directly under node:test.
//
// The canonical order transaction (cm_create_cod_order_v2 and successors) stores
// the address as an opaque jsonb snapshot, so this model needs no schema change
// to be recorded on an order. `toAddressSnapshot` is the one function that
// produces that snapshot.

import { z } from "zod";

/**
 * The 32 federal entities, keyed by the ISO 3166-2:MX subdivision code without
 * its "MX-" prefix. Names are the ones Mexican carriers expect in `area_level1`.
 */
export const MX_STATES = Object.freeze({
  AGU: "Aguascalientes",
  BCN: "Baja California",
  BCS: "Baja California Sur",
  CAM: "Campeche",
  CHP: "Chiapas",
  CHH: "Chihuahua",
  CMX: "Ciudad de México",
  COA: "Coahuila",
  COL: "Colima",
  DUR: "Durango",
  GUA: "Guanajuato",
  GRO: "Guerrero",
  HID: "Hidalgo",
  JAL: "Jalisco",
  MEX: "Estado de México",
  MIC: "Michoacán",
  MOR: "Morelos",
  NAY: "Nayarit",
  NLE: "Nuevo León",
  OAX: "Oaxaca",
  PUE: "Puebla",
  QUE: "Querétaro",
  ROO: "Quintana Roo",
  SLP: "San Luis Potosí",
  SIN: "Sinaloa",
  SON: "Sonora",
  TAB: "Tabasco",
  TAM: "Tamaulipas",
  TLA: "Tlaxcala",
  VER: "Veracruz",
  YUC: "Yucatán",
  ZAC: "Zacatecas",
} as const);

export type MxStateCode = keyof typeof MX_STATES;

export const MX_STATE_CODES = Object.freeze(Object.keys(MX_STATES) as MxStateCode[]);

/** State options sorted by name for a select control. */
export const MX_STATE_OPTIONS: ReadonlyArray<{ code: MxStateCode; name: string }> = Object.freeze(
  MX_STATE_CODES.map((code) => ({ code, name: MX_STATES[code] })).sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  ),
);

/**
 * SEPOMEX postal-code ranges by state: the first two digits of a código postal
 * identify the federal entity. Used only to catch an obvious mismatch between
 * the selected state and the postal code; it does not prove the code exists.
 */
const POSTAL_PREFIXES: Readonly<Record<MxStateCode, ReadonlyArray<readonly [number, number]>>> =
  Object.freeze({
    CMX: [[1, 16]],
    AGU: [[20, 20]],
    BCN: [[21, 22]],
    BCS: [[23, 23]],
    CAM: [[24, 24]],
    COA: [[25, 27]],
    COL: [[28, 28]],
    CHP: [[29, 30]],
    CHH: [[31, 33]],
    DUR: [[34, 35]],
    GUA: [[36, 38]],
    GRO: [[39, 41]],
    HID: [[42, 43]],
    JAL: [[44, 49]],
    MEX: [[50, 57]],
    MIC: [[58, 61]],
    MOR: [[62, 62]],
    NAY: [[63, 63]],
    NLE: [[64, 67]],
    OAX: [[68, 71]],
    PUE: [[72, 75]],
    QUE: [[76, 76]],
    ROO: [[77, 77]],
    SLP: [[78, 79]],
    SIN: [[80, 82]],
    SON: [[83, 85]],
    TAB: [[86, 86]],
    TAM: [[87, 89]],
    TLA: [[90, 90]],
    VER: [[91, 96]],
    YUC: [[97, 97]],
    ZAC: [[98, 99]],
  });

/** The state a postal code belongs to, or null when the prefix is unassigned. */
export function stateForPostalCode(postalCode: string): MxStateCode | null {
  if (!/^\d{5}$/.test(postalCode)) return null;
  const prefix = Number(postalCode.slice(0, 2));
  for (const code of MX_STATE_CODES) {
    if (POSTAL_PREFIXES[code].some(([from, to]) => prefix >= from && prefix <= to)) return code;
  }
  return null;
}

/**
 * Normalise a Mexican phone number to its 10-digit national form. Accepts
 * spaces, dashes, parentheses, a leading +52 / 52 and the retired "1" mobile
 * marker after the country code. Returns null when the result is not 10 digits.
 */
export function normalizeMxPhone(raw: string): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  return /^[1-9]\d{9}$/.test(digits) ? digits : null;
}

/** E.164 form of a normalised national number: plus sign, country code 52, ten digits. */
export function mxPhoneE164(national: string): string {
  return `+52${national}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

/**
 * The validated Mexico delivery address. `municipality` holds the municipio, or
 * the alcaldía for an address in Ciudad de México.
 */
export const MxAddress = z
  .object({
    recipient_name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .transform((value, context) => {
        const national = normalizeMxPhone(value);
        if (!national) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "MX_ADDRESS_PHONE_INVALID" });
          return z.NEVER;
        }
        return national;
      }),
    street: z.string().trim().min(2).max(120),
    exterior_number: z.string().trim().min(1).max(20),
    interior_number: optionalText(20),
    colonia: z.string().trim().min(2).max(120),
    municipality: z.string().trim().min(2).max(120),
    state: z.enum(MX_STATE_CODES as unknown as [MxStateCode, ...MxStateCode[]]),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "MX_ADDRESS_POSTAL_CODE_INVALID"),
    references: optionalText(240),
    notes: optionalText(500),
  })
  .superRefine((address, context) => {
    // The format check above already reported a malformed code.
    if (!/^\d{5}$/.test(address.postal_code)) return;
    const expected = stateForPostalCode(address.postal_code);
    if (expected === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postal_code"],
        message: "MX_ADDRESS_POSTAL_CODE_INVALID",
      });
    } else if (expected !== address.state) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postal_code"],
        message: "MX_ADDRESS_POSTAL_CODE_STATE_MISMATCH",
      });
    }
  });

export type MxAddressInput = z.input<typeof MxAddress>;
export type MxAddress = z.output<typeof MxAddress>;

export const MX_ADDRESS_SNAPSHOT_VERSION = "mx-1" as const;

export type MxAddressSnapshot = MxAddress & {
  /** Discriminates this snapshot from the historical UAE address shape. */
  address_model: typeof MX_ADDRESS_SNAPSHOT_VERSION;
  country: "MX";
  state_name: string;
};

/** The immutable address snapshot stored on an order. */
export function toAddressSnapshot(address: MxAddress): MxAddressSnapshot {
  return {
    address_model: MX_ADDRESS_SNAPSHOT_VERSION,
    country: "MX",
    ...address,
    state_name: MX_STATES[address.state],
  };
}

/** True for a snapshot written by the Mexico address model. */
export function isMxAddressSnapshot(value: unknown): value is MxAddressSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { address_model?: unknown }).address_model === MX_ADDRESS_SNAPSHOT_VERSION
  );
}

/** Address lines in the order a Mexican address is written. */
export function formatMxAddressLines(
  address: Pick<
    MxAddress,
    | "street"
    | "exterior_number"
    | "interior_number"
    | "colonia"
    | "municipality"
    | "state"
    | "postal_code"
  >,
): string[] {
  const interior = address.interior_number ? ` Int. ${address.interior_number}` : "";
  return [
    `${address.street} ${address.exterior_number}${interior}`,
    `Col. ${address.colonia}`,
    `${address.postal_code} ${address.municipality}, ${MX_STATES[address.state]}`,
  ];
}

/** Customer-facing Spanish message for an address validation code. */
export function mxAddressErrorMessage(code: string): string {
  switch (code) {
    case "MX_ADDRESS_PHONE_INVALID":
      return "Escribe un teléfono de 10 dígitos.";
    case "MX_ADDRESS_POSTAL_CODE_INVALID":
      return "Escribe un código postal válido de 5 dígitos.";
    case "MX_ADDRESS_POSTAL_CODE_STATE_MISMATCH":
      return "El código postal no corresponde al estado seleccionado.";
    default:
      return "Revisa los datos de la dirección.";
  }
}
