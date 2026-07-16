import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { verifyEphemeralRollback } from "../../scripts/catalog/rollback.mjs";

const databaseAvailable = Boolean(process.env.TEST_DATABASE_URL || process.env.PGHOST);

test(
  "ephemeral PostgreSQL rollback removes A only and is idempotent",
  { skip: !databaseAvailable },
  async () => {
    const client = new pg.Client(
      process.env.TEST_DATABASE_URL ? { connectionString: process.env.TEST_DATABASE_URL } : {},
    );
    await client.connect();
    try {
      await client.query(
        "drop schema public cascade; create schema public; create table catalog_import_executions(id text primary key); create table rollback_history(execution_id text primary key); create table products(id text primary key,import_execution_id text); create table media_objects(id text primary key,execution_id text); create table catalog_import_reviews(id text primary key,execution_id text); create table inventory(id text); create table orders(id text); create table payments(id text); create table product_reviews(id text)",
      );
      await client.query(
        "insert into catalog_import_executions values('A'),('B'); insert into products values('pA','A'),('pB','B'),('existing',null); insert into media_objects values('mA','A'),('mB','B'); insert into catalog_import_reviews values('rA','A'),('rB','B'); insert into inventory values('i'); insert into orders values('o'); insert into payments values('pay'); insert into product_reviews values('review')",
      );

      const first = await verifyEphemeralRollback(client, {
        executionId: "A",
        targetProject: "ephemeral-ci",
      });
      assert.equal(first.status, "verified_removed");
      const remaining = await client.query(
        "select (select count(*) from products where id in ('pB','existing')) products,(select count(*) from media_objects where execution_id='B') media,(select count(*) from inventory) inventory,(select count(*) from orders) orders,(select count(*) from payments) payments,(select count(*) from product_reviews) reviews",
      );
      assert.deepEqual(Object.values(remaining.rows[0]).map(Number), [2, 1, 1, 1, 1, 1]);

      const second = await verifyEphemeralRollback(client, {
        executionId: "A",
        targetProject: "ephemeral-ci",
      });
      assert.equal(second.status, "idempotent_noop");
      await assert.rejects(
        verifyEphemeralRollback(client, { executionId: "unknown", targetProject: "ephemeral-ci" }),
        /UNKNOWN_EXECUTION_ID/,
      );
    } finally {
      await client.end();
    }
  },
);
