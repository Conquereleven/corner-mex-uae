// CornerMex MX — catalogue classification (READ ONLY).
//
// Classifies every product in the canonical catalogue for the Mexico launch:
//
//   KEEP                   available and relevant in Mexico, supplier unchanged
//   RESOURCE               keep the product, replace the supplier (re-source locally)
//   REMOVE_FROM_ACTIVE_MX  not appropriate for the Mexico launch
//   INTERMEX_PRIVATE       Intermex private label / supplier-specific; must not be sold
//   REVIEW                 needs a manual commercial decision
//
// This script changes nothing. It reads the public catalogue through the
// publishable (anonymous) key, or a saved snapshot, and writes a report. Acting
// on the report — deactivating, re-pricing, re-sourcing — is a separate,
// explicitly authorised step (docs/cornermex-mx/CATALOG-MIGRATION.md).
//
// Usage:
//   node scripts/cornermex-mx/classify-catalog.mjs                 # live read
//   node scripts/cornermex-mx/classify-catalog.mjs --input <snapshot.json>
//   node scripts/cornermex-mx/classify-catalog.mjs --check         # rules self-test only

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const CLASSES = ["KEEP", "RESOURCE", "REMOVE_FROM_ACTIVE_MX", "INTERMEX_PRIVATE", "REVIEW"];

const OUT_DIR = "docs/cornermex-mx/catalog";

/**
 * Ordered rules: the first match wins. Each rule names the evidence it relies
 * on, so every row in the report can be traced to a reason a person can check.
 */
export const RULES = [
  {
    id: "intermex-named",
    cls: "INTERMEX_PRIVATE",
    test: (p) => /intermex/i.test(p.name),
    reason: "Product name carries the Intermex name: Intermex private label.",
  },
  {
    id: "intermex-own-production",
    cls: "INTERMEX_PRIVATE",
    // Fresh tortilla / tostada / chip lines with no national brand, which the
    // source storefront sells as its own production.
    test: (p) =>
      /intermex/i.test(p.slug) && /tortilla|tostada|chips|chorizo/i.test(`${p.slug} ${p.name}`),
    reason: "Unbranded tortilla/tostada/chip/chorizo line listed under an Intermex slug: supplier's own production.",
  },
  {
    id: "unbranded-tortilla-line",
    cls: "INTERMEX_PRIVATE",
    // Inference, stated as one: the source storefront is a tortilla producer and
    // these lines carry no other brand. Treated as supplier production so they
    // are not sold; CornerMex sources tortillas locally under its own listing.
    test: (p) =>
      /^(corn|flour) tortilla|^tortilla chips|^golden tostadas|^tostadas/i.test(p.name) &&
      !/maseca|naturelo|omalli|inzi/i.test(p.name),
    reason: "Unbranded tortilla / tostada / tortilla-chip line from the supplier's own storefront: treated as supplier production (inferred from the absence of any other brand).",
  },
  {
    id: "non-mexican-uae-brand",
    cls: "REMOVE_FROM_ACTIVE_MX",
    test: (p) => /fit ?panda|hung(a)?ry guru|inzi|no[, ]+guilt/i.test(`${p.slug} ${p.name}`),
    reason: "Brand from the UAE supplier's local assortment, not a Mexican pantry product; only present because of UAE sourcing.",
  },
  {
    id: "souvenir-lifestyle",
    cls: "REMOVE_FROM_ACTIVE_MX",
    test: (p) => p.category === "gifts-lifestyle",
    reason: "Souvenir / gift item aimed at the expatriate market; no role in a Mexico pantry and distribution assortment.",
  },
  {
    id: "cold-chain",
    cls: "REVIEW",
    test: (p) => p.category === "chilled-frozen",
    reason: "Chilled or frozen: needs a cold chain that parcel shipping does not provide. Local-delivery-only decision required.",
  },
  {
    id: "kitchenware",
    cls: "REVIEW",
    test: (p) => p.category === "kitchen-tableware",
    reason: "Kitchenware: widely available in Mexico; decide whether it belongs in a pantry/distribution assortment.",
  },
  {
    id: "assembled-by-supplier",
    cls: "REVIEW",
    test: (p) => /candy bag|sampler|gift basket|basket|pack of \d+/i.test(p.name),
    reason: "Bundle or assortment assembled by the previous supplier; would have to be re-created as a CornerMex bundle.",
  },
  {
    id: "legacy-intermex-slug",
    cls: "REVIEW",
    test: (p) => /intermex/i.test(p.slug),
    reason: "Branded product whose slug still carries the Intermex name; re-source and re-slug before it can be listed.",
  },
  {
    id: "export-market-brand",
    cls: "REVIEW",
    test: (p) => /el mexicano|clamato|cholula/i.test(p.name),
    reason: "Brand or pack size made for the export market; confirm the equivalent domestic presentation exists.",
  },
  {
    id: "small-producer",
    cls: "REVIEW",
    test: (p) =>
      /la conspiraci[oó]n|la conspiration|la[- ]meridana|xatze|el[- ]fresno|nopal[- ]foods|nopal[- ]tenochtitlan|naturelo|omalli|mayamel|b[- ]sweet|pepe cru/i.test(
        `${p.slug} ${p.name}`,
      ),
    reason: "Small or export-oriented producer: domestic availability and a local supplier are unconfirmed.",
  },
  {
    id: "national-brand",
    cls: "RESOURCE",
    test: (p) =>
      /la coste[nñ]a|costena|costen\b|valentina|el yucateco|yucateco|maseca|jarritos|taj[ií]n|de la rosa|marinela|lucas|pulparindo|do[nñ]a mar[ií]a|herdez|maggi|abuelita|ruffles|fritos|rancheritos|churritos|chicharron|la sierra|coronado|pel[oó]n|vero\b|montes|maizena|clemente jacques|valle verde|maruchan|macromick|mccormick|el chilerito|tama-?roca|payaso|gansito|azteca/i.test(
        `${p.slug} ${p.name}`,
      ),
    reason: "National Mexican brand sold through ordinary domestic distribution: keep the product, replace the UAE supplier with a local one.",
  },
  {
    id: "generic-pantry",
    cls: "RESOURCE",
    test: (p) =>
      ["pantry-staples", "chiles-spices", "salsas-moles", "tortillas-masa", "snacks-sweets", "drinks"].includes(
        p.category,
      ),
    reason: "Generic Mexican pantry item with no brand recorded: commonly available from local wholesale; re-source and confirm the presentation.",
  },
];

const FALLBACK = {
  id: "unmatched",
  cls: "REVIEW",
  reason: "No rule matched: classify manually.",
};

/** Groups variant rows into products. */
export function toProducts(rows) {
  const products = new Map();
  for (const row of rows) {
    const product = products.get(row.slug) ?? {
      slug: row.slug,
      name: row.name,
      category: row.category,
      vendor: row.vendor,
      variants: [],
    };
    product.variants.push({
      sku: row.sku,
      format: row.format,
      price: Number(row.price),
      weightGrams: row.weightGrams === null || row.weightGrams === "" ? null : Number(row.weightGrams),
      stock: Number(row.stock),
    });
    products.set(row.slug, product);
  }
  return [...products.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function classify(product) {
  const rule = RULES.find((candidate) => candidate.test(product)) ?? FALLBACK;
  const flags = [];
  // Every stored price was copied from the UAE supplier's storefront in AED.
  flags.push("PRICE_IS_AED");
  flags.push("SUPPLIER_IS_UAE");
  if (product.variants.some((variant) => !(variant.price > 0))) flags.push("PRICE_ZERO");
  if (product.variants.some((variant) => variant.weightGrams === null)) flags.push("NO_WEIGHT");
  flags.push("NO_DIMENSIONS");
  return { ...product, classification: rule.cls, rule: rule.id, reason: rule.reason, flags };
}

async function readEnvFile() {
  try {
    const text = await readFile(".env", "utf8");
    return Object.fromEntries(
      text
        .split("\n")
        .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line))
        .filter(Boolean)
        .map((match) => [match[1], match[2]]),
    );
  } catch {
    return {};
  }
}

/** Reads the catalogue through the anonymous publishable key. No write is possible with it. */
async function fetchLive() {
  const env = { ...(await readEnvFile()), ...process.env };
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  const query =
    "select=slug,brand,category:categories(slug),translations:product_translations(lang,name)," +
    "variants:product_variants(sku,format_label,price_aed,weight_grams,stock)&order=slug&limit=2000";
  const response = await fetch(`${url}/rest/v1/products?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`catalogue read failed: HTTP ${response.status}`);
  const products = await response.json();
  return {
    source: new URL(url).host,
    rows: products.flatMap((product) =>
      (product.variants ?? []).map((variant) => ({
        slug: product.slug,
        category: product.category?.slug ?? "",
        vendor: product.brand ?? "",
        name:
          (product.translations ?? []).find((entry) => entry.lang === "en")?.name ??
          product.translations?.[0]?.name ??
          "",
        sku: variant.sku ?? "",
        format: variant.format_label ?? "",
        price: variant.price_aed,
        weightGrams: variant.weight_grams,
        stock: variant.stock,
      })),
    ),
  };
}

const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function selfTest() {
  const sample = (slug, name, category) => ({ slug, name, category, vendor: "", variants: [] });
  const expect = [
    [sample("intermex-corn-tortilla", "Corn Tortilla 6inch, Intermex 500gm", "tortillas-masa"), "INTERMEX_PRIVATE"],
    [sample("intermex-flour-tortillas", "Flour Tortilla 500g", "tortillas-masa"), "INTERMEX_PRIVATE"],
    [sample("fit-panda-x", "FIT PANDA Flamin Hot Instant Noodles", "pantry-staples"), "REMOVE_FROM_ACTIVE_MX"],
    [sample("viva-mexico-t-shirt", "Viva México T-shirt!", "gifts-lifestyle"), "REMOVE_FROM_ACTIVE_MX"],
    [sample("valentina-x", "Valentina Salsa Picante", "salsas-moles"), "RESOURCE"],
    [sample("la-meridana-x", "Red Habanero Hot Sauce, La Meridana", "salsas-moles"), "REVIEW"],
    [sample("iced-popsicles", "Iced Popsicles 6 Pack", "chilled-frozen"), "REVIEW"],
  ];
  for (const [product, cls] of expect) {
    const got = classify(product).classification;
    if (got !== cls) throw new Error(`rule self-test failed: ${product.slug} → ${got}, expected ${cls}`);
  }
}

async function main() {
  selfTest();
  if (process.argv.includes("--check")) {
    console.log("classification rules: self-test passed");
    return;
  }
  const inputIndex = process.argv.indexOf("--input");
  const snapshot =
    inputIndex > -1
      ? JSON.parse(await readFile(process.argv[inputIndex + 1], "utf8"))
      : await fetchLive();

  const classified = toProducts(snapshot.rows).map(classify);
  const summary = Object.fromEntries(CLASSES.map((cls) => [cls, 0]));
  for (const product of classified) summary[product.classification] += 1;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "catalog-snapshot.json"),
    `${JSON.stringify({ source: snapshot.source, rows: snapshot.rows }, null, 1)}\n`,
  );
  const header = ["slug", "name", "category", "variants", "skus", "classification", "rule", "flags", "reason"];
  const lines = classified.map((product) =>
    [
      product.slug,
      product.name,
      product.category,
      product.variants.length,
      product.variants.map((variant) => variant.sku).join(" "),
      product.classification,
      product.rule,
      product.flags.join(" "),
      product.reason,
    ]
      .map(csv)
      .join(","),
  );
  await writeFile(
    path.join(OUT_DIR, "catalog-classification.csv"),
    `${header.map(csv).join(",")}\n${lines.join("\n")}\n`,
  );

  const byRule = {};
  for (const product of classified) byRule[product.rule] = (byRule[product.rule] ?? 0) + 1;
  const variants = classified.flatMap((product) => product.variants);
  const report = {
    source: snapshot.source,
    products: classified.length,
    variants: variants.length,
    summary,
    byRule,
    dataGaps: {
      variantsWithoutWeight: variants.filter((variant) => variant.weightGrams === null).length,
      variantsWithoutDimensions: variants.length,
      variantsPricedZero: variants.filter((variant) => !(variant.price > 0)).length,
      variantsPricedInAed: variants.length,
    },
  };
  await writeFile(
    path.join(OUT_DIR, "catalog-classification-summary.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
