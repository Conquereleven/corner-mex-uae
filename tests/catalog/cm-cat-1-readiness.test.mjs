import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MATRIX_PATH,
  parseCsv,
  serializeCsv,
  validateCatalogReadiness,
} from "../../scripts/catalog/validate-cm-cat-1-readiness.mjs";

const matrix = parseCsv(fs.readFileSync(MATRIX_PATH, "utf8"));

function withMutation(mutate, expected) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-cm-cat-1-"));
  const fixturePath = path.join(baseDir, MATRIX_PATH);
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.symlinkSync(path.resolve("supabase"), path.join(baseDir, "supabase"), "dir");
  const records = structuredClone(matrix.records);
  mutate(records);
  fs.writeFileSync(fixturePath, serializeCsv(matrix.headers, records));
  try {
    assert.throws(() => validateCatalogReadiness({ baseDir }), expected);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
}

test("the exact 15-row Wave 1 shortlist is deterministic and fail-closed", () => {
  const result = validateCatalogReadiness();
  assert.equal(result.status, "cm_cat_1_readiness_valid");
  assert.equal(result.candidates, 15);
  assert.equal(result.publishReady, 0);
  assert.deepEqual(
    matrix.records.map((row) => Number(row.candidate_number)),
    [1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );
  assert.deepEqual(result.unknownCounts, {
    cost: 15,
    cost_currency: 15,
    aed_price: 15,
    availability: 15,
    compliance_registration: 15,
    gross_margin: 15,
    moq: 15,
  });
  assert.equal(result.mandatoryCommercialUnknownTotal, 105);
});

test("commercial numerics, stock, halal/compliance, MOQ, and margin inference are rejected", () => {
  for (const [field, value] of [
    ["cost", "7.50"],
    ["aed_price", "25"],
    ["availability", "IN_STOCK"],
    ["compliance_registration", "HALAL"],
    ["gross_margin", "0.40"],
    ["moq", "12"],
  ]) {
    withMutation(
      (records) => {
        records[0][field] = value;
      },
      new RegExp(`CM_CAT_1_COMMERCIAL_FIELD_MUST_BE_UNKNOWN:${field}`),
    );
  }
});

test("publish_ready=true is rejected for every current Wave 1 row", () => {
  withMutation(
    (records) => {
      records[4].publish_ready = "true";
    },
    /CM_CAT_1_PUBLISH_READY_FORBIDDEN/,
  );
});

test("missing, template, or mismatched provenance is rejected", () => {
  withMutation(
    (records) => {
      records[0].source_file = "";
    },
    /CM_CAT_1_PROVENANCE_FILE_REQUIRED/,
  );
  withMutation(
    (records) => {
      records[0].source_line_or_record = "";
    },
    /CM_CAT_1_PROVENANCE_RECORD_REQUIRED/,
  );
  withMutation(
    (records) => {
      records[0].source_class = "";
    },
    /CM_CAT_1_SOURCE_CLASS_INVALID/,
  );
  withMutation(
    (records) => {
      records[0].blocker = "";
    },
    /CM_CAT_1_BLOCKER_REQUIRED/,
  );
  withMutation(
    (records) => {
      records[0].source_file = "public/templates/products-template.csv";
    },
    /CM_CAT_1_TEMPLATE_SOURCE_FORBIDDEN/,
  );
  withMutation(
    (records) => {
      records[0].source_line_or_record = "line 37; wrong record";
    },
    /CM_CAT_1_PROVENANCE_ID_MISMATCH/,
  );
});

test("demo and SEO references cannot become operational identity or supplier data", () => {
  for (const [field, value] of [
    ["product_name", "Demo product"],
    ["brand", "SEO keyword brand"],
    ["category", "snacks"],
    ["presentation", "500g"],
    ["supplier_source", "Intermex UAE"],
    ["media_status", "READY"],
  ]) {
    withMutation(
      (records) => {
        records[3][field] = value;
      },
      new RegExp(`CM_CAT_1_REFERENCE_DATA_IN_OPERATIONAL_FIELD:${field}`),
    );
  }
});

test("external-knowledge and template claims cannot enter evidence notes", () => {
  withMutation(
    (records) => {
      records[3].evidence_notes = "NON-OPERATIVE confirmed in stock based on brand reputation.";
    },
    /CM_CAT_1_EXTERNAL_KNOWLEDGE_FORBIDDEN/,
  );
  withMutation(
    (records) => {
      records[3].evidence_notes = "NON-OPERATIVE template image at example.com.";
    },
    /CM_CAT_1_TEMPLATE_EVIDENCE_FORBIDDEN/,
  );
});

test("the validator is local, read-only, and contains no publication path", () => {
  const source = fs.readFileSync("scripts/catalog/validate-cm-cat-1-readiness.mjs", "utf8");
  assert.doesNotMatch(source, /from "node:(?:http|https|net|child_process)"/);
  assert.doesNotMatch(source, /\bfetch\s*\(|createClient\s*\(|writeFileSync|appendFileSync/);
  assert.doesNotMatch(source, /catalog-import|A3\.2b|publish(?:Product|Catalog)/i);
});
