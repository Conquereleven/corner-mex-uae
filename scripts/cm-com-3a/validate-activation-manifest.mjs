// CM-COM-3A — catalog activation manifest validator and planner.
//
// Validates a real catalog manifest and produces a deterministic activation
// plan. It is DRY-RUN ONLY: it never opens a database connection and never
// writes anything anywhere. Loading the plan into Supabase is a separate,
// Founder-authorized step.
//
// Usage:
//   node scripts/cm-com-3a/validate-activation-manifest.mjs <manifest.json> [--plan]

import { readFileSync } from "node:fs";

// The catalog size is dynamic and set by the public source, so there is no
// fixed maximum. CM-COM-3A ingests the full current Intermex UAE catalog.
export const MANIFEST_LIMITS = { minProducts: 1 };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;
const LANGS = ["en", "es", "ar"];

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

const isMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  Math.round(value * 100) === value * 100;

/**
 * Validate a manifest object. Returns { valid, errors, plan }.
 * Never connects to any database.
 */
export function validateActivationManifest(manifest) {
  const errors = [];
  const push = (message) => errors.push(message);

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest must be an object"], plan: null };
  }
  const categories = Array.isArray(manifest.categories) ? manifest.categories : null;
  const products = Array.isArray(manifest.products) ? manifest.products : null;
  if (!categories) push("categories must be an array");
  if (!products) push("products must be an array");
  if (!categories || !products) return { valid: false, errors, plan: null };

  // --- categories ---
  const categorySlugs = new Set();
  categories.forEach((category, index) => {
    const at = `categories[${index}]`;
    if (!SLUG.test(String(category?.slug ?? ""))) push(`${at}.slug is not a valid slug`);
    else if (categorySlugs.has(category.slug)) push(`${at}.slug duplicates ${category.slug}`);
    else categorySlugs.add(category.slug);
    if (!category?.names || typeof category.names !== "object") push(`${at}.names is required`);
    else if (typeof category.names.en !== "string" || category.names.en.trim() === "") {
      push(`${at}.names.en is required`);
    }
  });

  // --- products ---
  const productSlugs = new Set();
  const skus = new Set();
  if (products.length < MANIFEST_LIMITS.minProducts) push("at least one product is required");

  products.forEach((product, index) => {
    const at = `products[${index}]`;
    if (!SLUG.test(String(product?.slug ?? ""))) push(`${at}.slug is not a valid slug`);
    else if (productSlugs.has(product.slug)) push(`${at}.slug duplicates ${product.slug}`);
    else productSlugs.add(product.slug);

    if (!SKU.test(String(product?.sku ?? ""))) push(`${at}.sku is not a valid SKU`);
    else if (skus.has(product.sku)) push(`${at}.sku duplicates ${product.sku}`);
    else skus.add(product.sku);

    if (typeof product?.category !== "string" || !categorySlugs.has(product.category)) {
      push(`${at}.category must reference a manifest category`);
    }
    if (typeof product?.names?.en !== "string" || product.names.en.trim() === "") {
      push(`${at}.names.en is required`);
    }
    for (const lang of Object.keys(product?.names ?? {})) {
      if (!LANGS.includes(lang)) push(`${at}.names.${lang} is not a supported language`);
    }
    if (product?.description !== undefined && typeof product.description !== "string") {
      push(`${at}.description must be a string when present`);
    }

    const images = product?.images;
    if (!Array.isArray(images) || images.length === 0)
      push(`${at}.images must be a non-empty array`);
    else
      images.forEach((image, imageIndex) => {
        if (!isHttpsUrl(image)) push(`${at}.images[${imageIndex}] is not a valid https URL`);
      });

    if (!isMoney(product?.price_aed)) push(`${at}.price_aed must be a non-negative AED amount`);
    // Founder stock policy (CM-COM-3A-R3): opening stock is 1 for an available
    // source row and 0 otherwise. No quantity above 1 is ever accepted.
    if (product?.initial_stock !== 0 && product?.initial_stock !== 1) {
      push(`${at}.initial_stock must be 0 or 1`);
    } else if (product?.source_availability !== undefined) {
      const expected = product.source_availability === "AVAILABLE" ? 1 : 0;
      if (product.initial_stock !== expected) {
        push(`${at}.initial_stock must be ${expected} for ${product.source_availability}`);
      }
    }
    if (typeof product?.format_label !== "string" || product.format_label.trim() === "") {
      push(`${at}.format_label is required`);
    }
    if (
      product?.weight_grams !== undefined &&
      product.weight_grams !== null &&
      (!Number.isInteger(product.weight_grams) || product.weight_grams <= 0)
    ) {
      push(`${at}.weight_grams must be a positive integer when present`);
    }
    if (
      product?.spice_level !== undefined &&
      product.spice_level !== null &&
      (!Number.isInteger(product.spice_level) || product.spice_level < 0 || product.spice_level > 4)
    ) {
      push(`${at}.spice_level must be an integer 0-4 when present`);
    }
    // Halal may only be asserted when actually known; it is never defaulted true.
    if (product?.is_halal !== undefined && typeof product.is_halal !== "boolean") {
      push(`${at}.is_halal must be a boolean when present`);
    }
    if (product?.is_bulk !== undefined && typeof product.is_bulk !== "boolean") {
      push(`${at}.is_bulk must be a boolean when present`);
    }
    if (product?.origin_region !== undefined && typeof product.origin_region !== "string") {
      push(`${at}.origin_region must be a string when present`);
    }
    if (product?.brand !== undefined && typeof product.brand !== "string") {
      push(`${at}.brand must be a string when present`);
    }
  });

  if (errors.length > 0) return { valid: false, errors, plan: null };

  // Deterministic plan: stable ordering so two runs produce identical output.
  const plan = {
    planVersion: "cm-com-3a-activation-plan-v1",
    dryRun: true,
    categories: [...categories]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((category) => ({ slug: category.slug, names: category.names })),
    products: [...products]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((product) => ({
        slug: product.slug,
        sku: product.sku,
        category: product.category,
        brand: product.brand ?? null,
        names: product.names,
        description: product.description ?? null,
        images: product.images,
        origin_region: product.origin_region ?? null,
        spice_level: product.spice_level ?? null,
        is_halal: product.is_halal ?? false,
        is_bulk: product.is_bulk ?? false,
        format_label: product.format_label,
        weight_grams: product.weight_grams ?? null,
        price_aed: product.price_aed,
        initial_stock: product.initial_stock,
        // Products are created active so they are shoppable, but activation
        // itself remains a separately authorized operation.
        product_status: "active",
        variant_is_active: true,
      })),
    totals: {
      categories: categories.length,
      products: products.length,
      units: products.reduce((sum, product) => sum + product.initial_stock, 0),
    },
  };

  return { valid: true, errors: [], plan };
}

const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith("validate-activation-manifest.mjs");
if (invokedDirectly) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: validate-activation-manifest.mjs <manifest.json> [--plan]");
    process.exit(1);
  }
  const result = validateActivationManifest(JSON.parse(readFileSync(file, "utf8")));
  if (!result.valid) {
    console.error(
      JSON.stringify({ status: "activation_manifest_invalid", errors: result.errors }, null, 2),
    );
    process.exit(1);
  }
  const summary = { status: "activation_manifest_valid", dryRun: true, ...result.plan.totals };
  console.log(JSON.stringify(process.argv.includes("--plan") ? result.plan : summary, null, 2));
}
