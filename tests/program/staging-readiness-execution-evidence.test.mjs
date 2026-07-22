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
  evidence.readinessAfter = { statusCode: 503, status: "degraded", target: "unavailable" };
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

test("rejects a verifiedAt timestamp set in the future, rather than treating it as fresh", () => {
  const evidence = baseEvidence();
  evidence.verifiedAt = "2099-01-01T00:00:00Z";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_VERIFIED_TIMESTAMP_IN_FUTURE/,
  );
});

test("rejects a changeAppliedAt timestamp set in the future", () => {
  const evidence = baseEvidence();
  evidence.changeAppliedAt = "2099-01-01T00:00:00Z";
  evidence.verifiedAt = "2099-01-01T00:05:00Z";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_CHANGE_TIMESTAMP_IN_FUTURE/,
  );
});

test("accepts a verifiedAt within the explicit clock-skew allowance", () => {
  const evidence = baseEvidence();
  const skewedNow = new Date(Date.parse(evidence.verifiedAt) - 60_000);
  assert.equal(
    validateStagingReadinessExecutionEvidence(evidence, { now: () => skewedNow }).result,
    "executed_verified",
  );
});

test("rejects executed_degraded claiming the Supabase probe never executed", () => {
  const evidence = baseEvidence();
  evidence.result = "executed_degraded";
  evidence.readinessAfter = { statusCode: 503, status: "degraded", target: "unavailable" };
  evidence.supabaseReadiness = { executed: false, result: "not_executed" };
  evidence.remainingBlocker = "Supabase is unreachable";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_DEGRADED_SUPABASE_STATE_CONTRADICTORY/,
  );
});

test("rejects executed_degraded claiming Supabase was reachable", () => {
  const evidence = baseEvidence();
  evidence.result = "executed_degraded";
  evidence.readinessAfter = { statusCode: 503, status: "degraded", target: "unavailable" };
  evidence.supabaseReadiness = { executed: true, result: "reachable" };
  evidence.remainingBlocker = "Supabase is unreachable";
  assert.throws(
    () => validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }),
    /SRE_DEGRADED_SUPABASE_STATE_CONTRADICTORY/,
  );
});

test("accepts executed_verified readinessAfter without missing/errors keys, matching the real API shape", () => {
  const evidence = baseEvidence();
  assert.deepEqual(Object.keys(evidence.readinessAfter).sort(), ["status", "statusCode", "target"]);
  assert.equal(
    validateStagingReadinessExecutionEvidence(evidence, { now: FROZEN_NOW }).result,
    "executed_verified",
  );
});
