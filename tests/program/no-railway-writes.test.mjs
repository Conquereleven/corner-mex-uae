import test from "node:test";
import assert from "node:assert/strict";
import {
  scanSourceForForbiddenOperations,
  assertNoRailwayWrites,
} from "../../scripts/program/assert-no-railway-writes.mjs";

test("the real drift-guard files contain no forbidden Railway write operations", () => {
  const result = assertNoRailwayWrites();
  assert.equal(result.status, "no_railway_write_operations_found");
});

test("detects a shell write command embedded in source text", () => {
  const hits = scanSourceForForbiddenOperations("run: railway redeploy --service web");
  assert.ok(hits.includes("railway redeploy"));
});

test("detects a GraphQL mutation keyword", () => {
  const hits = scanSourceForForbiddenOperations("mutation DoThing { serviceInstanceRedeploy }");
  assert.ok(hits.includes("GraphQL mutation keyword"));
  assert.ok(hits.includes("serviceInstanceRedeploy mutation"));
});

test("clean read-only source produces no hits", () => {
  const hits = scanSourceForForbiddenOperations("query GetService { service(id: $id) { id } }");
  assert.deepEqual(hits, []);
});
