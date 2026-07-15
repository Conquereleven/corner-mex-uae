import { assert } from "./lib.mjs";
import { buildRehearsal } from "./rehearse-transformations.mjs";

export async function reconcileRehearsal() {
  const first = await buildRehearsal();
  const second = await buildRehearsal();
  assert(first.checksum === second.checksum, "rehearsal is not deterministic");

  const { output } = first;
  const categoryIds = new Set(output.categories.map(({ id }) => id));
  const productIds = new Set(output.products.map(({ id }) => id));
  const variantIds = new Set(output.product_variants.map(({ id }) => id));
  assert(
    output.products.every(({ category_id }) => categoryIds.has(category_id)),
    "orphan product category",
  );
  assert(
    output.product_variants.every(({ product_id }) => productIds.has(product_id)),
    "orphan variant product",
  );
  assert(
    output.inventory.every(({ variant_id }) => variantIds.has(variant_id)),
    "orphan inventory variant",
  );
  assert(
    new Set(output.product_variants.map(({ sku }) => sku)).size === output.product_variants.length,
    "duplicate sku",
  );
  assert(
    output.inventory.every(({ available, reserved }) => available === 0 && reserved === 0),
    "synthetic stock must remain zero",
  );
  assert(
    output.orders.length === 0 && output.payments.length === 0,
    "commerce transactions must remain empty",
  );
  const monetaryTotal = output.product_variants.reduce((sum, row) => sum + row.price_minor, 0);
  assert(
    Number.isSafeInteger(monetaryTotal) && monetaryTotal === 1250,
    "minor-unit money reconciliation failed",
  );
  return {
    status: "a3_reconciliation_valid",
    checksum: first.checksum,
    deterministic: true,
    idempotent: true,
    orphanCount: 0,
    duplicateCount: 0,
    monetaryTotalMinor: monetaryTotal,
    inventoryTotal: 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await reconcileRehearsal()));
}
