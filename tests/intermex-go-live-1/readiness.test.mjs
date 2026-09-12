import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  evaluateOperationalEvidence,
  operationalEvidenceRequirements,
  goLiveReadiness,
  GO_LIVE_BASELINE,
} from "../../src/lib/go-live-readiness.ts";

test("missing, stale, wrong-project and incomplete evidence cannot satisfy the operational checklist", () => {
  const now = Date.parse("2026-09-12T00:00:00Z");
  assert.equal(evaluateOperationalEvidence(null, GO_LIVE_BASELINE, now).checklistComplete, false);
  const evidence = {
    projectRef: "wlrfknmrhowldygmvtvn",
    head: GO_LIVE_BASELINE,
    environment: "production",
    expiresAt: "2026-09-13T00:00:00Z",
    checks: Object.fromEntries(
      operationalEvidenceRequirements.map((k) => [k, { passed: true, artifact: `audit:${k}` }]),
    ),
  };
  assert.equal(
    evaluateOperationalEvidence(evidence, GO_LIVE_BASELINE, now).checklistComplete,
    true,
  );
  for (const key of operationalEvidenceRequirements) {
    const copy = structuredClone(evidence);
    delete copy.checks[key];
    assert.equal(
      evaluateOperationalEvidence(copy, GO_LIVE_BASELINE, now).checklistComplete,
      false,
      key,
    );
  }
  for (const patch of [
    { projectRef: "other" },
    { head: "a".repeat(40) },
    { environment: "test" },
    { expiresAt: "invalid" },
    { expiresAt: "2026-09-11" },
  ]) {
    assert.equal(
      evaluateOperationalEvidence({ ...evidence, ...patch }, GO_LIVE_BASELINE, now)
        .checklistComplete,
      false,
    );
  }
  assert.ok(goLiveReadiness.every((row) => row.status !== "ACTIVE"));
});

test("immutable migration identities and independent B2B gates remain intact", () => {
  const contract = JSON.parse(readFileSync("contracts/cm-b2b-ops-prod-readiness-1.json", "utf8"));
  assert.equal(contract.aggregateAuthorizationAllowed, false);
  assert.equal(contract.productionMutationAuthorized, false);
  assert.deepEqual(
    contract.gates.map((g) => g.id),
    ["A", "B", "C"],
  );
  for (const gate of contract.gates) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`supabase/migrations/${gate.artifact.filename}`))
        .digest("hex"),
      gate.artifact.sha256,
    );
    for (const file of [gate.preflightSql, gate.postflightSql])
      assert.ok(readFileSync(file, "utf8").length > 100);
  }
  const extensions = readFileSync(
    "contracts/canonical-active-migration-extensions-v1.json",
    "utf8",
  );
  const records = JSON.parse(extensions).migrations;
  // The repository validator verifies the full extension schema; assert gated rows here too.
  assert.match(extensions, /cm_pay_stripe_1/);
  assert.match(extensions, /requiresFounderProductionGate/);
  for (const row of records.filter((row) => /cm_pay_stripe_1|cm_int_zoho_1/.test(row.filename))) {
    assert.equal(row.productionApplied, false);
    assert.equal(row.requiresFounderProductionGate, true);
  }
});

test("webhook environment lookup is not shadowed and reconciliation selects payment method", () => {
  const route = readFileSync("src/routes/api/public/stripe-webhook.ts", "utf8");
  assert.doesNotMatch(route, /function process\s*\(/);
  assert.match(route, /process.env.STRIPE_WEBHOOK_SECRET/);
  const payments = readFileSync("src/lib/payments.functions.ts", "utf8");
  assert.match(
    payments,
    /select\("id, payment_status, payment_method, total_aed, payment_attention"\)/,
  );
});

test("activation manifest hashes and nonactivation flags match every source artifact", () => {
  const manifest = JSON.parse(readFileSync("docs/go-live/activation-manifest.json", "utf8"));
  assert.equal(manifest.productionMutationAuthorized, false);
  assert.equal(manifest.aggregateAuthorizationAllowed, false);
  assert.equal(manifest.migrations.length, 5);
  for (const migration of manifest.migrations) {
    assert.equal(migration.productionApplied, false);
    assert.equal(migration.requiresFounderProductionGate, true);
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`supabase/migrations/${migration.filename}`))
        .digest("hex"),
      migration.sha256,
    );
  }
});
