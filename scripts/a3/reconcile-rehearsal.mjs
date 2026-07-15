import { assert } from "./lib.mjs";
import { buildRehearsal } from "./rehearse-transformations.mjs";

export async function reconcileRehearsal(fixture) {
  const first = await buildRehearsal(fixture);
  const second = await buildRehearsal(fixture);
  assert(first.checksum === second.checksum, "REHEARSAL_NOT_DETERMINISTIC");

  const { output } = first;
  const categoryIds = new Set(output.categories.map(({ id }) => id));
  const productIds = new Set(output.products.map(({ id }) => id));
  const variantIds = new Set(output.productVariants.map(({ id }) => id));
  assert(
    output.products.every(({ categoryId }) => categoryIds.has(categoryId)),
    "ORPHAN_PRODUCT_CATEGORY",
  );
  assert(
    output.productVariants.every(({ productId }) => productIds.has(productId)),
    "ORPHAN_VARIANT_PRODUCT",
  );
  assert(
    output.inventory.every(({ variantId }) => variantIds.has(variantId)),
    "ORPHAN_INVENTORY_VARIANT",
  );
  assert(
    new Set(output.productVariants.map(({ sku }) => sku)).size === output.productVariants.length,
    "DUPLICATE_SKU",
  );
  assert(
    output.inventory.every(({ available, reserved }) => available === 0 && reserved === 0),
    "SYNTHETIC_INVENTORY_MUST_BE_ZERO",
  );
  assert(
    [output.orders, output.payments, output.customers, output.reviews].every(
      (rows) => rows.length === 0,
    ),
    "GREENFIELD_COMMERCE_OUTPUT_MUST_BE_EMPTY",
  );
  for (const variant of output.productVariants) {
    assert(Number.isInteger(variant.priceMinor), "INVALID_PRICE_MINOR_INTEGER");
    assert(Number.isSafeInteger(variant.priceMinor), "INVALID_PRICE_MINOR_SAFE_INTEGER");
    assert(variant.priceMinor > 0, "INVALID_PRICE_MINOR_POSITIVE");
    assert(variant.currency === "AED", "INVALID_PRICE_CURRENCY");
  }
  const monetaryTotalMinor = output.productVariants.reduce(
    (sum, { priceMinor }) => sum + priceMinor,
    0,
  );
  assert(Number.isSafeInteger(monetaryTotalMinor), "INVALID_MONETARY_TOTAL");
  return {
    status: "a3_reconciliation_valid",
    checksum: first.checksum,
    deterministic: true,
    idempotent: true,
    orphanCount: 0,
    duplicateCount: 0,
    monetaryTotalMinor,
    inventoryTotal: 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await reconcileRehearsal()));
}
