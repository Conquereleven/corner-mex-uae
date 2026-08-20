import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

import { B2B_CATEGORIES, WAVE_1_PRODUCTS } from "../../src/features/b2b-catalog/wave1-products.ts";
import {
  QUOTE_SELECTION_STORAGE_KEY,
  readQuoteSelection,
  sanitizeQuoteSelection,
} from "../../src/features/b2b-catalog/quote-selection.ts";

const ROOT = process.cwd();
const PUBLIC_B2B_COMPONENTS = [
  "B2bCatalogHero.tsx",
  "B2bCategoryNav.tsx",
  "B2bProductCard.tsx",
  "B2bProductGrid.tsx",
  "B2bQuoteBar.tsx",
  "EmptyQuoteSelection.tsx",
  "ManualContactActions.tsx",
  "ManualQuoteRequestForm.tsx",
  "ManualQuoteRequestPreview.tsx",
  "QuoteSelectionList.tsx",
];
const SURFACE_ROOTS = [
  ...PUBLIC_B2B_COMPONENTS.map((name) => `src/components/b2b/${name}`),
  "src/features/b2b-catalog",
  "src/routes/b2b_.catalog.tsx",
  "src/routes/b2b_.quote.tsx",
  "src/lib/public-contact.ts",
];

function sourceFiles(path) {
  const absolute = join(ROOT, path);
  if (!path.includes(".") || path.endsWith("b2b-catalog")) {
    return readdirSync(absolute, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name));
  }
  return [absolute];
}

const SURFACE_FILES = SURFACE_ROOTS.flatMap(sourceFiles);
const SURFACE_SOURCE = SURFACE_FILES.map((file) => readFileSync(file, "utf8")).join("\n");

function memoryStorage(initialValue) {
  let value = initialValue;
  return {
    getItem(key) {
      return key === QUOTE_SELECTION_STORAGE_KEY ? value : null;
    },
    setItem(key, nextValue) {
      if (key === QUOTE_SELECTION_STORAGE_KEY) value = nextValue;
    },
    removeItem(key) {
      if (key === QUOTE_SELECTION_STORAGE_KEY) value = null;
    },
  };
}

test("1. catalog contains exactly 15 Wave 1 products", () => {
  assert.equal(WAVE_1_PRODUCTS.length, 15);
});

test("2. category counts are exactly 7/5/3", () => {
  assert.deepEqual(
    Object.fromEntries(
      B2B_CATEGORIES.map(({ id }) => [
        id,
        WAVE_1_PRODUCTS.filter((product) => product.categoryId === id).length,
      ]),
    ),
    { beverages: 7, snacks: 5, "pantry-sauces": 3 },
  );
  assert.deepEqual(
    B2B_CATEGORIES.map(({ count }) => count),
    [7, 5, 3],
  );
});

test("3. canonical product IDs are unique", () => {
  const ids = WAVE_1_PRODUCTS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("4. catalog surface contains no public numeric product price", () => {
  assert.doesNotMatch(SURFACE_SOURCE, /\bAED\s*\d|\b(?:unit|retail|sale)[_-]?price\b/i);
  assert.match(SURFACE_SOURCE, /Price on request/);
});

test("5. Intermex retail pricing is not rendered", () => {
  assert.doesNotMatch(SURFACE_SOURCE, /Intermex/i);
});

test("6. sales surface has no cart, checkout, payment, or order controls", () => {
  assert.doesNotMatch(
    SURFACE_SOURCE,
    /(?:href|to)=["'][^"']*\/(?:cart|checkout|payment|orders?)(?:[\/"'])/i,
  );
  assert.doesNotMatch(SURFACE_SOURCE, />\s*(?:Add to cart|Checkout|Pay now|Place order)\s*</i);
});

test("7. commerce and wishlist control APIs are absent", () => {
  assert.doesNotMatch(SURFACE_SOURCE, /\b(?:addToCart|useCart|WishlistButton)\b/);
});

test("8. public B2B surface has no direct Supabase reads or writes", () => {
  assert.doesNotMatch(SURFACE_SOURCE, /\.from\s*\(|\.rpc\s*\(/i);
});

test("9. quote submission is explicit and limited to canonical B2B intake", () => {
  const quoteRoute = readFileSync(join(ROOT, "src/routes/b2b_.quote.tsx"), "utf8");
  assert.match(quoteRoute, /useServerFn\(submitB2bLead\)/);
  assert.match(quoteRoute, /onSubmit=\{\(\) => submit\.mutate\(\)\}/);
  assert.doesNotMatch(
    SURFACE_SOURCE,
    /\bfetch\s*\(|<form\b|type=["']submit["']|\baction\s*=/,
  );
});

test("10. session storage key is exact", () => {
  assert.equal(QUOTE_SELECTION_STORAGE_KEY, "cm.quoteSelection");
  assert.doesNotMatch(SURFACE_SOURCE, /\blocalStorage\b|document\.cookie/);
});

test("11. invalid stored IDs fail closed", () => {
  const validId = WAVE_1_PRODUCTS[0].id;
  const hook = readFileSync(join(ROOT, "src/features/b2b-catalog/use-quote-selection.ts"), "utf8");
  assert.deepEqual(sanitizeQuoteSelection(["unknown-product", validId, 42, null]), [validId]);
  assert.deepEqual(readQuoteSelection(memoryStorage('["unknown-product"]')), []);
  assert.deepEqual(readQuoteSelection(memoryStorage("not-json")), []);
  assert.match(hook, /useEffect\(\(\) => \{\s*setSelectedProductIds\(readQuoteSelection\(\)\)/);
});

test("12. request copy distinguishes prepared and persisted states truthfully", () => {
  const preview = readFileSync(
    join(ROOT, "src/components/b2b/ManualQuoteRequestPreview.tsx"),
    "utf8",
  );
  assert.match(preview, /Your request is ready\./);
  assert.match(preview, /Enquiry received by CornerMex\./);
  assert.match(preview, /does not\s+create an order/i);
  assert.doesNotMatch(preview, /order confirmed|quote confirmed|payment confirmed/i);
});

test("13. mailto uses the existing public contact configuration", () => {
  const source = readFileSync(join(ROOT, "src/components/b2b/ManualContactActions.tsx"), "utf8");
  assert.match(source, /mailto\(PUBLIC_CONTACT\.b2b,[\s\S]*?preview\)/);
});

test("14. WhatsApp cannot render without verified configuration", () => {
  const source = readFileSync(join(ROOT, "src/components/b2b/ManualContactActions.tsx"), "utf8");
  const contact = readFileSync(join(ROOT, "src/lib/public-contact.ts"), "utf8");
  assert.match(source, /whatsappUrl\(PUBLIC_CONTACT\.whatsapp, preview\)/);
  assert.match(source, /\{whatsAppHref \? \(/);
  assert.match(source, /<Button disabled/);
  assert.doesNotMatch(contact, /whatsapp:\s*["'`]/);
});

test("15. no literal email address exists in the CM-COM-1C surface", () => {
  assert.doesNotMatch(SURFACE_SOURCE, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
});

test("16. no halal, compliance, stock, or delivery claims are added", () => {
  assert.doesNotMatch(
    SURFACE_SOURCE,
    /\bhalal\b|\bcompliance\b|\bin[- ]?stock\b|\bout[- ]?of[- ]?stock\b|\bdelivery (?:time|date|window)\b/i,
  );
});

test("17. mobile safe-area and bottom clearance are present", () => {
  const bar = readFileSync(join(ROOT, "src/components/b2b/B2bQuoteBar.tsx"), "utf8");
  const catalog = readFileSync(join(ROOT, "src/routes/b2b_.catalog.tsx"), "utf8");
  assert.match(bar, /env\(safe-area-inset-bottom\)/);
  assert.match(catalog, /pb-48/);
  assert.match(SURFACE_SOURCE, /min-h-11/);
});

test("18. prerequisite CM-COM-1B, CM-CAT-1, and CM-GTM-1 gates remain wired", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  for (const script of ["test:cm-com-1b", "test:cm-cat-1", "test:cm-gtm-1"]) {
    assert.equal(typeof packageJson.scripts[script], "string");
  }
});

test("19. CI and merged-tree validation remain additive", () => {
  const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const mergedTree = readFileSync(join(ROOT, "scripts/ci/validate-merged-tree.sh"), "utf8");
  for (const command of [
    "npm run test:cm-com-1b",
    "npm run validate:cm-cat-1",
    "npm run test:cm-cat-1",
    "npm run validate:cm-gtm-1",
    "npm run test:cm-gtm-1",
    "npm run test:cm-com-1c",
    "npm run typecheck",
    "npm run build",
    "npm run build:railway",
  ]) {
    assert.match(`${workflow}\n${mergedTree}`, new RegExp(command.replaceAll(":", "\\:")));
  }
  assert.equal(
    relative(ROOT, join(ROOT, "tests/cm-com-1c/b2b-catalog-quote.test.mjs")),
    "tests/cm-com-1c/b2b-catalog-quote.test.mjs",
  );
});
