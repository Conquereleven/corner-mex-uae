// Launch assortment CSV: validation rules, row-level errors and the import
// preview. A SKU missing commercial or shipping data must never look ready.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = await import("../../src/lib/launch-catalog.ts");

const HEADER = catalog.LAUNCH_COLUMNS.join(",");
const row = (overrides = {}) => {
  const base = {
    sku: "MX-VAL-370",
    name: "Salsa Valentina 370 ml",
    brand: "Valentina",
    supplier: "Abarrotes Central A",
    supplier_sku: "A-VAL370",
    cost_mxn: "21.00",
    retail_price_mxn: "32.50",
    b2b_price_mxn: "27.00",
    weight_g: "420",
    length_cm: "6",
    width_cm: "6",
    height_cm: "19",
    stock: "24",
    case_pack: "12",
    moq: "12",
    lead_time_days: "1",
    preferred_supplier: "yes",
    ...overrides,
  };
  return catalog.LAUNCH_COLUMNS.map((column) => catalog.csvCell(base[column])).join(",");
};
const sheet = (...rows) => `${HEADER}\n${rows.join("\n")}\n`;
const codes = (preview, list = "errors") => preview[list].map((issue) => issue.code);

test("the template carries exactly the launch columns", async () => {
  assert.deepEqual(
    [...catalog.LAUNCH_COLUMNS],
    [
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
    ],
  );
  const template = await readFile(
    "docs/cornermex-mx/catalog/launch-assortment-template.csv",
    "utf8",
  );
  assert.equal(template.trim(), HEADER);
});

test("a complete row with stock is ACTIVE-eligible; without stock it is READY", () => {
  const active = catalog.previewLaunchCatalog(sheet(row()));
  assert.equal(active.ok, true);
  assert.deepEqual(active.errors, []);
  assert.equal(active.skus[0].eligibleStatus, "ACTIVE");
  assert.deepEqual(active.skus[0].missing, []);
  assert.deepEqual(active.skus[0].suppliers[0], {
    supplier: "Abarrotes Central A",
    supplierSku: "A-VAL370",
    costMxn: 21,
    leadTimeDays: 1,
    preferred: true,
    line: 2,
  });
  const ready = catalog.previewLaunchCatalog(sheet(row({ stock: "0" })));
  assert.equal(ready.skus[0].eligibleStatus, "READY");
});

test("missing data never becomes launch-ready: each gap is named and the status drops", () => {
  const cases = [
    [{ retail_price_mxn: "" }, "retail_price_mxn"],
    [{ b2b_price_mxn: "" }, "b2b_price_mxn"],
    [{ weight_g: "" }, "weight_g"],
    [{ length_cm: "", width_cm: "", height_cm: "" }, "dimensions"],
    [{ stock: "" }, "stock"],
    [{ case_pack: "" }, "case_pack"],
    [{ moq: "" }, "moq"],
    [{ lead_time_days: "" }, "lead_time_days"],
    [{ preferred_supplier: "no" }, "preferred_supplier"],
  ];
  for (const [overrides, gap] of cases) {
    const preview = catalog.previewLaunchCatalog(sheet(row(overrides)));
    assert.ok(preview.skus[0].missing.includes(gap), gap);
    assert.equal(preview.skus[0].eligibleStatus, "SOURCING", gap);
  }
  // Nothing but an identity: DRAFT, with everything listed as missing.
  const draft = catalog.previewLaunchCatalog(
    sheet(
      row(
        Object.fromEntries(
          catalog.LAUNCH_COLUMNS.filter((c) => !["sku", "name"].includes(c)).map((c) => [c, ""]),
        ),
      ),
    ),
  );
  assert.equal(draft.skus[0].eligibleStatus, "DRAFT");
  assert.deepEqual(draft.skus[0].missing, [
    "retail_price_mxn",
    "b2b_price_mxn",
    "weight_g",
    "dimensions",
    "stock",
    "case_pack",
    "moq",
    "supplier",
    "cost_mxn",
    "preferred_supplier",
  ]);
});

test("MXN validation: amounts are plain numbers, never another currency or a formatted string", () => {
  for (const value of ["AED 20", "20 AED", "$32.50", "MXN 32.50", "32.50 MXN", "USD12"]) {
    const preview = catalog.previewLaunchCatalog(sheet(row({ retail_price_mxn: value })));
    assert.deepEqual(codes(preview), ["MONEY_NOT_PLAIN_MXN"], value);
    assert.equal(preview.ok, false);
  }
  for (const value of ["1,234.50", "32.505", "-5", "abc123", "12."]) {
    const preview = catalog.previewLaunchCatalog(sheet(row({ cost_mxn: value })));
    assert.ok(
      codes(preview).some((code) => code.startsWith("MONEY_")),
      value,
    );
  }
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ retail_price_mxn: "0" })))), [
    "PRICE_NOT_POSITIVE",
  ]);
  // A column that smuggles in another currency is refused outright.
  const aed = catalog.previewLaunchCatalog(`${HEADER},price_aed\n${row()},20\n`);
  assert.deepEqual(codes(aed), ["COLUMN_NOT_MXN"]);
  assert.equal(aed.skus.length, 0);
});

test("dimension and weight validation", () => {
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ height_cm: "" })))), [
    "DIMENSIONS_INCOMPLETE",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ length_cm: "0" })))), [
    "DIMENSION_INVALID",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ width_cm: "500" })))), [
    "DIMENSION_INVALID",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ weight_g: "0" })))), [
    "INTEGER_INVALID",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ weight_g: "1.5" })))), [
    "INTEGER_INVALID",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ weight_g: "900000" })))), [
    "INTEGER_INVALID",
  ]);
  // A row with an error is never promoted past DRAFT, however complete it looks.
  assert.equal(
    catalog.previewLaunchCatalog(sheet(row({ weight_g: "0" }))).skus[0].eligibleStatus,
    "DRAFT",
  );
});

test("row-level errors carry the line, the SKU and the column", () => {
  const preview = catalog.previewLaunchCatalog(
    sheet(
      row(),
      row({ sku: "MX-BAD-1", cost_mxn: "12.345" }),
      row({ sku: "", name: "Sin SKU" }),
      row({ sku: "mx lower" }),
    ),
  );
  assert.deepEqual(
    preview.errors.map((issue) => [issue.line, issue.sku, issue.column, issue.code]),
    [
      [3, "MX-BAD-1", "cost_mxn", "MONEY_INVALID"],
      [4, null, "sku", "SKU_REQUIRED"],
      [5, "mx lower", "sku", "SKU_INVALID"],
    ],
  );
  // The good row is still previewed.
  assert.equal(preview.skus.find((sku) => sku.sku === "MX-VAL-370").eligibleStatus, "ACTIVE");
});

test("duplicate SKU detection", () => {
  // The same SKU twice with no second supplier is a duplicate.
  const dup = catalog.previewLaunchCatalog(
    sheet(
      row(),
      row({
        supplier: "",
        supplier_sku: "",
        cost_mxn: "",
        preferred_supplier: "",
        lead_time_days: "",
      }),
    ),
  );
  assert.ok(codes(dup).includes("SKU_CONFLICT") || codes(dup).includes("SKU_DUPLICATED"));
  // Case does not hide a duplicate.
  const cased = catalog.previewLaunchCatalog(
    sheet(row(), row({ sku: "MX-VAL-370", name: "Otro nombre" })),
  );
  assert.deepEqual(codes(cased), ["SKU_CONFLICT"]);
  assert.equal(cased.errors[0].line, 3);
  assert.match(cased.errors[0].message, /first seen on line 2/);
  // The same supplier twice for one SKU.
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row(), row()))), [
    "SUPPLIER_DUPLICATED",
  ]);
});

test("one SKU may have several suppliers, with exactly one preferred", () => {
  const second = row({
    supplier: "Distribuidora B",
    supplier_sku: "B-0042",
    cost_mxn: "22.40",
    lead_time_days: "3",
    preferred_supplier: "no",
  });
  const preview = catalog.previewLaunchCatalog(sheet(row(), second));
  assert.equal(preview.ok, true);
  assert.equal(preview.skus.length, 1);
  assert.deepEqual(
    preview.skus[0].suppliers.map((entry) => [entry.supplier, entry.costMxn, entry.preferred]),
    [
      ["Abarrotes Central A", 21, true],
      ["Distribuidora B", 22.4, false],
    ],
  );
  assert.equal(preview.skus[0].eligibleStatus, "ACTIVE");

  const two = catalog.previewLaunchCatalog(
    sheet(row(), row({ supplier: "Distribuidora B", preferred_supplier: "yes" })),
  );
  assert.deepEqual(codes(two), ["PREFERRED_SUPPLIER_NOT_UNIQUE"]);
  assert.equal(two.skus[0].eligibleStatus, "DRAFT");
});

test("supplier data without a supplier, and a supplier without a cost, are errors", () => {
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ supplier: "" })))), [
    "SUPPLIER_REQUIRED",
  ]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(sheet(row({ cost_mxn: "" })))), [
    "COST_REQUIRED",
  ]);
});

test("commercial sanity checks are warnings, not silent", () => {
  const warn = (overrides) =>
    codes(catalog.previewLaunchCatalog(sheet(row(overrides))), "warnings");
  assert.deepEqual(warn({ retail_price_mxn: "20.00", b2b_price_mxn: "" }), ["PRICE_BELOW_COST"]);
  assert.deepEqual(warn({ b2b_price_mxn: "40.00" }), ["B2B_ABOVE_RETAIL"]);
  assert.deepEqual(warn({ b2b_price_mxn: "21.00" }), ["B2B_BELOW_COST"]);
  assert.deepEqual(warn({ moq: "10" }), ["MOQ_NOT_CASE_MULTIPLE"]);
});

test("a wrong or incomplete header is refused before any row is read", () => {
  const missing = catalog.previewLaunchCatalog(`sku,name\nMX-A-1,Algo\n`);
  assert.equal(missing.ok, false);
  assert.ok(codes(missing).every((code) => code === "COLUMN_MISSING"));
  assert.equal(missing.errors.length, catalog.LAUNCH_COLUMNS.length - 2);
  assert.deepEqual(codes(catalog.previewLaunchCatalog("")), ["FILE_EMPTY"]);
  assert.deepEqual(codes(catalog.previewLaunchCatalog(`${HEADER},notes\n${row()},x\n`)), [
    "COLUMN_UNKNOWN",
  ]);
});

test("CSV parsing handles quoted commas, quotes and a byte-order mark", () => {
  const preview = catalog.previewLaunchCatalog(
    `${String.fromCharCode(0xfeff)}${sheet(row({ name: 'Salsa "Macha", 250 g' }))}`,
  );
  assert.equal(preview.ok, true);
  assert.equal(preview.skus[0].name, 'Salsa "Macha", 250 g');
});

test("the launch range is 50–75 launchable SKUs", () => {
  const many = (count, overrides = {}) =>
    catalog.previewLaunchCatalog(
      sheet(
        ...Array.from({ length: count }, (_, index) =>
          row({ sku: `MX-SKU-${String(index).padStart(3, "0")}`, ...overrides }),
        ),
      ),
    );
  assert.equal(many(49).summary.withinLaunchRange, false);
  assert.equal(many(50).summary.withinLaunchRange, true);
  assert.equal(many(75).summary.withinLaunchRange, true);
  const over = many(76);
  assert.equal(over.summary.withinLaunchRange, false);
  assert.deepEqual(codes(over, "warnings"), ["ASSORTMENT_ABOVE_RANGE"]);
  // SKUs that are not ready do not count towards the range.
  assert.equal(many(60, { stock: "" }).summary.withinLaunchRange, false);
});

test("the candidate sheet invents nothing: no supplier, cost, price, stock or dimension", async () => {
  const text = await readFile("docs/cornermex-mx/catalog/launch-assortment-candidates.csv", "utf8");
  const preview = catalog.previewLaunchCatalog(text);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors.slice(0, 3)));
  assert.ok(preview.skus.length > 0);
  for (const sku of preview.skus) {
    assert.equal(sku.suppliers.length, 0, sku.sku);
    assert.equal(sku.retailPriceMxn, null, sku.sku);
    assert.equal(sku.b2bPriceMxn, null, sku.sku);
    assert.equal(sku.stock, null, sku.sku);
    assert.equal(sku.lengthCm, null, sku.sku);
    assert.equal(sku.casePack, null, sku.sku);
    assert.equal(sku.moq, null, sku.sku);
    // Every candidate is therefore DRAFT: none can be mistaken for launch-ready.
    assert.equal(sku.eligibleStatus, "DRAFT", sku.sku);
  }
  assert.doesNotMatch(text, /AED|Intermex/i);
  assert.equal(preview.summary.byStatus.READY + preview.summary.byStatus.ACTIVE, 0);
});
