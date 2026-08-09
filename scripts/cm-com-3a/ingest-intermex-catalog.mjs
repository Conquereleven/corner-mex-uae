// CM-COM-3A — Intermex UAE public catalog ingestion (READ ONLY).
//
// Reads the public Shopify storefront product feed at intermexuae.com, paginates
// until the source is exhausted, and produces:
//   raw snapshot -> normalized manifest -> validation summary -> activation plan
//
// Strictly public and read-only: GET only, no authentication, no private
// endpoint, no cart or checkout interaction, and no write to Intermex or to any
// CornerMex database.
//
// Founder pricing rule: CornerMex price_aed === current Intermex effective
// price. No markup. Sale price wins when a sale is active.
//
// Usage:
//   node scripts/cm-com-3a/ingest-intermex-catalog.mjs --report
//   node scripts/cm-com-3a/ingest-intermex-catalog.mjs --out <file.json>
//   node scripts/cm-com-3a/ingest-intermex-catalog.mjs --out <file.json> --raw <file.json>
//
// `--out` writes the CANONICAL ACTIVATION MANIFEST, which is exactly the
// contract that validate-activation-manifest.mjs and load-activation-plan.mjs
// consume. `--raw` additionally writes the normalized source snapshot.

const SOURCE_ORIGIN = "https://intermexuae.com";
const PAGE_SIZE = 250;
const MAX_PAGES = 200; // loop guard only, not a catalog cap

export const ACTIVATION_MANIFEST_VERSION = "cm-com-3a-activation-manifest-v1";

export const AVAILABILITY = { AVAILABLE: "AVAILABLE", SOLD_OUT: "SOLD_OUT", UNKNOWN: "UNKNOWN" };

const money = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
};

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** Deterministic CornerMex SKU. Never presented as an Intermex SKU. */
export const cornermexSku = (productHandle, variantId) =>
  `CM-${slugify(productHandle).toUpperCase().replace(/-/g, "").slice(0, 24)}-${String(variantId).slice(-6)}`;

async function fetchPage(page) {
  const url = `${SOURCE_ORIGIN}/products.json?limit=${PAGE_SIZE}&page=${page}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "CornerMex-CM-COM-3A-readonly/1.0" },
  });
  if (!response.ok) throw new Error(`source page ${page} returned ${response.status}`);
  return response.json();
}

/** Crawl every page until the public source is exhausted. No fixed catalog cap. */
export async function crawlSource() {
  const products = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await fetchPage(page);
    const batch = Array.isArray(body?.products) ? body.products : [];
    if (batch.length === 0) break;
    for (const product of batch) {
      if (seen.has(product.id)) continue; // deterministic de-duplication by source identity
      seen.add(product.id);
      products.push(product);
    }
    if (batch.length < PAGE_SIZE) break;
  }
  products.sort((a, b) => Number(a.id) - Number(b.id));
  return products;
}

/** Normalize the raw source into the CM-COM-3A manifest shape. */
export function normalizeCatalog(rawProducts, observedAt) {
  const products = rawProducts.map((product) => {
    const variants = (product.variants ?? []).map((variant) => {
      const regular = money(variant.compare_at_price);
      const effective = money(variant.price);
      const available =
        typeof variant.available === "boolean"
          ? variant.available
            ? AVAILABILITY.AVAILABLE
            : AVAILABILITY.SOLD_OUT
          : AVAILABILITY.UNKNOWN;
      return {
        source_variant_id: String(variant.id),
        source_sku: variant.sku && String(variant.sku).trim() !== "" ? String(variant.sku) : null,
        cornermex_sku: cornermexSku(product.handle, variant.id),
        options: [variant.option1, variant.option2, variant.option3].filter(Boolean),
        format_label: variant.title && variant.title !== "Default Title" ? variant.title : null,
        weight_grams: Number.isFinite(variant.grams) && variant.grams > 0 ? variant.grams : null,
        source_availability: available,
        source_regular_price_aed: regular,
        source_effective_price_aed: effective,
        // Founder rule: mirror the current effective price exactly. No markup.
        price_aed: effective,
        on_sale: regular !== null && effective !== null && regular > effective,
        // Founder stock policy (CM-COM-3A-R3): source availability maps to a
        // minimal CornerMex opening stock. A quantity is never invented above 1,
        // and unknown availability is treated as not sellable.
        initial_stock: available === AVAILABILITY.AVAILABLE ? 1 : 0,
      };
    });

    const anyAvailable = variants.some((v) => v.source_availability === AVAILABILITY.AVAILABLE);
    const allUnknown =
      variants.length > 0 && variants.every((v) => v.source_availability === AVAILABILITY.UNKNOWN);
    return {
      source_product_id: String(product.id),
      source_handle: product.handle,
      source_product_url: `${SOURCE_ORIGIN}/products/${product.handle}`,
      slug: slugify(product.handle),
      title: product.title,
      vendor: product.vendor ?? null,
      brand: product.vendor ?? null,
      product_type: product.product_type || null,
      description: product.body_html ?? null,
      images: (product.images ?? []).map((image) => image.src).filter(Boolean),
      source_availability: allUnknown
        ? AVAILABILITY.UNKNOWN
        : anyAvailable
          ? AVAILABILITY.AVAILABLE
          : AVAILABILITY.SOLD_OUT,
      variants,
    };
  });

  products.sort((a, b) => a.source_product_id.localeCompare(b.source_product_id));
  return {
    manifestVersion: "cm-com-3a-intermex-manifest-v1",
    source: SOURCE_ORIGIN,
    source_price_observed_at: observedAt,
    readOnly: true,
    products,
  };
}

/** Validate representation and, separately, activation eligibility. */
export function summarize(manifest) {
  const errors = [];
  const slugs = new Set();
  const cmSkus = new Set();
  let variants = 0;
  let literalSkus = 0;
  let withoutSku = 0;
  let regularPriced = 0;
  let salePriced = 0;
  let validRows = 0;
  let stockOne = 0;
  let stockZero = 0;
  let activationBlockedAvailability = 0;
  const availability = { AVAILABLE: 0, SOLD_OUT: 0, UNKNOWN: 0 };

  for (const product of manifest.products) {
    if (!product.slug) errors.push(`${product.source_product_id}: unusable slug`);
    else if (slugs.has(product.slug))
      errors.push(`${product.source_product_id}: duplicate slug ${product.slug}`);
    else slugs.add(product.slug);
    if (!/^https:\/\//.test(product.source_product_url))
      errors.push(`${product.source_product_id}: bad source url`);
    for (const image of product.images) {
      if (!/^https:\/\//.test(image)) errors.push(`${product.source_product_id}: non-https image`);
    }
    availability[product.source_availability] += 1;

    for (const variant of product.variants) {
      variants += 1;
      if (variant.source_sku === null) withoutSku += 1;
      else literalSkus += 1;
      if (cmSkus.has(variant.cornermex_sku)) {
        errors.push(
          `${product.source_product_id}: duplicate cornermex_sku ${variant.cornermex_sku}`,
        );
      } else cmSkus.add(variant.cornermex_sku);

      if (variant.source_effective_price_aed === null) {
        errors.push(
          `${product.source_product_id}/${variant.source_variant_id}: missing effective price`,
        );
      } else if (variant.price_aed !== variant.source_effective_price_aed) {
        errors.push(
          `${product.source_product_id}/${variant.source_variant_id}: pricing mirror invariant violated`,
        );
      } else {
        validRows += 1;
        if (variant.on_sale) salePriced += 1;
        else regularPriced += 1;
      }
      // Stock must follow the Founder policy exactly; any drift is an error,
      // not a silently accepted value.
      const expectedStock = variant.source_availability === AVAILABILITY.AVAILABLE ? 1 : 0;
      if (variant.initial_stock !== expectedStock) {
        errors.push(
          `${product.source_product_id}/${variant.source_variant_id}: initial_stock must be ${expectedStock}`,
        );
      } else if (expectedStock === 1) stockOne += 1;
      else stockZero += 1;
      if (variant.source_availability !== AVAILABILITY.AVAILABLE)
        activationBlockedAvailability += 1;
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 50),
    counts: {
      sourceProducts: manifest.products.length,
      sourceVariants: variants,
      literalSourceSkus: literalSkus,
      variantsWithoutSourceSku: withoutSku,
      availableProducts: availability.AVAILABLE,
      soldOutProducts: availability.SOLD_OUT,
      unknownAvailabilityProducts: availability.UNKNOWN,
      regularPriceVariants: regularPriced,
      salePriceVariants: salePriced,
      validCatalogRows: validRows,
      variantsWithStockOne: stockOne,
      variantsWithStockZero: stockZero,
      activationBlockedAvailability,
    },
  };
}

/**
 * Deterministic category identity derived from the observed source product
 * type. No marketing taxonomy is invented: the slug is a pure function of the
 * source value, and the single documented fallback is used only when the source
 * supplies no product type at all.
 */
export const FALLBACK_CATEGORY = Object.freeze({ slug: "uncategorized", name: "Uncategorized" });

export function categoryForProduct(product) {
  const raw = typeof product.product_type === "string" ? product.product_type.trim() : "";
  const slug = slugify(raw);
  if (raw === "" || slug === "") return { ...FALLBACK_CATEGORY };
  return { slug, name: raw };
}

/**
 * Convert the normalized source snapshot into the CANONICAL ACTIVATION
 * MANIFEST. Product and variant identity are both preserved so the loader can
 * reconstruct the A2 product -> variant relationship exactly.
 */
export function toActivationManifest(normalized) {
  const categories = new Map();
  const excluded = [];
  const activatable = normalized.products.filter((product) => {
    // A row the storefront cannot legitimately sell is excluded from the
    // activation manifest with a stated reason rather than being reshaped or
    // given invented data. The normalized snapshot still records it in full.
    const reasons = [];
    if (product.images.length === 0) reasons.push("no_source_image");
    if (product.variants.length === 0) reasons.push("no_source_variant");
    if (product.variants.some((variant) => variant.source_effective_price_aed === null)) {
      reasons.push("no_source_effective_price");
    }
    if (reasons.length === 0) return true;
    excluded.push({
      source_product_id: product.source_product_id,
      source_handle: product.source_handle,
      reasons,
    });
    return false;
  });

  const products = activatable.map((product) => {
    const category = categoryForProduct(product);
    if (!categories.has(category.slug)) {
      categories.set(category.slug, { slug: category.slug, names: { en: category.name } });
    }
    return {
      slug: product.slug,
      category: category.slug,
      names: { en: product.title },
      description: product.description ?? null,
      brand: product.brand ?? null,
      images: product.images,
      source_product_id: product.source_product_id,
      source_product_url: product.source_product_url,
      source_handle: product.source_handle,
      source_product_title: product.title,
      source_availability: product.source_availability,
      variants: product.variants.map((variant, index) => ({
        sku: variant.cornermex_sku,
        source_variant_id: variant.source_variant_id,
        // Provenance: the literal source SKU is preserved when it exists and is
        // never merged into, or fabricated from, the CornerMex SKU.
        source_sku: variant.source_sku,
        format_label: variant.format_label ?? variant.options[0] ?? null,
        weight_grams: variant.weight_grams,
        source_availability: variant.source_availability,
        source_regular_price_aed: variant.source_regular_price_aed,
        source_effective_price_aed: variant.source_effective_price_aed,
        price_aed: variant.price_aed,
        initial_stock: variant.initial_stock,
        is_default: index === 0,
      })),
    };
  });

  return {
    manifestVersion: ACTIVATION_MANIFEST_VERSION,
    source: normalized.source,
    source_price_observed_at: normalized.source_price_observed_at,
    readOnly: true,
    categories: [...categories.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    products: [...products].sort((a, b) => a.slug.localeCompare(b.slug)),
    excluded: excluded.sort((a, b) => a.source_product_id.localeCompare(b.source_product_id)),
  };
}

/** Parse the documented CLI arguments. Unknown flags are rejected loudly. */
export function parseArgs(argv) {
  const options = { out: null, raw: null, report: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report") options.report = true;
    else if (arg === "--out" || arg === "--raw") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a file path`);
      options[arg === "--out" ? "out" : "raw"] = value;
      i += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

const invokedDirectly = process.argv[1]?.endsWith("ingest-intermex-catalog.mjs");
if (invokedDirectly) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const path = await import("node:path");
  const options = parseArgs(process.argv.slice(2));

  const observedAt = new Date().toISOString();
  const raw = await crawlSource();
  const normalized = normalizeCatalog(raw, observedAt);
  const summary = summarize(normalized);
  const activation = toActivationManifest(normalized);

  const write = (file, value) => {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    // Deterministic UTF-8 JSON: stable key order from the builders above and a
    // fixed indentation, so two runs of the same input produce identical bytes.
    writeFileSync(path.resolve(file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };
  if (options.raw) write(options.raw, normalized);
  if (options.out) write(options.out, activation);

  console.log(
    JSON.stringify(
      {
        status: summary.valid ? "intermex_catalog_valid" : "intermex_catalog_invalid",
        observedAt,
        wroteActivationManifest: options.out ?? null,
        activationProducts: activation.products.length,
        activationVariants: activation.products.reduce((n, p) => n + p.variants.length, 0),
        activationCategories: activation.categories.length,
        excludedFromActivation: activation.excluded.length,
        exclusionReasons: activation.excluded.map(
          (row) => `${row.source_handle}: ${row.reasons.join(",")}`,
        ),
        wroteNormalizedSnapshot: options.raw ?? null,
        ...summary,
      },
      null,
      2,
    ),
  );
  process.exit(summary.valid ? 0 : 1);
}
