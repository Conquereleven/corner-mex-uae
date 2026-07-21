import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateStagingReadinessExecutionEvidence,
  validateStagingReadinessExecutionEvidenceFile,
} from "../../scripts/program/validate-staging-readiness-execution-evidence.mjs";

const FROZEN_NOW = () => new Date("2026-07-21T23:06:00Z");
const baseEvidence = () =>
  JSON.parse(fs.readFileSync("docs/program/STAGING_READINESS_EXECUTION_EVIDENCE.json", "utf8"));

test("accepts the committed executed_verified evidence", () => {
  const result = validateStagingReadinessExecutionEvidenceFile(
    "docs/program/STAGING_READINESS_EXECUTION_EVIDENCE.json",
  );
  assert.equal(result.result, "executed_verified");
});

test("accepts executed_degraded with an exact remaining blocker", () => {
  const evidence = baseEvidence();
  evidence.result = "executed_degraded";
  evidence.readinessAfter = {
    statusCode: 503,
    status: "degraded",
    target: "unavailable",
    missing: [],
    errors: ["SUPABASE_REACHABILITY"],
  };
  evidence.supabaseReadiness = { executed: true, result: "unreachable" };
  evidence.remainingBlocker = "SUPABASE_REACHABILITY";
  assert.equal(
    validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }).result,
    "executed_degraded",
  );
});

test("accepts rolled_back only when rollback was performed", () => {
  const evidence = baseEvidence();
  evidence.result = "rolled_back";
  evidence.rollback.performed = true;
  evidence.actionsNotExecuted = evidence.actionsNotExecuted.filter(
    (item) => item !== "no_rollback",
  );
  evidence.actionsNotExecuted.push("no_second_attempt");
  assert.equal(
    validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }).result,
    "rolled_back",
  );
});

test("rejects production targeting", () => {
  const evidence = baseEvidence();
  evidence.targetEnvironment = "production";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_PRODUCTION_TARGET_FORBIDDEN/,
  );
});

test("rejects source SHA drift", () => {
  const evidence = baseEvidence();
  evidence.sourceSha = "f".repeat(40);
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_SOURCE_SHA_INVALID/,
  );
});

test("rejects a missing deployment transition", () => {
  const evidence = baseEvidence();
  evidence.postChangeDeploymentId = evidence.preChangeDeploymentId;
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_DEPLOYMENT_TRANSITION_INVALID/,
  );
});

test("rejects stale evidence", () => {
  const evidence = baseEvidence();
  assert.throws(
    () =>
      validateStagingReadinessExecutionEvidence(evidence, {
        now: () => new Date("2026-08-01T00:00:00Z"),
      }),
    /SRE_EVIDENCE_STALE/,
  );
});

test("rejects unknown fields", () => {
  const evidence = { ...baseEvidence(), surprise: true };
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_UNKNOWN_FIELD:surprise/,
  );
});

test("requires prior-value redaction", () => {
  const evidence = baseEvidence();
  evidence.priorValue = "not-redacted";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_REDACTION_REQUIRED/,
  );
});

test("requires a verified rollback mechanism", () => {
  const evidence = baseEvidence();
  evidence.rollback.availabilityVerified = false;
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_ROLLBACK_MECHANISM_INVALID/,
  );
});
