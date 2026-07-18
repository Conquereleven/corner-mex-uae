import { VERSIONS, sha256 } from "./catalog-lib.mjs";

export const CANONICAL_PROJECT = "wlrfknmrhowldygmvtvn";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertNonCanonical(target) {
  if (!target || target === CANONICAL_PROJECT) {
    throw new Error("CANONICAL_PROJECT_ROLLBACK_DENIED");
  }
}

export function buildRollbackPreview({
  executionId,
  targetProject,
  executions,
  ownership,
  media,
  reviews,
}) {
  assertNonCanonical(targetProject);
  const matches = executions.filter((item) => item.id === executionId);
  if (matches.length !== 1) {
    throw new Error(matches.length ? "DUPLICATE_EXECUTION_ID" : "UNKNOWN_EXECUTION_ID");
  }

  const products = ownership.filter((item) => item.execution_id === executionId);
  const objects = media.filter((item) => item.execution_id === executionId);
  const reviewRows = reviews.filter((item) => item.execution_id === executionId);
  if (objects.some((item) => !item.object_path) || products.some((item) => !item.product_id)) {
    throw new Error("INCOMPLETE_ROLLBACK_MANIFEST");
  }

  const productIds = new Set(products.map((item) => item.product_id));
  if (productIds.size !== products.length) throw new Error("OVERLAPPING_PRODUCT_OWNERSHIP");

  const sortedProducts = [...productIds].sort();
  const objectPaths = objects.map((item) => item.object_path).sort();
  const reviewIds = reviewRows.map((item) => item.id).sort();
  return {
    contractVersion: VERSIONS.rollback,
    mode: "synthetic_fixture_preview",
    evidenceClass: "NON_PRODUCTION_SYNTHETIC",
    realDatabaseQueried: false,
    eligibleAsExecutionEvidence: false,
    executionId,
    targetProject,
    productIds: sortedProducts,
    objectPaths,
    reviewIds,
    untouched: { inventory: true, orders: true, payments: true, productReviews: true },
    fingerprint: sha256(
      JSON.stringify({
        executionId,
        products: sortedProducts,
        objects: objectPaths,
        reviews: reviewIds,
      }),
    ),
    writes: false,
  };
}

export async function verifyEphemeralRollback(client, { executionId, targetProject }) {
  assertNonCanonical(targetProject);
  if (!UUID_PATTERN.test(executionId || "")) throw new Error("INVALID_EXECUTION_ID");
  await client.query("begin");
  try {
    const execution = await client.query(
      "select id,status from catalog_import_executions where id=$1 for update",
      [executionId],
    );
    if (execution.rowCount === 0) {
      throw new Error("UNKNOWN_EXECUTION_ID");
    }
    if (execution.rows[0].status === "rolled_back") {
      const residual = await client.query(
        `select
          (select count(*) from catalog_import_product_ownership where execution_id=$1) ownership,
          (select count(*) from catalog_import_media_objects where execution_id=$1) media,
          (select count(*) from catalog_import_reviews where execution_id=$1) reviews`,
        [executionId],
      );
      if (Object.values(residual.rows[0]).some((count) => Number(count) !== 0))
        throw new Error("ROLLED_BACK_EXECUTION_HAS_RESIDUAL_ROWS");
      await client.query("commit");
      return {
        status: "idempotent_noop",
        executionId,
        removed: { products: 0, ownership: 0, media: 0, reviews: 0 },
      };
    }

    const owned = await client.query(
      `select ownership.product_id
         from catalog_import_product_ownership ownership
         join products on products.id=ownership.product_id
        where ownership.execution_id=$1
        order by ownership.product_id
        for update of ownership,products`,
      [executionId],
    );
    const before = await client.query(
      `select
        (select count(*) from catalog_import_product_ownership where execution_id=$1) ownership,
        (select count(*) from catalog_import_media_objects where execution_id=$1) media,
        (select count(*) from catalog_import_reviews where execution_id=$1) reviews`,
      [executionId],
    );
    const prior = {
      products: owned.rowCount,
      ownership: Number(before.rows[0].ownership),
      media: Number(before.rows[0].media),
      reviews: Number(before.rows[0].reviews),
    };
    if (prior.products === 0 || prior.ownership !== prior.products || prior.media === 0) {
      throw new Error("INCOMPLETE_ROLLBACK_MANIFEST");
    }

    const media = await client.query(
      "delete from catalog_import_media_objects where execution_id=$1",
      [executionId],
    );
    const reviews = await client.query("delete from catalog_import_reviews where execution_id=$1", [
      executionId,
    ]);
    const ownership = await client.query(
      "delete from catalog_import_product_ownership where execution_id=$1",
      [executionId],
    );
    if (
      media.rowCount !== prior.media ||
      reviews.rowCount !== prior.reviews ||
      ownership.rowCount !== prior.ownership
    )
      throw new Error("ROLLBACK_DELETE_COUNT_MISMATCH");

    const productIds = owned.rows.map(({ product_id: productId }) => productId);
    const products = await client.query("delete from products where id=any($1::uuid[])", [
      productIds,
    ]);
    if (products.rowCount !== prior.products) throw new Error("ROLLBACK_PRODUCT_COUNT_MISMATCH");
    const updated = await client.query(
      "update catalog_import_executions set status='rolled_back' where id=$1 and status<>'rolled_back'",
      [executionId],
    );
    if (updated.rowCount !== 1) throw new Error("ROLLBACK_EXECUTION_STATE_MISMATCH");

    const after = await client.query(
      `select
        (select count(*) from products where id=any($2::uuid[])) products,
        (select count(*) from catalog_import_product_ownership where execution_id=$1) ownership,
        (select count(*) from catalog_import_media_objects where execution_id=$1) media,
        (select count(*) from catalog_import_reviews where execution_id=$1) reviews`,
      [executionId, productIds],
    );
    if (Object.values(after.rows[0]).some((count) => Number(count) !== 0))
      throw new Error("ROLLBACK_POSTCONDITION_FAILED");
    const protectedCounts = await client.query(
      "select (select count(*) from inventory) inventory,(select count(*) from orders) orders,(select count(*) from payments) payments,(select count(*) from product_reviews) reviews",
    );
    await client.query("commit");
    return {
      status: "verified_removed",
      executionId,
      removed: prior,
      protectedCounts: protectedCounts.rows[0],
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
