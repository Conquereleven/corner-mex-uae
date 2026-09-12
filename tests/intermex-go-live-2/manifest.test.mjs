import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("v2 migration manifest is exact, canonical and production gated", () => {
  const manifest = JSON.parse(readFileSync("docs/go-live/activation-manifest-v2.json", "utf8"));
  assert.equal(manifest.baselineMain, "d460fcee247382039700beac357d3454e32afc5b");
  assert.equal(manifest.productionMutationAuthorized, false);
  assert.equal(manifest.aggregateAuthorizationAllowed, false);
  assert.equal(manifest.migrations.length, 6);
  const registry = JSON.parse(
    readFileSync("contracts/canonical-active-migration-extensions-v1.json", "utf8"),
  );
  for (const row of manifest.migrations) {
    assert.equal(row.productionApplied, false);
    assert.equal(row.requiresFounderProductionGate, true);
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`supabase/migrations/${row.filename}`))
        .digest("hex"),
      row.sha256,
    );
    assert.ok(
      registry.migrations.some(
        (r) =>
          r.filename === row.filename && !r.productionApplied && r.requiresFounderProductionGate,
      ),
    );
  }
});
