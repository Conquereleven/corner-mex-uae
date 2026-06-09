#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
}

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);

const apply = args.has("apply");
const expectedCount = Number(args.get("expected-count") ?? 149);
const confirmedCount = Number(args.get("confirm-count") ?? 0);
const generatedAt = new Date().toISOString();
const timestamp = generatedAt.replace(/[:.]/g, "-");
const outputDir = resolve(String(args.get("output-dir") ?? `artifacts/seo-products/${timestamp}`));

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userAccessToken = process.env.SUPABASE_USER_ACCESS_TOKEN;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
}
if (apply && !serviceRoleKey && !userAccessToken) {
  throw new Error("Apply mode requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_USER_ACCESS_TOKEN");
}

const supabase = createClient(supabaseUrl, serviceRoleKey ?? publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: userAccessToken ? { headers: { Authorization: `Bearer ${userAccessToken}` } } : undefined,
});

const LANGS = ["en", "es", "ar"];

const categoryCopy = {
  snacks: {
    en: {
      label: "Mexican snacks and sweets",
      shortUse: "enjoy as a snack, share at gatherings or add to a Mexican pantry",
      longUse:
        "Serve it as an everyday snack, share it with friends or include it in a selection of Mexican treats.",
      keywords: ["Mexican snacks Dubai", "Mexican sweets UAE"],
    },
    es: {
      label: "snacks y dulces mexicanos",
      shortUse: "disfrutar como snack, compartir en reuniones o sumar a una despensa mexicana",
      longUse:
        "Disfrútalo como snack cotidiano, compártelo en reuniones o inclúyelo en una selección de antojitos mexicanos.",
      keywords: ["snacks mexicanos en Dubái", "dulces mexicanos EAU"],
    },
    ar: {
      label: "الوجبات الخفيفة والحلويات المكسيكية",
      shortUse: "الاستمتاع به كوجبة خفيفة أو مشاركته في التجمعات أو إضافته إلى مؤونة مكسيكية",
      longUse:
        "قدّمه كوجبة خفيفة يومية أو شاركه مع الأصدقاء أو أضفه إلى تشكيلة من المنتجات المكسيكية.",
      keywords: ["وجبات خفيفة مكسيكية دبي", "حلويات مكسيكية الإمارات"],
    },
  },
  salsas: {
    en: {
      label: "Mexican sauces and salsas",
      shortUse: "add flavour to tacos, snacks, marinades and everyday meals",
      longUse:
        "Use it to add Mexican flavour to tacos, snacks, marinades, sauces or everyday cooking.",
      keywords: ["Mexican sauces UAE", "Mexican salsa Dubai"],
    },
    es: {
      label: "salsas mexicanas",
      shortUse: "dar sabor a tacos, snacks, marinados y comidas de todos los días",
      longUse:
        "Úsalo para dar sabor mexicano a tacos, snacks, marinados, salsas o comidas de todos los días.",
      keywords: ["salsas mexicanas EAU", "salsa mexicana Dubái"],
    },
    ar: {
      label: "الصلصات المكسيكية",
      shortUse: "إضافة نكهة إلى التاكو والوجبات الخفيفة والتتبيلات والأطباق اليومية",
      longUse: "استخدمه لإضافة نكهة مكسيكية إلى التاكو والوجبات الخفيفة والتتبيلات والطبخ اليومي.",
      keywords: ["صلصات مكسيكية الإمارات", "سالسا مكسيكية دبي"],
    },
  },
  masa: {
    en: {
      label: "Mexican masa, tortillas and flours",
      shortUse: "prepare tortillas, tamales and Mexican-style recipes",
      longUse:
        "Use it for tortillas, tamales and other Mexican-style recipes, following the preparation details on the pack.",
      keywords: ["Mexican masa UAE", "Mexican tortillas Dubai"],
    },
    es: {
      label: "masa, tortillas y harinas mexicanas",
      shortUse: "preparar tortillas, tamales y recetas de estilo mexicano",
      longUse:
        "Úsalo para tortillas, tamales y otras recetas de estilo mexicano, siguiendo las instrucciones del empaque.",
      keywords: ["masa mexicana EAU", "tortillas mexicanas Dubái"],
    },
    ar: {
      label: "الماسا والتورتيلا والدقيق المكسيكي",
      shortUse: "تحضير التورتيلا والتامال ووصفات على الطريقة المكسيكية",
      longUse:
        "استخدمه لتحضير التورتيلا والتامال ووصفات أخرى على الطريقة المكسيكية وفق تعليمات العبوة.",
      keywords: ["ماسا مكسيكية الإمارات", "تورتيلا مكسيكية دبي"],
    },
  },
  beverages: {
    en: {
      label: "Mexican drinks",
      shortUse: "serve with meals, gatherings or everyday refreshments",
      longUse:
        "Enjoy it with meals, at gatherings or as part of a selection of Mexican drinks and refreshments.",
      keywords: ["Mexican drinks UAE", "Mexican beverages Dubai"],
    },
    es: {
      label: "bebidas mexicanas",
      shortUse: "acompañar comidas, reuniones o momentos cotidianos",
      longUse:
        "Disfrútalo con comidas, en reuniones o como parte de una selección de bebidas mexicanas.",
      keywords: ["bebidas mexicanas EAU", "bebidas mexicanas Dubái"],
    },
    ar: {
      label: "المشروبات المكسيكية",
      shortUse: "تقديمه مع الوجبات أو في التجمعات أو كمرطّب يومي",
      longUse: "استمتع به مع الوجبات أو في التجمعات أو ضمن تشكيلة من المشروبات المكسيكية.",
      keywords: ["مشروبات مكسيكية الإمارات", "مشروبات مكسيكية دبي"],
    },
  },
  chiles: {
    en: {
      label: "Mexican chiles",
      shortUse: "bring depth, aroma and heat to sauces, marinades and recipes",
      longUse:
        "Use it to bring depth, aroma and heat to sauces, marinades and Mexican-style dishes.",
      keywords: ["Mexican chiles UAE", "dried chiles Dubai"],
    },
    es: {
      label: "chiles mexicanos",
      shortUse: "aportar profundidad, aroma y picor a salsas y recetas",
      longUse:
        "Úsalo para aportar profundidad, aroma y picor a salsas, marinados y platillos de estilo mexicano.",
      keywords: ["chiles mexicanos EAU", "chiles secos Dubái"],
    },
    ar: {
      label: "الفلفل المكسيكي",
      shortUse: "إضافة العمق والرائحة والحرارة إلى الصلصات والتتبيلات",
      longUse:
        "استخدمه لإضافة العمق والرائحة والحرارة إلى الصلصات والتتبيلات والأطباق على الطريقة المكسيكية.",
      keywords: ["فلفل مكسيكي الإمارات", "فلفل مجفف دبي"],
    },
  },
  bulk: {
    en: {
      label: "Mexican food for wholesale",
      shortUse: "stock restaurant kitchens, hospitality operations or retail shelves",
      longUse:
        "A practical option for restaurant kitchens, hospitality operations, catering and retail supply in the UAE.",
      keywords: ["Mexican food wholesale UAE", "Mexican food supplier Dubai"],
    },
    es: {
      label: "productos mexicanos al mayoreo",
      shortUse: "abastecer cocinas, negocios de hospitalidad o puntos de venta",
      longUse:
        "Una opción práctica para cocinas de restaurantes, hospitalidad, catering y venta minorista en EAU.",
      keywords: ["productos mexicanos mayoreo EAU", "proveedor mexicano Dubái"],
    },
    ar: {
      label: "منتجات غذائية مكسيكية بالجملة",
      shortUse: "تزويد مطابخ المطاعم وقطاع الضيافة ومتاجر التجزئة",
      longUse: "خيار عملي لمطابخ المطاعم وقطاع الضيافة وخدمات التموين ومتاجر التجزئة في الإمارات.",
      keywords: ["أغذية مكسيكية بالجملة الإمارات", "مورد أغذية مكسيكية دبي"],
    },
  },
};

const fallbackCopy = {
  en: {
    label: "Mexican pantry products",
    shortUse: "add to everyday meals and Mexican-style recipes",
    longUse: "Add it to your pantry for Mexican-style recipes, snacks or everyday cooking.",
    keywords: ["Mexican groceries UAE", "Mexican food Dubai"],
  },
  es: {
    label: "productos de despensa mexicana",
    shortUse: "sumar a comidas cotidianas y recetas de estilo mexicano",
    longUse:
      "Súmalo a tu despensa para recetas de estilo mexicano, snacks o comidas de todos los días.",
    keywords: ["productos mexicanos en Dubái", "tienda mexicana EAU"],
  },
  ar: {
    label: "منتجات المؤونة المكسيكية",
    shortUse: "إضافته إلى الوجبات اليومية والوصفات على الطريقة المكسيكية",
    longUse: "أضفه إلى مؤونتك للوصفات على الطريقة المكسيكية أو الوجبات الخفيفة أو الطبخ اليومي.",
    keywords: ["منتجات مكسيكية دبي", "بقالة مكسيكية الإمارات"],
  },
};

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value) {
  const text = cleanText(value);
  if (!text) return "";
  return /[.!?؟]$/.test(text) ? text : `${text}.`;
}

function truncate(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const shortened = text
    .slice(0, Math.max(1, max - 1))
    .replace(/\s+\S*$/, "")
    .trim();
  return `${shortened.replace(/[.,;:!?؟-]+$/, "")}…`;
}

function seoTitle(name, suffix, max = 60) {
  const cleanName = cleanText(name);
  const cleanSuffix = cleanText(suffix);
  const available = Math.max(12, max - cleanSuffix.length - 3);
  return `${truncate(cleanName, available)} | ${cleanSuffix}`;
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function translationMap(product) {
  return Object.fromEntries(product.translations.map((item) => [item.lang, item]));
}

function localizedName(product, lang) {
  const translations = translationMap(product);
  return cleanText(
    translations[lang]?.name ??
      translations.en?.name ??
      translations.es?.name ??
      translations.ar?.name,
  );
}

function buildLocalizedSeo(product, lang) {
  const translations = translationMap(product);
  const name = localizedName(product, lang);
  const categorySlug = product.category?.slug ?? "pantry";
  const copy = categoryCopy[categorySlug]?.[lang] ?? fallbackCopy[lang];
  const existing = cleanText(translations[lang]?.description);
  const brand = cleanText(product.brand);

  const intro =
    lang === "es"
      ? `Compra ${name} en EAU. Es una opción de ${copy.label} para ${copy.shortUse}.`
      : lang === "ar"
        ? `اشترِ ${name} في الإمارات. منتج من ${copy.label} مناسب من أجل ${copy.shortUse}.`
        : `Buy ${name} in the UAE. A ${copy.label} option to ${copy.shortUse}.`;
  const availability =
    lang === "es"
      ? "Disponible en Corner Mex para entrega en Dubái, Abu Dabi y otros emiratos."
      : lang === "ar"
        ? "متوفر من Corner Mex للتوصيل في دبي وأبوظبي وبقية الإمارات."
        : "Available from Corner Mex for delivery in Dubai, Abu Dhabi and across the UAE.";
  const longDescription =
    existing.length >= 80
      ? truncate(
          `${sentence(existing)} ${/UAE|EAU|الإمارات|Dubai|Dubái|دبي/i.test(existing) ? "" : availability}`,
          850,
        )
      : truncate(
          `${existing ? `${sentence(existing)} ` : ""}${intro} ${copy.longUse} ${availability}`,
          850,
        );
  const shortDescription = truncate(intro, 220);
  const metaDescription = truncate(`${intro} ${availability}`, 158);
  const titleSuffix =
    lang === "es"
      ? "EAU · Corner Mex"
      : lang === "ar"
        ? "الإمارات · Corner Mex"
        : "UAE · Corner Mex";
  const title = seoTitle(name, titleSuffix);
  const keywords = unique([
    name,
    brand,
    copy.label,
    ...copy.keywords,
    lang === "es"
      ? "productos mexicanos en EAU"
      : lang === "ar"
        ? "منتجات مكسيكية في الإمارات"
        : "Mexican groceries UAE",
    lang === "es"
      ? "entrega de productos mexicanos Dubái"
      : lang === "ar"
        ? "توصيل منتجات مكسيكية دبي"
        : "Mexican food delivery Dubai",
  ]);

  return {
    title,
    meta_description: metaDescription,
    short_description: shortDescription,
    long_description: longDescription,
    keywords,
  };
}

function buildAltText(product, imageIndex) {
  const name = localizedName(product, "en");
  const brand = cleanText(product.brand);
  const category = categoryCopy[product.category?.slug]?.en?.label ?? fallbackCopy.en.label;
  const suffix = imageIndex > 0 ? `, product image ${imageIndex + 1}` : "";
  return truncate(
    `${name}${brand && !name.toLowerCase().includes(brand.toLowerCase()) ? ` by ${brand}` : ""}, ${category} available in the UAE${suffix}`,
    180,
  );
}

function buildPlan(product) {
  const localized = Object.fromEntries(
    LANGS.map((lang) => [lang, buildLocalizedSeo(product, lang)]),
  );
  return {
    productId: product.id,
    slug: product.slug,
    seo: {
      schema_version: 1,
      generated_at: generatedAt,
      category: {
        slug: product.category?.slug ?? null,
        en: product.category?.name_en ?? null,
        es: product.category?.name_es ?? null,
        ar: product.category?.name_ar ?? null,
      },
      locales: localized,
    },
    translations: LANGS.map((lang) => ({
      product_id: product.id,
      lang,
      name: localizedName(product, lang),
      description: localized[lang].long_description,
    })),
    images: product.images
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image, index) => ({
        id: image.id,
        alt_text: buildAltText(product, index),
      })),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function generateSql(plans) {
  const productValues = plans
    .map((plan) => `(${sqlString(plan.productId)}::uuid, ${sqlJson(plan.seo)})`)
    .join(",\n");
  const translationValues = plans
    .flatMap((plan) => plan.translations)
    .map(
      (row) =>
        `(${sqlString(row.product_id)}::uuid, ${sqlString(row.lang)}::public.lang_code, ${sqlString(row.name)}, ${sqlString(row.description)})`,
    )
    .join(",\n");
  const imageValues = plans
    .flatMap((plan) => plan.images)
    .map((row) => `(${sqlString(row.id)}::uuid, ${sqlString(row.alt_text)})`)
    .join(",\n");

  return `-- Generated by scripts/seo-products.mjs
-- Products: ${plans.length}
-- Slugs are intentionally preserved to avoid breaking existing URLs.
BEGIN;

CREATE TEMP TABLE seo_product_updates (
  product_id uuid PRIMARY KEY,
  seo jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO seo_product_updates (product_id, seo) VALUES
${productValues};

DO $$
DECLARE
  expected_count integer := ${plans.length};
  matched_count integer;
BEGIN
  SELECT count(*) INTO matched_count
  FROM public.products p
  JOIN seo_product_updates u ON u.product_id = p.id
  WHERE p.status = 'active';

  IF matched_count <> expected_count THEN
    RAISE EXCEPTION 'SEO migration aborted: expected % active products, found %', expected_count, matched_count;
  END IF;
END $$;

UPDATE public.products p
SET attrs = jsonb_set(COALESCE(p.attrs, '{}'::jsonb), '{seo}', u.seo, true)
FROM seo_product_updates u
WHERE p.id = u.product_id
  AND p.status = 'active';

CREATE TEMP TABLE seo_translation_updates (
  product_id uuid NOT NULL,
  lang public.lang_code NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  PRIMARY KEY (product_id, lang)
) ON COMMIT DROP;

INSERT INTO seo_translation_updates (product_id, lang, name, description) VALUES
${translationValues};

INSERT INTO public.product_translations (product_id, lang, name, description)
SELECT product_id, lang, name, description
FROM seo_translation_updates
ON CONFLICT (product_id, lang) DO UPDATE
SET description = EXCLUDED.description;

CREATE TEMP TABLE seo_image_updates (
  image_id uuid PRIMARY KEY,
  alt_text text NOT NULL
) ON COMMIT DROP;

${imageValues ? `INSERT INTO seo_image_updates (image_id, alt_text) VALUES\n${imageValues};\n\n` : ""}UPDATE public.product_images i
SET alt_text = u.alt_text
FROM seo_image_updates u
WHERE i.id = u.image_id;

DO $$
DECLARE
  product_count integer;
  translation_count integer;
  image_count integer;
BEGIN
  SELECT count(*) INTO product_count
  FROM public.products p
  JOIN seo_product_updates u ON u.product_id = p.id
  WHERE p.attrs ? 'seo';

  SELECT count(*) INTO translation_count
  FROM public.product_translations t
  JOIN seo_translation_updates u
    ON u.product_id = t.product_id AND u.lang = t.lang;

  SELECT count(*) INTO image_count
  FROM public.product_images i
  JOIN seo_image_updates u ON u.image_id = i.id
  WHERE i.alt_text IS NOT NULL AND btrim(i.alt_text) <> '';

  IF product_count <> ${plans.length}
    OR translation_count <> ${plans.length * LANGS.length}
    OR image_count <> ${plans.reduce((sum, plan) => sum + plan.images.length, 0)}
  THEN
    RAISE EXCEPTION 'SEO validation failed: products %, translations %, images %',
      product_count, translation_count, image_count;
  END IF;
END $$;

COMMIT;
`;
}

async function fetchProducts() {
  const all = [];
  const pageSize = 100;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id, seller_id, category_id, slug, brand, status, is_halal, is_bulk,
        spice_level, origin_region, attrs, created_at, updated_at,
        category:categories(slug, name_en, name_es, name_ar),
        translations:product_translations(lang, name, description),
        images:product_images(id, product_id, url, alt_text, sort_order, created_at),
        variants:product_variants(id, product_id, sku, format_label, weight_grams, price_aed, compare_at_price_aed, stock, bulk_tiers, is_default, created_at)
      `,
      )
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

function buildAudit(products) {
  const slugCounts = new Map();
  const nameCounts = new Map();
  for (const product of products) {
    slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1);
    const enName = localizedName(product, "en").toLowerCase();
    if (enName) nameCounts.set(enName, (nameCounts.get(enName) ?? 0) + 1);
  }

  return products.flatMap((product) => {
    const issues = [];
    const translations = translationMap(product);
    if (!localizedName(product, "en")) issues.push("missing_name");
    if (!product.category) issues.push("missing_category");
    if (!cleanText(product.brand)) issues.push("missing_brand");
    if (!product.images.length) issues.push("missing_images");
    if (!product.variants.length) issues.push("missing_variants");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) {
      issues.push("invalid_slug");
    }
    if ((slugCounts.get(product.slug) ?? 0) > 1) issues.push("duplicate_slug");
    if (
      localizedName(product, "en") &&
      (nameCounts.get(localizedName(product, "en").toLowerCase()) ?? 0) > 1
    ) {
      issues.push("duplicate_english_name");
    }
    for (const lang of LANGS) {
      if (!translations[lang]) issues.push(`missing_${lang}_translation`);
      if (!cleanText(translations[lang]?.description)) {
        issues.push(`missing_${lang}_description`);
      }
    }
    if (product.images.some((image) => !cleanText(image.alt_text))) {
      issues.push("missing_image_alt");
    }
    return issues.length
      ? [
          {
            product_id: product.id,
            slug: product.slug,
            name: localizedName(product, "en"),
            issues,
          },
        ]
      : [];
  });
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function applyPlan(plans) {
  await mapLimit(plans, 6, async (plan) => {
    const { data: current, error: readError } = await supabase
      .from("products")
      .select("attrs")
      .eq("id", plan.productId)
      .single();
    if (readError) throw new Error(`${plan.slug}: ${readError.message}`);
    const attrs =
      current?.attrs && typeof current.attrs === "object" && !Array.isArray(current.attrs)
        ? current.attrs
        : {};
    const { error } = await supabase
      .from("products")
      .update({ attrs: { ...attrs, seo: plan.seo } })
      .eq("id", plan.productId)
      .eq("status", "active");
    if (error) throw new Error(`${plan.slug}: ${error.message}`);
  });

  const translations = plans.flatMap((plan) => plan.translations);
  for (let index = 0; index < translations.length; index += 100) {
    const { error } = await supabase
      .from("product_translations")
      .upsert(translations.slice(index, index + 100), {
        onConflict: "product_id,lang",
      });
    if (error) throw new Error(error.message);
  }

  const images = plans.flatMap((plan) => plan.images);
  await mapLimit(images, 8, async (image) => {
    const { error } = await supabase
      .from("product_images")
      .update({ alt_text: image.alt_text })
      .eq("id", image.id);
    if (error) throw new Error(error.message);
  });
}

async function verify(plans) {
  const products = await fetchProducts();
  const plannedIds = new Set(plans.map((plan) => plan.productId));
  const selected = products.filter((product) => plannedIds.has(product.id));
  return {
    products_with_seo: selected.filter(
      (product) =>
        product.attrs &&
        typeof product.attrs === "object" &&
        !Array.isArray(product.attrs) &&
        product.attrs.seo,
    ).length,
    translations: selected.reduce(
      (sum, product) =>
        sum + product.translations.filter((translation) => LANGS.includes(translation.lang)).length,
      0,
    ),
    images_with_alt: selected.reduce(
      (sum, product) => sum + product.images.filter((image) => cleanText(image.alt_text)).length,
      0,
    ),
  };
}

mkdirSync(outputDir, { recursive: true });
const products = await fetchProducts();
const audit = buildAudit(products);
const plans = products.map(buildPlan);
const totalImages = products.reduce((sum, product) => sum + product.images.length, 0);
const blockers = audit.filter((item) =>
  item.issues.some((issue) => ["missing_name", "duplicate_slug"].includes(issue)),
);

const report = {
  generated_at: new Date().toISOString(),
  mode: apply ? "apply" : "dry-run",
  expected_products: expectedCount,
  detected_active_products: products.length,
  expected_count_matches: products.length === expectedCount,
  products_planned: plans.length,
  translations_before: products.reduce((sum, product) => sum + product.translations.length, 0),
  translations_after: plans.length * LANGS.length,
  images: totalImages,
  products_with_issues: audit.length,
  blocking_issues: blockers.length,
  preserved_fields: [
    "product ids",
    "slugs",
    "prices",
    "stock",
    "SKUs",
    "image URLs",
    "seller/category relationships",
  ],
  issues: audit,
};

writeFileSync(resolve(outputDir, "products-backup.json"), `${JSON.stringify(products, null, 2)}\n`);
writeFileSync(resolve(outputDir, "seo-products-plan.json"), `${JSON.stringify(plans, null, 2)}\n`);
writeFileSync(
  resolve(outputDir, "seo-products-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
writeFileSync(resolve(outputDir, "seo-products-update.sql"), generateSql(plans));
writeFileSync(
  resolve(outputDir, "products-incomplete.csv"),
  [
    ["product_id", "slug", "name", "issues"].map(csvEscape).join(","),
    ...audit.map((item) =>
      [item.product_id, item.slug, item.name, item.issues.join("|")].map(csvEscape).join(","),
    ),
  ].join("\n") + "\n",
);

if (blockers.length) {
  throw new Error(
    `Dry-run found ${blockers.length} blocking product issue(s). Review ${resolve(outputDir, "seo-products-report.json")}`,
  );
}

if (apply) {
  if (confirmedCount !== products.length) {
    throw new Error(
      `Apply aborted: pass --confirm-count=${products.length} after reviewing the dry-run`,
    );
  }
  await applyPlan(plans);
  const verification = await verify(plans);
  report.verification = verification;
  report.applied = true;
  writeFileSync(
    resolve(outputDir, "seo-products-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      outputDir,
      detectedProducts: products.length,
      expectedProducts: expectedCount,
      translationsBefore: report.translations_before,
      translationsAfter: report.translations_after,
      images: totalImages,
      productsWithIssues: audit.length,
      blockers: blockers.length,
      verification: report.verification ?? null,
    },
    null,
    2,
  ),
);
