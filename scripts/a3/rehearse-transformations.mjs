import { assert, deterministicUuid, readJson, sha256, stableStringify } from "./lib.mjs";

const PROHIBITED_DOMAINS = Object.freeze([
  { fields: ["customers", "profiles", "addresses"], code: "GREENFIELD_CUSTOMERS_MUST_BE_EMPTY" },
  { fields: ["orders", "orderItems"], code: "GREENFIELD_ORDERS_MUST_BE_EMPTY" },
  { fields: ["payments", "refunds"], code: "GREENFIELD_PAYMENTS_MUST_BE_EMPTY" },
  { fields: ["reviews"], code: "GREENFIELD_REVIEWS_MUST_BE_EMPTY" },
  {
    fields: ["carts", "cartItems", "inventoryMovements", "couponRedemptions", "catalogEvents"],
    code: "GREENFIELD_RUNTIME_ACTIVITY_MUST_BE_EMPTY",
  },
]);

export function compareCodePoints(left, right) {
  const leftCodePoints = Array.from(String(left), (value) => value.codePointAt(0));
  const rightCodePoints = Array.from(String(right), (value) => value.codePointAt(0));
  const length = Math.min(leftCodePoints.length, rightCodePoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftCodePoints[index] !== rightCodePoints[index]) {
      return leftCodePoints[index] - rightCodePoints[index];
    }
  }
  return leftCodePoints.length - rightCodePoints.length;
}

function sorted(rows, key) {
  return [...rows].sort((left, right) => compareCodePoints(key(left), key(right)));
}

export function validateGreenfieldFixture(fixture) {
  assert(fixture.synthetic === true, "ONLY_EXPLICITLY_SYNTHETIC_FIXTURES_ARE_ALLOWED");
  for (const { fields, code } of PROHIBITED_DOMAINS) {
    for (const field of fields) {
      assert(Array.isArray(fixture[field] ?? []), `${field.toUpperCase()}_MUST_BE_AN_ARRAY`);
      assert((fixture[field] ?? []).length === 0, code);
    }
  }
  assert((fixture.stock50 ?? []).length === 0, "GREENFIELD_STOCK_50_MUST_BE_EMPTY");
  assert((fixture.planningStock100 ?? []).length === 0, "GREENFIELD_PLANNING_STOCK_MUST_BE_EMPTY");

  const sourceIds = [...fixture.categories, ...fixture.products, ...fixture.variants].map(
    ({ sourceId }) => sourceId,
  );
  assert(new Set(sourceIds).size === sourceIds.length, "DUPLICATE_CANONICAL_SOURCE_ID");
  const skus = fixture.variants.map(({ sku }) => sku.trim());
  assert(new Set(skus).size === skus.length, "DUPLICATE_SKU");

  for (const variant of fixture.variants) {
    assert(Number.isInteger(variant.priceMinor), "INVALID_PRICE_MINOR_INTEGER");
    assert(Number.isSafeInteger(variant.priceMinor), "INVALID_PRICE_MINOR_SAFE_INTEGER");
    assert(variant.priceMinor > 0, "INVALID_PRICE_MINOR_POSITIVE");
    assert(variant.currency === "AED", "INVALID_PRICE_CURRENCY");
  }
  for (const row of fixture.inventory) {
    assert(row.available === 0 && row.reserved === 0, "SYNTHETIC_INVENTORY_MUST_BE_ZERO");
  }
}

export async function buildRehearsal(fixture) {
  fixture ??= await readJson("tests/fixtures/a3/greenfield-commerce.synthetic.json");
  validateGreenfieldFixture(fixture);

  const categories = sorted(fixture.categories, (row) => row.sourceId);
  const products = sorted(fixture.products, (row) => row.sourceId);
  const variants = sorted(fixture.variants, (row) => `${row.sku.trim()}\u0000${row.sourceId}`);
  const inventory = sorted(fixture.inventory, (row) => row.variantSourceId);
  const categoryIds = new Map(
    categories.map((row) => [row.sourceId, deterministicUuid("category", row.sourceId)]),
  );
  const productIds = new Map(
    products.map((row) => [row.sourceId, deterministicUuid("product", row.sourceId)]),
  );
  const variantIds = new Map(
    variants.map((row) => [row.sourceId, deterministicUuid("variant", row.sourceId)]),
  );

  const output = {
    fixtureVersion: fixture.fixtureVersion,
    synthetic: true,
    targetProjectRef: "wlrfknmrhowldygmvtvn",
    categories: categories.map((row) => ({
      id: categoryIds.get(row.sourceId),
      slug: row.slug.trim(),
      name: row.name.trim(),
      active: false,
    })),
    products: products.map((row) => ({
      id: productIds.get(row.sourceId),
      categoryId: categoryIds.get(row.categorySourceId),
      slug: row.slug.trim(),
      name: row.name.trim(),
      description: row.description?.trim() || null,
      active: false,
    })),
    productVariants: variants.map((row) => ({
      id: variantIds.get(row.sourceId),
      productId: productIds.get(row.productSourceId),
      sku: row.sku.trim(),
      priceMinor: row.priceMinor,
      currency: row.currency,
      active: false,
    })),
    inventory: inventory.map((row) => ({
      variantId: variantIds.get(row.variantSourceId),
      available: row.available,
      reserved: row.reserved,
    })),
    orders: [],
    payments: [],
    customers: [],
    reviews: [],
  };

  return { output, checksum: sha256(stableStringify(output)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildRehearsal();
  console.log(
    JSON.stringify({
      status: "a3_rehearsal_valid",
      checksum: result.checksum,
      counts: Object.fromEntries(
        Object.entries(result.output)
          .filter(([, value]) => Array.isArray(value))
          .map(([key, value]) => [key, value.length]),
      ),
    }),
  );
}
