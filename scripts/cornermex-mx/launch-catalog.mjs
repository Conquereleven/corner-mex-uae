// CornerMex MX — launch assortment tooling (reads and writes files only).
//
//   template    write the empty launch template and the candidate sheet
//   preview     validate a filled-in sheet and print the import preview
//
// Nothing here talks to a database. The preview is the gate an import must pass
// before it is allowed to run (docs/cornermex-mx/LAUNCH-CATALOG.md).
//
// Usage:
//   npm run catalog:launch:mx -- template
//   npm run catalog:launch:mx -- preview docs/cornermex-mx/catalog/launch-assortment.csv
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  LAUNCH_ASSORTMENT_RANGE,
  LAUNCH_COLUMNS,
  previewLaunchCatalog,
  toCsv,
} from "../../src/lib/launch-catalog.ts";

const DIR = "docs/cornermex-mx/catalog";

// Brand as printed on the product, recognised from the existing product name.
// A name that matches none of these gets no brand: it is left for the founder.
const BRANDS = [
  ["La Costeña", /la coste[nñ]a|costena|\bcosten\b/i],
  ["Valentina", /valentina/i],
  ["El Yucateco", /yucateco/i],
  ["Maseca", /maseca/i],
  ["Jarritos", /jarritos/i],
  ["Tajín", /taj[ií]n/i],
  ["De la Rosa", /de la rosa/i],
  ["Marinela", /marinela/i],
  ["Lucas", /\blucas\b/i],
  ["Pulparindo", /pulparindo/i],
  ["Doña María", /do[nñ]a mar[ií]a/i],
  ["Herdez", /herdez/i],
  ["Maggi", /maggi/i],
  ["Abuelita", /abuelita/i],
  ["Ruffles", /ruffles/i],
  ["Fritos", /fritos/i],
  ["La Sierra", /la sierra/i],
  ["Coronado", /coronado/i],
  ["Vero", /\bvero\b/i],
  ["Montes", /montes/i],
  ["Maizena", /maizena/i],
  ["Clemente Jacques", /clemente jacques/i],
  ["Maruchan", /maruchan/i],
  ["El Chilerito", /chilerito/i],
];

const brandOf = (name) => BRANDS.find(([, pattern]) => pattern.test(name))?.[0] ?? "";

/** A proposed Mexico SKU derived from the product slug. The founder may change it. */
function proposeSku(slug, used) {
  const base = `MX-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 36);
  let sku = base;
  for (let n = 2; used.has(sku); n += 1) sku = `${base.slice(0, 33)}-${n}`;
  used.add(sku);
  return sku;
}

function parseCsvLine(text) {
  // The classification report quotes every cell.
  return [...text.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => match[1].replaceAll('""', '"'));
}

function writeTemplate() {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path.join(DIR, "launch-assortment-template.csv"), toCsv([[...LAUNCH_COLUMNS]]));

  // Candidates: products classified RESOURCE, with only the data that is
  // trustworthy today — the product's identity and, where it was recorded, its
  // net weight. Supplier, cost, prices, stock, dimensions, case pack, MOQ and
  // lead time are left empty on purpose: none of them is known for Mexico.
  const classification = readFileSync(path.join(DIR, "catalog-classification.csv"), "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map(parseCsvLine);
  const snapshot = JSON.parse(readFileSync(path.join(DIR, "catalog-snapshot.json"), "utf8"));
  const weights = new Map();
  for (const row of snapshot.rows) {
    if (!weights.has(row.slug)) weights.set(row.slug, []);
    weights.get(row.slug).push(row.weightGrams);
  }

  const used = new Set();
  const rows = [[...LAUNCH_COLUMNS]];
  for (const [slug, name, , variants, , cls] of classification) {
    if (cls !== "RESOURCE") continue;
    // A product with several variants needs one row per presentation, which only
    // the founder can define; it is listed once, without a weight.
    const single = Number(variants) === 1;
    const weight = single ? (weights.get(slug)?.[0] ?? "") : "";
    rows.push([
      proposeSku(slug, used),
      name,
      brandOf(name),
      "", // supplier
      "", // supplier_sku
      "", // cost_mxn
      "", // retail_price_mxn
      "", // b2b_price_mxn
      weight ?? "",
      "", // length_cm
      "", // width_cm
      "", // height_cm
      "", // stock
      "", // case_pack
      "", // moq
      "", // lead_time_days
      "", // preferred_supplier
    ]);
  }
  writeFileSync(path.join(DIR, "launch-assortment-candidates.csv"), toCsv(rows));
  console.log(
    JSON.stringify({
      template: path.join(DIR, "launch-assortment-template.csv"),
      candidates: path.join(DIR, "launch-assortment-candidates.csv"),
      candidateRows: rows.length - 1,
      launchRange: LAUNCH_ASSORTMENT_RANGE,
    }),
  );
}

function preview(file) {
  const result = previewLaunchCatalog(readFileSync(file, "utf8"));
  const line = (issue) =>
    `  line ${issue.line}${issue.sku ? ` [${issue.sku}]` : ""}${issue.column ? ` ${issue.column}` : ""}: ${issue.code} — ${issue.message}`;
  console.log(`Launch assortment preview: ${file}`);
  console.log(`  rows ${result.rows} · SKUs ${result.summary.skus}`);
  console.log(
    `  eligible status — ${Object.entries(result.summary.byStatus)
      .map(([status, count]) => `${status} ${count}`)
      .join(" · ")}`,
  );
  console.log(
    `  launch range ${LAUNCH_ASSORTMENT_RANGE.min}–${LAUNCH_ASSORTMENT_RANGE.max} READY/ACTIVE SKUs: ${result.summary.withinLaunchRange ? "inside" : "outside"}`,
  );
  if (Object.keys(result.summary.missing).length > 0) {
    console.log("  still missing (SKUs affected):");
    for (const [field, count] of Object.entries(result.summary.missing).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${field}: ${count}`);
    }
  }
  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}) — the import is refused until these are fixed:`);
    for (const issue of result.errors.slice(0, 200)) console.log(line(issue));
  }
  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const issue of result.warnings.slice(0, 200)) console.log(line(issue));
  }
  const out = `${file}.preview.json`;
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nFull preview written to ${out}`);
  process.exit(result.ok ? 0 : 1);
}

const [command, file] = process.argv.slice(2);
if (command === "template") writeTemplate();
else if (command === "preview" && file) preview(file);
else {
  console.error("usage: launch-catalog.mjs template | preview <file.csv>");
  process.exit(2);
}
