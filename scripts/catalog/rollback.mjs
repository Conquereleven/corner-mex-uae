import { VERSIONS, sha256 } from "./catalog-lib.mjs";

export const CANONICAL_PROJECT = "wlrfknmrhowldygmvtvn";

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
  await client.query("begin");
  try {
    const execution = await client.query(
      "select id from catalog_import_executions where id=$1 for update",
      [executionId],
    );
    const completed = await client.query(
      "select execution_id from rollback_history where execution_id=$1",
      [executionId],
    );
    if (execution.rowCount === 0) {
      await client.query("rollback");
      if (completed.rowCount === 1) return { status: "idempotent_noop", executionId };
      throw new Error("UNKNOWN_EXECUTION_ID");
    }

    const before = await client.query(
      "select (select count(*) from products where import_execution_id=$1) products,(select count(*) from media_objects where execution_id=$1) media,(select count(*) from catalog_import_reviews where execution_id=$1) reviews",
      [executionId],
    );
    const prior = before.rows[0];
    if (Number(prior.products) === 0 || Number(prior.media) === 0) {
      throw new Error("INCOMPLETE_ROLLBACK_MANIFEST");
    }

    await client.query("insert into rollback_history(execution_id) values($1)", [executionId]);
    await client.query("delete from media_objects where execution_id=$1", [executionId]);
    await client.query("delete from catalog_import_reviews where execution_id=$1", [executionId]);
    await client.query("delete from products where import_execution_id=$1", [executionId]);
    await client.query("delete from catalog_import_executions where id=$1", [executionId]);
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
