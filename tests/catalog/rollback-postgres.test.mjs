import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import { verifyEphemeralRollback } from "../../scripts/catalog/rollback.mjs";

const databaseAvailable = Boolean(process.env.TEST_DATABASE_URL || process.env.PGHOST);
const executionA = "00000000-0000-4000-8000-00000000000a";
const executionB = "00000000-0000-4000-8000-00000000000b";
const productA = "10000000-0000-4000-8000-00000000000a";
const productB = "10000000-0000-4000-8000-00000000000b";
const outsider = "10000000-0000-4000-8000-00000000000c";

const applyCanonicalSchema = async (client) => {
  await client.query("drop event trigger if exists ensure_rls");
  await client.query("drop schema if exists public cascade; create schema public");
  await client.query(
    "drop schema if exists auth cascade; drop schema if exists extensions cascade; drop schema if exists commerce_private cascade",
  );
  await client.query(
    "drop role if exists anon; drop role if exists authenticated; drop role if exists service_role",
  );
  await client.query(
    fs.readFileSync("tests/fixtures/supabase-canonical-platform-prelude.sql", "utf8"),
  );
  for (const migration of [
    "supabase/migrations/20260713222315_revoke_public_rls_auto_enable_execution.sql",
    "supabase/migrations/20260714010000_commerce_foundation_a2.sql",
    "supabase/migrations/20260714011000_private_admin_boundary_a2.sql",
    "supabase/migrations/20260714012000_public_read_policy_boundary_a2.sql",
    "supabase/pending-canonical/20260716010000_catalog_import_foundation_a3_2b.sql",
  ]) {
    await client.query(fs.readFileSync(migration, "utf8"));
  }
};

test(
  "canonical PostgreSQL rollback is isolated, FK-safe, and idempotent",
  { skip: !databaseAvailable },
  async () => {
    const client = new pg.Client(
      process.env.TEST_DATABASE_URL ? { connectionString: process.env.TEST_DATABASE_URL } : {},
    );
    await client.connect();
    try {
      await applyCanonicalSchema(client);
      await client.query(
        `insert into catalog_import_executions
          (id,contract_version,source_repo_sha,source_fingerprint,idempotency_key,status,source_count,imported_count)
         values
          ($1,'cornermex-catalog-import-execution-v1',$3,$4,'execution-a','verified',1,1),
          ($2,'cornermex-catalog-import-execution-v1',$3,$5,'execution-b','verified',1,1)`,
        [executionA, executionB, "a".repeat(40), "b".repeat(64), "c".repeat(64)],
      );
      await client.query(
        `insert into products(id,slug,status) values
          ($1,'owned-by-a','draft'),($2,'owned-by-b','draft'),($3,'unrelated-product','draft')`,
        [productA, productB, outsider],
      );
      await client.query(
        "insert into catalog_import_product_ownership(execution_id,product_id) values($1,$2),($3,$4)",
        [executionA, productA, executionB, productB],
      );
      await client.query(
        `insert into catalog_import_media_objects(execution_id,object_path,content_sha256,content_mime,content_bytes)
           values($1,'catalog/a/image.jpg',$3,'image/jpeg',100),($2,'catalog/b/image.jpg',$4,'image/jpeg',100)`,
        [executionA, executionB, "d".repeat(64), "e".repeat(64)],
      );
      await client.query(
        `insert into catalog_import_reviews(execution_id,stable_product_identity,source_row,classification,source_fingerprint)
           values($1,'stable-a',2,'ready_to_import',$3),($2,'stable-b',2,'ready_to_import',$4)`,
        [executionA, executionB, "d".repeat(64), "e".repeat(64)],
      );

      const first = await verifyEphemeralRollback(client, {
        executionId: executionA,
        targetProject: "ephemeral-ci",
      });
      assert.equal(first.status, "verified_removed");
      assert.deepEqual(first.removed, { products: 1, ownership: 1, media: 1, reviews: 1 });

      const state = await client.query(
        `select
          (select status from catalog_import_executions where id=$1) execution_status,
          (select count(*) from catalog_import_product_ownership where execution_id=$1) ownership_a,
          (select count(*) from catalog_import_media_objects where execution_id=$1) media_a,
          (select count(*) from catalog_import_reviews where execution_id=$1) reviews_a,
          (select count(*) from products where id=$2) product_a,
          (select count(*) from products where id in ($3,$4)) preserved_products,
          (select count(*) from catalog_import_product_ownership where execution_id=$5) ownership_b,
          (select count(*) from catalog_import_media_objects where execution_id=$5) media_b`,
        [executionA, productA, productB, outsider, executionB],
      );
      assert.deepEqual(state.rows[0], {
        execution_status: "rolled_back",
        ownership_a: "0",
        media_a: "0",
        reviews_a: "0",
        product_a: "0",
        preserved_products: "2",
        ownership_b: "1",
        media_b: "1",
      });

      const second = await verifyEphemeralRollback(client, {
        executionId: executionA,
        targetProject: "ephemeral-ci",
      });
      assert.equal(second.status, "idempotent_noop");
      await assert.rejects(
        verifyEphemeralRollback(client, {
          executionId: "00000000-0000-4000-8000-000000000099",
          targetProject: "ephemeral-ci",
        }),
        /UNKNOWN_EXECUTION_ID/,
      );
      await assert.rejects(
        verifyEphemeralRollback(client, {
          executionId: "not-a-uuid",
          targetProject: "ephemeral-ci",
        }),
        /INVALID_EXECUTION_ID/,
      );
    } finally {
      await client.end();
    }
  },
);

test("rollback implementation cannot regress to the rejected synthetic schema", () => {
  const source = fs.readFileSync("scripts/catalog/rollback.mjs", "utf8");
  assert.equal(source.includes("products where import_execution_id"), false);
  assert.equal(source.includes("delete from media_objects"), false);
  assert.match(source, /catalog_import_product_ownership/);
  assert.match(source, /catalog_import_media_objects/);
});
