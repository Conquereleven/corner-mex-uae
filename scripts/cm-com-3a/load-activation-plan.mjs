// CM-COM-3A — canonical catalog load mechanism.
//
// Consumes ONLY a validated canonical activation manifest, builds the
// deterministic activation plan, and emits a single transactional SQL artifact
// that applies that plan to the real A2 schema (categories, products,
// product_translations, product_images, product_variants, inventory).
//
// DEFAULT BEHAVIOUR IS NON-WRITING. Without `--execute` this script only plans
// and prints/writes SQL; it opens no database connection at all. Execution
// additionally requires an explicit database URL supplied by the operator; no
// credential is embedded here and no connection string is defaulted.
//
// Usage:
//   node scripts/cm-com-3a/load-activation-plan.mjs <manifest.json>
//   node scripts/cm-com-3a/load-activation-plan.mjs <manifest.json> --sql <out.sql>
//   CORNERMEX_ACTIVATION_DATABASE_URL=... \
//     node scripts/cm-com-3a/load-activation-plan.mjs <manifest.json> --execute

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { validateActivationManifest } from "./validate-activation-manifest.mjs";

export const DATABASE_URL_ENV = "CORNERMEX_ACTIVATION_DATABASE_URL";

/** SQL string literal. Single quotes are doubled; null stays a real NULL. */
export const sqlText = (value) => {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const sqlNumber = (value) => (value === null || value === undefined ? "null" : String(value));
const sqlBool = (value) => (value ? "true" : "false");

/**
 * Render the plan as ONE transaction. Every statement is an idempotent upsert
 * keyed on the natural identity (category slug, product slug, variant SKU), so
 * re-running the same plan converges instead of duplicating rows. Any failure
 * aborts the whole transaction: there is no silent partial activation.
 */
export function renderPlanSql(plan) {
  const lines = [
    "-- CM-COM-3A canonical catalog activation.",
    `-- plan: ${plan.planVersion}`,
    `-- source: ${plan.source ?? "unknown"}`,
    `-- source_price_observed_at: ${plan.source_price_observed_at ?? "unknown"}`,
    "-- Generated from a VALIDATED canonical activation manifest. Do not hand-edit.",
    "begin;",
    "set local search_path = public, pg_temp;",
  ];

  for (const category of plan.categories) {
    lines.push(
      `insert into public.categories (slug, name_en, is_active, sort_order) values (${sqlText(
        category.slug,
      )}, ${sqlText(category.name_en)}, ${sqlBool(category.is_active)}, ${sqlNumber(
        category.sort_order,
      )}) on conflict (slug) do update set name_en = excluded.name_en, is_active = excluded.is_active, sort_order = excluded.sort_order, updated_at = now();`,
    );
  }

  for (const product of plan.products) {
    lines.push(
      `insert into public.products (slug, category_id, brand, origin_region, spice_level, is_halal, is_bulk, status, attrs) select ${sqlText(
        product.slug,
      )}, c.id, ${sqlText(product.brand)}, ${sqlText(product.origin_region)}, ${sqlNumber(
        product.spice_level,
      )}, ${sqlBool(product.is_halal)}, ${sqlBool(product.is_bulk)}, ${sqlText(
        product.status,
      )}, jsonb_build_object('source_product_id', ${sqlText(
        product.source_product_id,
      )}, 'source_product_url', ${sqlText(product.source_product_url)}, 'source_handle', ${sqlText(
        product.source_handle,
      )}) from public.categories c where c.slug = ${sqlText(
        product.category_slug,
      )} on conflict (slug) do update set category_id = excluded.category_id, brand = excluded.brand, origin_region = excluded.origin_region, spice_level = excluded.spice_level, is_halal = excluded.is_halal, is_bulk = excluded.is_bulk, status = excluded.status, attrs = excluded.attrs, updated_at = now();`,
    );
  }

  for (const translation of plan.translations) {
    lines.push(
      `insert into public.product_translations (product_id, lang, name, description) select p.id, ${sqlText(
        translation.lang,
      )}, ${sqlText(translation.name)}, ${sqlText(
        translation.description,
      )} from public.products p where p.slug = ${sqlText(
        translation.product_slug,
      )} on conflict (product_id, lang) do update set name = excluded.name, description = excluded.description, updated_at = now();`,
    );
  }

  // Images have no natural unique key in A2, so the product's image set is
  // replaced wholesale inside the same transaction rather than accumulating.
  const imageProducts = [...new Set(plan.images.map((image) => image.product_slug))];
  for (const slug of imageProducts) {
    lines.push(
      `delete from public.product_images where product_id = (select id from public.products where slug = ${sqlText(
        slug,
      )});`,
    );
  }
  for (const image of plan.images) {
    lines.push(
      `insert into public.product_images (product_id, url, sort_order) select p.id, ${sqlText(
        image.url,
      )}, ${sqlNumber(image.sort_order)} from public.products p where p.slug = ${sqlText(
        image.product_slug,
      )};`,
    );
  }

  for (const variant of plan.variants) {
    lines.push(
      `insert into public.product_variants (product_id, sku, format_label, weight_grams, price_aed, compare_at_price_aed, stock, is_default, is_active) select p.id, ${sqlText(
        variant.sku,
      )}, ${sqlText(variant.format_label)}, ${sqlNumber(
        variant.weight_grams,
      )}, ${sqlNumber(variant.price_aed)}, ${sqlNumber(
        variant.compare_at_price_aed,
      )}, ${sqlNumber(variant.stock)}, ${sqlBool(variant.is_default)}, ${sqlBool(
        variant.is_active,
      )} from public.products p where p.slug = ${sqlText(
        variant.product_slug,
      )} on conflict (sku) do update set format_label = excluded.format_label, weight_grams = excluded.weight_grams, price_aed = excluded.price_aed, compare_at_price_aed = excluded.compare_at_price_aed, stock = excluded.stock, is_default = excluded.is_default, is_active = excluded.is_active, updated_at = now();`,
    );
  }

  for (const row of plan.inventory) {
    lines.push(
      `insert into public.inventory (variant_id, quantity_on_hand) select v.id, ${sqlNumber(
        row.quantity_on_hand,
      )} from public.product_variants v where v.sku = ${sqlText(
        row.sku,
      )} on conflict (variant_id) do update set quantity_on_hand = excluded.quantity_on_hand, updated_at = now();`,
    );
  }

  lines.push("commit;");
  return `${lines.join("\n")}\n`;
}

export function parseArgs(argv) {
  const options = { manifest: null, sql: null, execute: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") options.execute = true;
    else if (arg === "--sql") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--sql requires a file path");
      options.sql = value;
      i += 1;
    } else if (arg.startsWith("--")) throw new Error(`unknown argument: ${arg}`);
    else if (options.manifest === null) options.manifest = arg;
    else throw new Error("only one manifest may be supplied");
  }
  if (options.manifest === null) throw new Error("a manifest path is required");
  return options;
}

/**
 * Plan a load. Returns the validated plan and its SQL, or throws on invalid
 * input. This function performs NO database work of any kind.
 */
export function planLoad(manifest) {
  const result = validateActivationManifest(manifest);
  if (!result.valid) {
    const error = new Error("ACTIVATION_MANIFEST_INVALID");
    error.errors = result.errors.slice(0, 50);
    throw error;
  }
  return { plan: result.plan, sql: renderPlanSql(result.plan) };
}

const invokedDirectly = process.argv[1]?.endsWith("load-activation-plan.mjs");
if (invokedDirectly) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ status: "activation_load_bad_usage", error: error.message }));
    process.exit(1);
  }

  let planned;
  try {
    planned = planLoad(JSON.parse(readFileSync(options.manifest, "utf8")));
  } catch (error) {
    console.error(
      JSON.stringify(
        { status: "activation_load_refused", error: error.message, errors: error.errors ?? [] },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (options.sql) {
    mkdirSync(path.dirname(path.resolve(options.sql)), { recursive: true });
    writeFileSync(path.resolve(options.sql), planned.sql, "utf8");
  }

  if (!options.execute) {
    // Default path: nothing was connected to and nothing was written.
    console.log(
      JSON.stringify(
        {
          status: "activation_load_dry_run",
          executed: false,
          wroteSql: options.sql ?? null,
          statements: planned.sql.split("\n").filter((line) => line.endsWith(";")).length,
          ...planned.plan.totals,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const databaseUrl = process.env[DATABASE_URL_ENV];
  if (!databaseUrl) {
    console.error(
      JSON.stringify({
        status: "activation_load_refused",
        error: `${DATABASE_URL_ENV} is required`,
      }),
    );
    process.exit(1);
  }
  // One transaction, ON_ERROR_STOP: either the whole catalog applies or none of it.
  execFileSync("psql", ["-d", databaseUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
    input: planned.sql,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(JSON.stringify({ status: "activation_load_executed", ...planned.plan.totals }));
}
