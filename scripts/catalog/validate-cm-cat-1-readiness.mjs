import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MATRIX_PATH = "docs/catalog/CM-CAT-1_WAVE_1_READINESS.csv";

export const REQUIRED_COLUMNS = Object.freeze([
  "candidate_number",
  "candidate_id",
  "product_name",
  "brand",
  "category",
  "presentation",
  "supplier_source",
  "cost",
  "cost_currency",
  "aed_price",
  "availability",
  "compliance_registration",
  "gross_margin",
  "moq",
  "media_status",
  "commercial_priority",
  "publish_ready",
  "source_class",
  "source_file",
  "source_line_or_record",
  "evidence_notes",
  "blocker",
  "next_action",
]);

const EXPECTED_CANDIDATE_NUMBERS = Object.freeze([
  1,
  2,
  3,
  ...Array.from({ length: 12 }, (_, i) => i + 9),
]);
const COMMERCIAL_UNKNOWN_FIELDS = Object.freeze([
  "cost",
  "cost_currency",
  "aed_price",
  "availability",
  "compliance_registration",
  "gross_margin",
  "moq",
]);
const NON_OPERATIONAL_REFERENCE_FIELDS = Object.freeze([
  "product_name",
  "brand",
  "category",
  "presentation",
  "supplier_source",
  "media_status",
]);
const SOURCE_CLASSES = new Set([
  "verified_repo_evidence",
  "legacy_demo_reference",
  "seo_reference_only",
  "founder_required",
]);
const SOURCE_CONTRACTS = Object.freeze({
  legacy_demo_reference:
    "supabase/legacy-lovable/20260606013014_dc708c0e-8aed-42e8-bdc0-03b193c62a44.sql",
  seo_reference_only: "supabase/legacy-lovable/20260609020000_product_seo_batch.sql",
});
const UNSUPPORTED_EXTERNAL_CLAIMS = Object.freeze([
  /\bconfirmed (?:in stock|available|halal|registered|compliant)\b/i,
  /\bhalal[- ]certified\b/i,
  /\bexpected market demand\b/i,
  /\bbrand reputation (?:proves|confirms|shows)\b/i,
  /\b(?:spice|flavou?r)\b.{0,40}\bhalal\b/i,
  /\bstandard (?:moq|minimum order|margin)\b/i,
]);

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

export function parseCsv(text) {
  assert(typeof text === "string", "CM_CAT_1_CSV_TEXT_REQUIRED");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  assert(!quoted, "CM_CAT_1_CSV_QUOTE_UNTERMINATED");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  while (rows.at(-1)?.every((value) => value === "")) rows.pop();
  assert(rows.length >= 2, "CM_CAT_1_CSV_ROWS_REQUIRED");

  const [headers, ...dataRows] = rows;
  assert(new Set(headers).size === headers.length, "CM_CAT_1_COLUMN_DUPLICATE");
  return {
    headers,
    records: dataRows.map((values, index) => {
      assert(values.length === headers.length, `CM_CAT_1_ROW_WIDTH_INVALID:${index + 2}`);
      return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
    }),
  };
}

const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;

export function serializeCsv(headers, records) {
  return `${[
    headers.map(escapeCsv).join(","),
    ...records.map((record) => headers.map((header) => escapeCsv(record[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function validateProvenance(baseDir, row, rowNumber) {
  assert(row.source_file, `CM_CAT_1_PROVENANCE_FILE_REQUIRED:${rowNumber}`);
  assert(row.source_line_or_record, `CM_CAT_1_PROVENANCE_RECORD_REQUIRED:${rowNumber}`);
  assert(!path.isAbsolute(row.source_file), `CM_CAT_1_PROVENANCE_PATH_INVALID:${rowNumber}`);
  assert(
    !row.source_file.split("/").includes(".."),
    `CM_CAT_1_PROVENANCE_PATH_INVALID:${rowNumber}`,
  );
  assert(
    !/products-template\.csv/i.test(row.source_file),
    `CM_CAT_1_TEMPLATE_SOURCE_FORBIDDEN:${rowNumber}`,
  );

  const expectedSource = SOURCE_CONTRACTS[row.source_class];
  assert(expectedSource === row.source_file, `CM_CAT_1_SOURCE_CLASS_MISMATCH:${rowNumber}`);

  const lineMatch = /^line ([1-9]\d*);/.exec(row.source_line_or_record);
  assert(lineMatch, `CM_CAT_1_PROVENANCE_LINE_INVALID:${rowNumber}`);
  const sourcePath = path.resolve(baseDir, row.source_file);
  assert(fs.existsSync(sourcePath), `CM_CAT_1_PROVENANCE_FILE_MISSING:${rowNumber}`);
  const sourceLine = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/)[Number(lineMatch[1]) - 1];
  assert(sourceLine?.includes(row.candidate_id), `CM_CAT_1_PROVENANCE_ID_MISMATCH:${rowNumber}`);
}

function validateRow(baseDir, row, index) {
  const rowNumber = index + 2;
  assert(/^\d+$/.test(row.candidate_number), `CM_CAT_1_CANDIDATE_NUMBER_INVALID:${rowNumber}`);
  assert(row.candidate_id, `CM_CAT_1_CANDIDATE_ID_REQUIRED:${rowNumber}`);

  for (const field of COMMERCIAL_UNKNOWN_FIELDS) {
    assert(
      row[field] === "UNKNOWN",
      `CM_CAT_1_COMMERCIAL_FIELD_MUST_BE_UNKNOWN:${field}:${rowNumber}`,
    );
  }
  assert(row.publish_ready === "false", `CM_CAT_1_PUBLISH_READY_FORBIDDEN:${rowNumber}`);
  assert(row.commercial_priority === "founder_required", `CM_CAT_1_PRIORITY_INVALID:${rowNumber}`);
  assert(SOURCE_CLASSES.has(row.source_class), `CM_CAT_1_SOURCE_CLASS_INVALID:${rowNumber}`);
  assert(
    row.source_class === "legacy_demo_reference" || row.source_class === "seo_reference_only",
    `CM_CAT_1_REFERENCE_CLASS_REQUIRED:${rowNumber}`,
  );

  for (const field of NON_OPERATIONAL_REFERENCE_FIELDS) {
    assert(
      row[field] === "UNKNOWN",
      `CM_CAT_1_REFERENCE_DATA_IN_OPERATIONAL_FIELD:${field}:${rowNumber}`,
    );
  }

  assert(
    row.evidence_notes.startsWith("NON-OPERATIVE "),
    `CM_CAT_1_EVIDENCE_QUARANTINE_REQUIRED:${rowNumber}`,
  );
  assert(
    !/example\.com/i.test(row.evidence_notes),
    `CM_CAT_1_TEMPLATE_EVIDENCE_FORBIDDEN:${rowNumber}`,
  );
  assert(
    UNSUPPORTED_EXTERNAL_CLAIMS.every((pattern) => !pattern.test(row.evidence_notes)),
    `CM_CAT_1_EXTERNAL_KNOWLEDGE_FORBIDDEN:${rowNumber}`,
  );
  assert(row.blocker.trim(), `CM_CAT_1_BLOCKER_REQUIRED:${rowNumber}`);
  assert(row.next_action.trim(), `CM_CAT_1_NEXT_ACTION_REQUIRED:${rowNumber}`);
  validateProvenance(baseDir, row, rowNumber);
}

export function validateCatalogReadiness({
  baseDir = process.cwd(),
  matrixPath = MATRIX_PATH,
} = {}) {
  const absoluteMatrixPath = path.resolve(baseDir, matrixPath);
  const { headers, records } = parseCsv(fs.readFileSync(absoluteMatrixPath, "utf8"));
  assert(
    headers.length === REQUIRED_COLUMNS.length &&
      headers.every((header, index) => header === REQUIRED_COLUMNS[index]),
    "CM_CAT_1_COLUMNS_INVALID",
  );
  assert(records.length === 15, "CM_CAT_1_CANDIDATE_COUNT_INVALID");

  records.forEach((row, index) => validateRow(baseDir, row, index));
  const candidateNumbers = records.map((row) => Number(row.candidate_number));
  assert(
    candidateNumbers.every((number, index) => number === EXPECTED_CANDIDATE_NUMBERS[index]),
    "CM_CAT_1_SHORTLIST_INVALID",
  );
  assert(
    new Set(records.map((row) => row.candidate_id)).size === records.length,
    "CM_CAT_1_CANDIDATE_DUPLICATE",
  );

  const unknownCounts = Object.fromEntries(
    COMMERCIAL_UNKNOWN_FIELDS.map((field) => [
      field,
      records.filter((row) => row[field] === "UNKNOWN").length,
    ]),
  );
  return {
    status: "cm_cat_1_readiness_valid",
    candidates: records.length,
    publishReady: records.filter((row) => row.publish_ready === "true").length,
    unknownCounts,
    mandatoryCommercialUnknownTotal: Object.values(unknownCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    console.log(JSON.stringify(validateCatalogReadiness()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
