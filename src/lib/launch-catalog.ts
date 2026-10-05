// Launch assortment — CSV contract, validation and import preview.
//
// The Mexico catalogue starts empty and is entered deliberately: 50–75 SKUs,
// each with a supplier, a cost, MXN prices and the parcel data shipping needs.
// This module reads the launch CSV and says, row by row, what is wrong and what
// launch status each SKU is eligible for. It writes nothing: it is the preview
// an import runs before it is allowed to touch the database.
//
// The eligibility rules mirror the database's own gate
// (commerce_private.variant_launch_gaps in supabase/mx/migrations), so a SKU the
// preview calls READY is one the database will accept as READY.
//
// No imports: usable in the browser, on the server and under node:test.

export const LAUNCH_COLUMNS = [
  "sku",
  "name",
  "brand",
  "supplier",
  "supplier_sku",
  "cost_mxn",
  "retail_price_mxn",
  "b2b_price_mxn",
  "weight_g",
  "length_cm",
  "width_cm",
  "height_cm",
  "stock",
  "case_pack",
  "moq",
  "lead_time_days",
  "preferred_supplier",
] as const;

export type LaunchColumn = (typeof LAUNCH_COLUMNS)[number];

/** Launch statuses, lowest to highest. PAUSED is an operator decision, not derived. */
export type LaunchStatus = "DRAFT" | "SOURCING" | "READY" | "ACTIVE";

export const LAUNCH_ASSORTMENT_RANGE = Object.freeze({ min: 50, max: 75 });

export type RowIssue = {
  /** 1-based line in the file, counting the header as line 1. */
  line: number;
  sku: string | null;
  column: LaunchColumn | null;
  code: string;
  message: string;
};

export type LaunchSupplier = {
  supplier: string;
  supplierSku: string | null;
  costMxn: number;
  leadTimeDays: number | null;
  preferred: boolean;
  line: number;
};

export type LaunchSku = {
  sku: string;
  name: string;
  brand: string | null;
  retailPriceMxn: number | null;
  b2bPriceMxn: number | null;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  stock: number | null;
  casePack: number | null;
  moq: number | null;
  suppliers: LaunchSupplier[];
  lines: number[];
  /** What still has to be supplied before the SKU can be READY. */
  missing: string[];
  /** The highest status the SKU may be given with the data in the file. */
  eligibleStatus: LaunchStatus;
};

export type LaunchPreview = {
  ok: boolean;
  rows: number;
  skus: LaunchSku[];
  errors: RowIssue[];
  warnings: RowIssue[];
  summary: {
    skus: number;
    byStatus: Record<LaunchStatus, number>;
    /** True when the count of ACTIVE-eligible SKUs is inside the launch range. */
    withinLaunchRange: boolean;
    /** How often each datum is missing, for the founder-input checklist. */
    missing: Record<string, number>;
  };
};

/** RFC 4180 parsing: quoted fields, doubled quotes, commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

const MONEY = /^\d{1,7}(\.\d{1,2})?$/;
const INTEGER = /^\d{1,7}$/;
const DECIMAL = /^\d{1,4}(\.\d{1,2})?$/;

const LIMITS = Object.freeze({
  maxWeightG: 70_000,
  maxDimensionCm: 200,
  maxLeadTimeDays: 180,
});

type Cells = Record<LaunchColumn, string>;

function truthy(value: string): boolean | null {
  const normalised = value.trim().toLowerCase();
  if (["true", "yes", "si", "sí", "1", "x"].includes(normalised)) return true;
  if (["false", "no", "0", ""].includes(normalised)) return false;
  return null;
}

/**
 * Validates the launch CSV and returns the import preview. Never throws on bad
 * data: every problem is a row-level issue with its line and column.
 */
export function previewLaunchCatalog(csv: string): LaunchPreview {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const table = parseCsv(csv);

  const empty: LaunchPreview = {
    ok: false,
    rows: 0,
    skus: [],
    errors,
    warnings,
    summary: {
      skus: 0,
      byStatus: { DRAFT: 0, SOURCING: 0, READY: 0, ACTIVE: 0 },
      withinLaunchRange: false,
      missing: {},
    },
  };

  if (table.length === 0) {
    errors.push({
      line: 1,
      sku: null,
      column: null,
      code: "FILE_EMPTY",
      message: "The file has no rows.",
    });
    return empty;
  }

  const header = table[0].map((value) => value.trim().toLowerCase());
  for (const column of LAUNCH_COLUMNS) {
    if (!header.includes(column)) {
      errors.push({
        line: 1,
        sku: null,
        column,
        code: "COLUMN_MISSING",
        message: `Required column "${column}" is missing.`,
      });
    }
  }
  for (const name of header) {
    if (!(LAUNCH_COLUMNS as readonly string[]).includes(name)) {
      // A price in another currency must not slip in under another column name.
      const code = /aed|usd|price|cost|precio|costo/.test(name)
        ? "COLUMN_NOT_MXN"
        : "COLUMN_UNKNOWN";
      errors.push({
        line: 1,
        sku: null,
        column: null,
        code,
        message: `Column "${name}" is not part of the launch template.`,
      });
    }
  }
  if (new Set(header).size !== header.length) {
    errors.push({
      line: 1,
      sku: null,
      column: null,
      code: "COLUMN_DUPLICATED",
      message: "A column appears twice.",
    });
  }
  if (errors.length > 0) return empty;

  const position = Object.fromEntries(
    LAUNCH_COLUMNS.map((column) => [column, header.indexOf(column)]),
  ) as Record<LaunchColumn, number>;

  const bySku = new Map<string, LaunchSku>();
  const productSignature = new Map<string, string>();

  table.slice(1).forEach((raw, offset) => {
    const line = offset + 2;
    const cells = Object.fromEntries(
      LAUNCH_COLUMNS.map((column) => [column, (raw[position[column]] ?? "").trim()]),
    ) as Cells;
    const sku = cells.sku;
    const issue = (column: LaunchColumn | null, code: string, message: string, list = errors) =>
      list.push({ line, sku: sku || null, column, code, message });

    if (!sku) {
      issue("sku", "SKU_REQUIRED", "Every row needs a SKU.");
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(sku)) {
      issue(
        "sku",
        "SKU_INVALID",
        "A SKU is 3–40 characters: capital letters, digits, dot, dash or underscore.",
      );
      return;
    }
    if (!cells.name) issue("name", "NAME_REQUIRED", "The product needs a name.");
    else if (cells.name.length > 160)
      issue("name", "NAME_TOO_LONG", "The name is longer than 160 characters.");

    const money = (column: LaunchColumn): number | null => {
      const value = cells[column];
      if (value === "") return null;
      // Amounts are plain MXN numbers: no symbol, no code, no thousands separator.
      if (/[a-z$€]/i.test(value)) {
        issue(
          column,
          "MONEY_NOT_PLAIN_MXN",
          `"${value}" must be a plain amount in MXN, without a symbol or currency code.`,
        );
        return null;
      }
      if (!MONEY.test(value)) {
        issue(
          column,
          "MONEY_INVALID",
          `"${value}" is not a valid amount (up to two decimals, no separators).`,
        );
        return null;
      }
      return Number(value);
    };
    const integer = (column: LaunchColumn, min: number, max: number): number | null => {
      const value = cells[column];
      if (value === "") return null;
      if (!INTEGER.test(value) || Number(value) < min || Number(value) > max) {
        issue(
          column,
          "INTEGER_INVALID",
          `"${value}" must be a whole number between ${min} and ${max}.`,
        );
        return null;
      }
      return Number(value);
    };
    const dimension = (column: LaunchColumn): number | null => {
      const value = cells[column];
      if (value === "") return null;
      if (!DECIMAL.test(value) || Number(value) <= 0 || Number(value) > LIMITS.maxDimensionCm) {
        issue(
          column,
          "DIMENSION_INVALID",
          `"${value}" must be a length in cm between 0 and ${LIMITS.maxDimensionCm}.`,
        );
        return null;
      }
      return Number(value);
    };

    const cost = money("cost_mxn");
    const retail = money("retail_price_mxn");
    const b2b = money("b2b_price_mxn");
    const weight = integer("weight_g", 1, LIMITS.maxWeightG);
    const length = dimension("length_cm");
    const width = dimension("width_cm");
    const height = dimension("height_cm");
    const stock = integer("stock", 0, 9_999_999);
    const casePack = integer("case_pack", 1, 100_000);
    const moq = integer("moq", 1, 100_000);
    const leadTime = integer("lead_time_days", 0, LIMITS.maxLeadTimeDays);
    const preferred = truthy(cells.preferred_supplier);
    if (preferred === null) {
      issue(
        "preferred_supplier",
        "BOOLEAN_INVALID",
        `"${cells.preferred_supplier}" must be yes or no.`,
      );
    }

    // Counted on what was typed, so an invalid value is reported once, not twice.
    const dimensions = [cells.length_cm, cells.width_cm, cells.height_cm].filter(
      (value) => value !== "",
    ).length;
    if (dimensions > 0 && dimensions < 3) {
      issue(
        "length_cm",
        "DIMENSIONS_INCOMPLETE",
        "Give all three of length, width and height, or none.",
      );
    }
    if (retail !== null && retail <= 0)
      issue("retail_price_mxn", "PRICE_NOT_POSITIVE", "The retail price must be above zero.");
    if (cost !== null && retail !== null && retail <= cost) {
      issue(
        "retail_price_mxn",
        "PRICE_BELOW_COST",
        "The retail price is not above the cost.",
        warnings,
      );
    }
    if (b2b !== null && retail !== null && b2b > retail) {
      issue(
        "b2b_price_mxn",
        "B2B_ABOVE_RETAIL",
        "The B2B price is above the retail price.",
        warnings,
      );
    }
    if (b2b !== null && cost !== null && b2b <= cost) {
      issue("b2b_price_mxn", "B2B_BELOW_COST", "The B2B price is not above the cost.", warnings);
    }
    if (moq !== null && casePack !== null && moq % casePack !== 0) {
      issue(
        "moq",
        "MOQ_NOT_CASE_MULTIPLE",
        "The minimum order quantity is not a multiple of the case pack.",
        warnings,
      );
    }
    if (
      cells.supplier === "" &&
      (cost !== null || cells.supplier_sku !== "" || preferred === true)
    ) {
      issue(
        "supplier",
        "SUPPLIER_REQUIRED",
        "Supplier cost, SKU or preference was given without a supplier name.",
      );
    }
    if (cells.supplier !== "" && cost === null && cells.cost_mxn === "") {
      issue("cost_mxn", "COST_REQUIRED", "A supplier needs a cost.");
    }

    // Product-level values must agree on every row of the same SKU: a second
    // supplier row repeats the SKU, it does not redefine the product.
    const signature = JSON.stringify([
      cells.name,
      cells.brand,
      retail,
      b2b,
      weight,
      length,
      width,
      height,
      stock,
      casePack,
      moq,
    ]);
    const existing = bySku.get(sku.toUpperCase());
    if (existing) {
      if (productSignature.get(sku.toUpperCase()) !== signature) {
        issue(
          "sku",
          "SKU_CONFLICT",
          `SKU ${sku} is repeated with different product data (first seen on line ${existing.lines[0]}).`,
        );
        return;
      }
      if (cells.supplier === "") {
        issue(
          "sku",
          "SKU_DUPLICATED",
          `SKU ${sku} is duplicated (first seen on line ${existing.lines[0]}).`,
        );
        return;
      }
      if (
        existing.suppliers.some(
          (entry) => entry.supplier.toLowerCase() === cells.supplier.toLowerCase(),
        )
      ) {
        issue(
          "supplier",
          "SUPPLIER_DUPLICATED",
          `Supplier "${cells.supplier}" is listed twice for SKU ${sku}.`,
        );
        return;
      }
      existing.lines.push(line);
      if (cost !== null) {
        existing.suppliers.push({
          supplier: cells.supplier,
          supplierSku: cells.supplier_sku || null,
          costMxn: cost,
          leadTimeDays: leadTime,
          preferred: preferred === true,
          line,
        });
      }
      return;
    }

    productSignature.set(sku.toUpperCase(), signature);
    bySku.set(sku.toUpperCase(), {
      sku,
      name: cells.name,
      brand: cells.brand || null,
      retailPriceMxn: retail,
      b2bPriceMxn: b2b,
      weightG: weight,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      stock,
      casePack,
      moq,
      suppliers:
        cells.supplier !== "" && cost !== null
          ? [
              {
                supplier: cells.supplier,
                supplierSku: cells.supplier_sku || null,
                costMxn: cost,
                leadTimeDays: leadTime,
                preferred: preferred === true,
                line,
              },
            ]
          : [],
      lines: [line],
      missing: [],
      eligibleStatus: "DRAFT",
    });
  });

  const failedLines = new Set(errors.map((entry) => entry.line));
  const byStatus: Record<LaunchStatus, number> = { DRAFT: 0, SOURCING: 0, READY: 0, ACTIVE: 0 };
  const missingCounts: Record<string, number> = {};

  for (const sku of bySku.values()) {
    const preferred = sku.suppliers.filter((entry) => entry.preferred);
    if (preferred.length > 1) {
      errors.push({
        line: preferred[1].line,
        sku: sku.sku,
        column: "preferred_supplier",
        code: "PREFERRED_SUPPLIER_NOT_UNIQUE",
        message: `SKU ${sku.sku} has ${preferred.length} preferred suppliers; exactly one is allowed.`,
      });
      failedLines.add(preferred[1].line);
    }

    const missing: string[] = [];
    if (sku.retailPriceMxn === null) missing.push("retail_price_mxn");
    if (sku.b2bPriceMxn === null) missing.push("b2b_price_mxn");
    if (sku.weightG === null) missing.push("weight_g");
    if (sku.lengthCm === null || sku.widthCm === null || sku.heightCm === null)
      missing.push("dimensions");
    if (sku.stock === null) missing.push("stock");
    if (sku.casePack === null) missing.push("case_pack");
    if (sku.moq === null) missing.push("moq");
    if (sku.suppliers.length === 0) missing.push("supplier", "cost_mxn");
    if (preferred.length === 0) missing.push("preferred_supplier");
    else if (preferred[0].leadTimeDays === null) missing.push("lead_time_days");
    sku.missing = missing;

    // A SKU with a row-level error is never promoted past DRAFT.
    const broken = sku.lines.some((line) => failedLines.has(line));
    if (broken) sku.eligibleStatus = "DRAFT";
    else if (missing.length === 0) sku.eligibleStatus = (sku.stock ?? 0) > 0 ? "ACTIVE" : "READY";
    else if (sku.suppliers.length > 0 || sku.retailPriceMxn !== null)
      sku.eligibleStatus = "SOURCING";
    else sku.eligibleStatus = "DRAFT";

    byStatus[sku.eligibleStatus] += 1;
    for (const field of missing) missingCounts[field] = (missingCounts[field] ?? 0) + 1;
  }

  const skus = [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const launchable = byStatus.READY + byStatus.ACTIVE;
  if (skus.length > LAUNCH_ASSORTMENT_RANGE.max) {
    warnings.push({
      line: 1,
      sku: null,
      column: null,
      code: "ASSORTMENT_ABOVE_RANGE",
      message: `${skus.length} SKUs is above the ${LAUNCH_ASSORTMENT_RANGE.min}–${LAUNCH_ASSORTMENT_RANGE.max} launch assortment.`,
    });
  }

  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);
  return {
    ok: errors.length === 0,
    rows: table.length - 1,
    skus,
    errors,
    warnings,
    summary: {
      skus: skus.length,
      byStatus,
      withinLaunchRange:
        launchable >= LAUNCH_ASSORTMENT_RANGE.min && launchable <= LAUNCH_ASSORTMENT_RANGE.max,
      missing: missingCounts,
    },
  };
}

/** Quotes a value for CSV output when it needs it. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
