import { deterministicUuid, readJson, sha256, stableStringify } from "./lib.mjs";

export async function buildRehearsal() {
  const fixture = await readJson("tests/fixtures/a3/greenfield-commerce.synthetic.json");
  if (fixture.synthetic !== true) throw new Error("only explicitly synthetic fixtures are allowed");

  const categoryIds = new Map(
    fixture.categories.map((row) => [row.sourceId, deterministicUuid("category", row.sourceId)]),
  );
  const productIds = new Map(
    fixture.products.map((row) => [row.sourceId, deterministicUuid("product", row.sourceId)]),
  );
  const variantIds = new Map(
    fixture.variants.map((row) => [row.sourceId, deterministicUuid("variant", row.sourceId)]),
  );

  const output = {
    fixtureVersion: fixture.fixtureVersion,
    synthetic: true,
    targetProjectRef: "wlrfknmrhowldygmvtvn",
    categories: fixture.categories.map((row) => ({
      id: categoryIds.get(row.sourceId),
      slug: row.slug,
      name: row.name,
      active: false,
    })),
    products: fixture.products.map((row) => ({
      id: productIds.get(row.sourceId),
      category_id: categoryIds.get(row.categorySourceId),
      slug: row.slug,
      name: row.name,
      active: false,
    })),
    product_variants: fixture.variants.map((row) => ({
      id: variantIds.get(row.sourceId),
      product_id: productIds.get(row.productSourceId),
      sku: row.sku,
      price_minor: row.priceMinor,
      currency: row.currency,
      active: false,
    })),
    inventory: fixture.inventory.map((row) => ({
      variant_id: variantIds.get(row.variantSourceId),
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
