// CM-COM-3A — canonical activation manifest validator and planner.
//
// This validates the ONE canonical activation manifest contract produced by
// ingest-intermex-catalog.mjs (`--out`) and consumed by load-activation-plan.mjs.
// There is no second schema and no manual conversion step between them.
//
// It is DRY-RUN ONLY: it never opens a database connection and never writes
// anything anywhere. Applying the plan is a separate, Founder-authorized step.
//
// Usage:
//   node scripts/cm-com-3a/validate-activation-manifest.mjs <manifest.json> [--plan]

import { readFileSync } from "node:fs";

// The catalog size is dynamic and set by the public source, so there is no
// fixed maximum. CM-COM-3A ingests the full current Intermex UAE catalog.
export const MANIFEST_LIMITS = { minProducts: 1 };

export const ACTIVATION_PLAN_VERSION = "cm-com-3a-activation-plan-v1";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;
const LANGS = ["en", "es", "ar"];
const AVAILABILITY = ["AVAILABLE", "SOLD_OUT", "UNKNOWN"];

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

// Two-decimal AED. The comparison is done with a tolerance because binary
// floating point cannot represent values such as 17.4 exactly.
const isMoney = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/**
 * Validate a canonical activation manifest. Returns { valid, errors, plan }.
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

  // --- products and their variants ---
  const productSlugs = new Set();
  const skus = new Set();
  const sourceProductIds = new Set();
  const sourceVariantIds = new Set();
  if (products.length < MANIFEST_LIMITS.minProducts) push("at least one product is required");

  products.forEach((product, index) => {
    const at = `products[${index}]`;
    if (!SLUG.test(String(product?.slug ?? ""))) push(`${at}.slug is not a valid slug`);
    else if (productSlugs.has(product.slug)) push(`${at}.slug duplicates ${product.slug}`);
    else productSlugs.add(product.slug);

    if (typeof product?.category !== "string" || !categorySlugs.has(product.category)) {
      push(`${at}.category must reference a manifest category`);
    }
    if (typeof product?.names?.en !== "string" || product.names.en.trim() === "") {
      push(`${at}.names.en is required`);
    }
    for (const lang of Object.keys(product?.names ?? {})) {
      if (!LANGS.includes(lang)) push(`${at}.names.${lang} is not a supported language`);
    }
    if (
      product?.description !== undefined &&
      product.description !== null &&
      typeof product.description !== "string"
    ) {
      push(`${at}.description must be a string when present`);
    }

    // Source provenance must survive into the manifest so the loaded catalog can
    // always be traced back to the exact public source row it came from.
    if (typeof product?.source_product_id !== "string" || product.source_product_id === "") {
      push(`${at}.source_product_id is required`);
    } else if (sourceProductIds.has(product.source_product_id)) {
      push(`${at}.source_product_id duplicates ${product.source_product_id}`);
    } else sourceProductIds.add(product.source_product_id);
    if (!isHttpsUrl(product?.source_product_url)) push(`${at}.source_product_url must be https`);
    if (typeof product?.source_handle !== "string" || product.source_handle === "") {
      push(`${at}.source_handle is required`);
    }
    if (!AVAILABILITY.includes(product?.source_availability)) {
      push(`${at}.source_availability is not a known availability state`);
    }

    const images = product?.images;
    if (!Array.isArray(images) || images.length === 0)
      push(`${at}.images must be a non-empty array`);
    else
      images.forEach((image, imageIndex) => {
        if (!isHttpsUrl(image)) push(`${at}.images[${imageIndex}] is not a valid https URL`);
      });

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
    if (
      product?.origin_region !== undefined &&
      product.origin_region !== null &&
      typeof product.origin_region !== "string"
    ) {
      push(`${at}.origin_region must be a string when present`);
    }
    if (
      product?.brand !== undefined &&
      product.brand !== null &&
      typeof product.brand !== "string"
    ) {
      push(`${at}.brand must be a string when present`);
    }

    const variants = Array.isArray(product?.variants) ? product.variants : null;
    if (!variants || variants.length === 0) {
      push(`${at}.variants must be a non-empty array`);
      return;
    }
    if (variants.filter((variant) => variant?.is_default === true).length !== 1) {
      push(`${at}.variants must contain exactly one default variant`);
    }
    variants.forEach((variant, variantIndex) => {
      const vAt = `${at}.variants[${variantIndex}]`;
      if (!SKU.test(String(variant?.sku ?? ""))) push(`${vAt}.sku is not a valid SKU`);
      else if (skus.has(variant.sku)) push(`${vAt}.sku duplicates ${variant.sku}`);
      else skus.add(variant.sku);

      if (typeof variant?.source_variant_id !== "string" || variant.source_variant_id === "") {
        push(`${vAt}.source_variant_id is required`);
      } else if (sourceVariantIds.has(variant.source_variant_id)) {
        push(`${vAt}.source_variant_id duplicates ${variant.source_variant_id}`);
      } else sourceVariantIds.add(variant.source_variant_id);
      // A literal source SKU is preserved verbatim or explicitly absent; it is
      // never fabricated from the generated CornerMex SKU.
      if (
        variant?.source_sku !== null &&
        (typeof variant?.source_sku !== "string" || variant.source_sku.trim() === "")
      ) {
        push(`${vAt}.source_sku must be a non-empty string or null`);
      }
      if (variant?.source_sku !== null && variant?.source_sku === variant?.sku) {
        push(`${vAt}.source_sku must not be the generated CornerMex SKU`);
      }

      if (!isMoney(variant?.price_aed)) push(`${vAt}.price_aed must be a non-negative AED amount`);
      if (!isMoney(variant?.source_effective_price_aed)) {
        push(`${vAt}.source_effective_price_aed must be a non-negative AED amount`);
      }
      // Founder pricing rule: CornerMex mirrors the effective source price exactly.
      if (variant?.price_aed !== variant?.source_effective_price_aed) {
        push(`${vAt}.price_aed must mirror source_effective_price_aed exactly (no markup)`);
      }
      if (
        variant?.source_regular_price_aed !== null &&
        variant?.source_regular_price_aed !== undefined &&
        !isMoney(variant.source_regular_price_aed)
      ) {
        push(`${vAt}.source_regular_price_aed must be a non-negative AED amount or null`);
      }

      if (!AVAILABILITY.includes(variant?.source_availability)) {
        push(`${vAt}.source_availability is not a known availability state`);
      }
      // Founder stock policy: available -> 1, everything else -> 0. Never above 1.
      if (variant?.initial_stock !== 0 && variant?.initial_stock !== 1) {
        push(`${vAt}.initial_stock must be 0 or 1`);
      } else if (AVAILABILITY.includes(variant?.source_availability)) {
        const expected = variant.source_availability === "AVAILABLE" ? 1 : 0;
        if (variant.initial_stock !== expected) {
          push(`${vAt}.initial_stock must be ${expected} for ${variant.source_availability}`);
        }
      }

      if (
        variant?.format_label !== null &&
        variant?.format_label !== undefined &&
        typeof variant.format_label !== "string"
      ) {
        push(`${vAt}.format_label must be a string or null`);
      }
      if (
        variant?.weight_grams !== undefined &&
        variant.weight_grams !== null &&
        (!Number.isInteger(variant.weight_grams) || variant.weight_grams <= 0)
      ) {
        push(`${vAt}.weight_grams must be a positive integer when present`);
      }
    });
  });

  if (errors.length > 0) return { valid: false, errors, plan: null };

  return { valid: true, errors: [], plan: buildActivationPlan(manifest) };
}

/**
 * Deterministic activation plan describing the required A2 writes, separated by
 * target table and stably ordered so two runs produce an identical plan.
 * Nothing here is executed.
 */
export function buildActivationPlan(manifest) {
  const categories = [...manifest.categories]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((category, index) => ({
      slug: category.slug,
      name_en: category.names.en,
      is_active: true,
      sort_order: index,
    }));

  const sortedProducts = [...manifest.products].sort((a, b) => a.slug.localeCompare(b.slug));

  const products = [];
  const translations = [];
  const images = [];
  const variants = [];
  const inventory = [];

  for (const product of sortedProducts) {
    products.push({
      slug: product.slug,
      category_slug: product.category,
      brand: product.brand ?? null,
      origin_region: product.origin_region ?? null,
      spice_level: product.spice_level ?? null,
      is_halal: product.is_halal ?? false,
      is_bulk: product.is_bulk ?? false,
      // Products are created active so they are shoppable, but activation
      // itself remains a separately authorized operation.
      status: "active",
      source_product_id: product.source_product_id,
      source_product_url: product.source_product_url,
      source_handle: product.source_handle,
    });
    translations.push({
      product_slug: product.slug,
      lang: "en",
      name: product.names.en,
      description: product.description ?? null,
    });
    product.images.forEach((url, index) => {
      images.push({ product_slug: product.slug, url, sort_order: index });
    });
    for (const variant of product.variants) {
      variants.push({
        product_slug: product.slug,
        sku: variant.sku,
        format_label: variant.format_label ?? null,
        weight_grams: variant.weight_grams ?? null,
        price_aed: variant.price_aed,
        // compare_at must never sit below price, so a stale or equal source
        // regular price is dropped rather than reshaped.
        compare_at_price_aed:
          typeof variant.source_regular_price_aed === "number" &&
          variant.source_regular_price_aed > variant.price_aed
            ? variant.source_regular_price_aed
            : null,
        stock: variant.initial_stock,
        is_default: variant.is_default === true,
        is_active: true,
        source_variant_id: variant.source_variant_id,
        source_sku: variant.source_sku ?? null,
      });
      inventory.push({ sku: variant.sku, quantity_on_hand: variant.initial_stock });
    }
  }

  return {
    planVersion: ACTIVATION_PLAN_VERSION,
    dryRun: true,
    source: manifest.source ?? null,
    source_price_observed_at: manifest.source_price_observed_at ?? null,
    categories,
    products,
    translations,
    images,
    variants,
    inventory,
    totals: {
      categories: categories.length,
      products: products.length,
      translations: translations.length,
      images: images.length,
      variants: variants.length,
      units: inventory.reduce((sum, row) => sum + row.quantity_on_hand, 0),
    },
  };
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
      JSON.stringify(
        { status: "activation_manifest_invalid", errors: result.errors.slice(0, 50) },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  const summary = { status: "activation_manifest_valid", dryRun: true, ...result.plan.totals };
  console.log(JSON.stringify(process.argv.includes("--plan") ? result.plan : summary, null, 2));
}
