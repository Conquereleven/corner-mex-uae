import fs from "node:fs";
import path from "node:path";

const SHA = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SOURCE_SHA = "73790cb3724fc1f19bedd157fc237f07a46e4314";
const PRODUCTION_DEPLOYMENT = "bac2a5b3-0b8a-4243-8046-531113a4ca18";
const PRODUCTION_SOURCE = "d470b7b57f6d625a7d60337ad16a59080c1bb37d";
const REQUIRED_UNEXECUTED_ACTIONS = new Set([
  "no_production_change",
  "no_manual_restart",
  "no_manual_redeploy",
  "no_rollback",
  "no_supabase_write",
  "no_migration",
  "no_commercial_activation",
  "no_external_communication",
]);
const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "requestId",
  "founderDecisionId",
  "result",
  "targetEnvironment",
  "targetService",
  "variableName",
  "appliedContractValue",
  "priorValue",
  "valuesRedacted",
  "preChangeDeploymentId",
  "postChangeDeploymentId",
  "sourceSha",
  "healthBefore",
  "healthAfter",
  "readinessBefore",
  "readinessAfter",
  "supabaseReadiness",
  "rollback",
  "productionBefore",
  "productionAfter",
  "changeAppliedAt",
  "verifiedAt",
  "maximumEvidenceAgeSeconds",
  "remainingBlocker",
  "actionsNotExecuted",
]);
const PROBE_KEYS = new Set(["statusCode", "status", "observedCommit"]);
const READINESS_KEYS = new Set(["statusCode", "status", "target", "missing", "errors"]);
const SUPABASE_KEYS = new Set(["executed", "result"]);
const ROLLBACK_KEYS = new Set([
  "mechanism",
  "targetDeploymentId",
  "availabilityVerified",
  "performed",
]);
const PRODUCTION_KEYS = new Set([
  "deploymentId",
  "sourceSha",
  "deploymentCreated",
  "restartPerformed",
  "rollbackPerformed",
  "variableModified",
]);

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const assertOnlyKeys = (value, allowed, code) => {
  assert(value && typeof value === "object" && !Array.isArray(value), code);
  for (const key of Object.keys(value)) assert(allowed.has(key), `${code}:${key}`);
};
const parseTimestamp = (value, code) => {
  assert(TIMESTAMP.test(value || ""), code);
  const parsed = Date.parse(value);
  assert(
    Number.isFinite(parsed) && new Date(parsed).toISOString().replace(".000Z", "Z") === value,
    code,
  );
  return parsed;
};
const validateProduction = (value) => {
  assertOnlyKeys(value, PRODUCTION_KEYS, "SRE_PRODUCTION_UNKNOWN_FIELD");
  assert(value.deploymentId === PRODUCTION_DEPLOYMENT, "SRE_PRODUCTION_DEPLOYMENT_DRIFT");
  assert(value.sourceSha === PRODUCTION_SOURCE, "SRE_PRODUCTION_SOURCE_DRIFT");
  assert(
    value.deploymentCreated === false &&
      value.restartPerformed === false &&
      value.rollbackPerformed === false &&
      value.variableModified === false,
    "SRE_PRODUCTION_MUTATION_FORBIDDEN",
  );
};

export function validateStagingReadinessExecutionEvidence(
  evidence,
  { now = () => new Date() } = {},
) {
  assertOnlyKeys(evidence, ALLOWED_KEYS, "SRE_UNKNOWN_FIELD");
  assert(
    evidence.schemaVersion === "cornermex-staging-readiness-execution-evidence-v1",
    "SRE_SCHEMA_VERSION_INVALID",
  );
  assert(
    /^SRC-\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+$/.test(evidence.requestId || ""),
    "SRE_REQUEST_ID_INVALID",
  );
  assert(
    evidence.founderDecisionId === "FD-CM-STAGING-READINESS-001",
    "SRE_DECISION_SCOPE_INVALID",
  );
  assert(
    ["executed_verified", "executed_degraded", "rolled_back"].includes(evidence.result),
    "SRE_RESULT_INVALID",
  );
  assert(evidence.targetEnvironment === "staging", "SRE_PRODUCTION_TARGET_FORBIDDEN");
  assert(evidence.targetService === "cornermex-web", "SRE_SERVICE_INVALID");
  assert(evidence.variableName === "CORNERMEX_COMMERCE_MODEL", "SRE_VARIABLE_INVALID");
  assert(
    evidence.appliedContractValue === "single_merchant_with_internal_supplier_network",
    "SRE_CONTRACT_VALUE_INVALID",
  );
  assert(
    evidence.priorValue === "[REDACTED]" && evidence.valuesRedacted === true,
    "SRE_REDACTION_REQUIRED",
  );
  assert(
    UUID.test(evidence.preChangeDeploymentId || "") &&
      UUID.test(evidence.postChangeDeploymentId || ""),
    "SRE_DEPLOYMENT_ID_INVALID",
  );
  assert(
    evidence.preChangeDeploymentId !== evidence.postChangeDeploymentId,
    "SRE_DEPLOYMENT_TRANSITION_INVALID",
  );
  assert(
    SHA.test(evidence.sourceSha || "") && evidence.sourceSha === SOURCE_SHA,
    "SRE_SOURCE_SHA_INVALID",
  );

  assertOnlyKeys(evidence.healthBefore, PROBE_KEYS, "SRE_HEALTH_BEFORE_UNKNOWN_FIELD");
  assertOnlyKeys(evidence.healthAfter, PROBE_KEYS, "SRE_HEALTH_AFTER_UNKNOWN_FIELD");
  assert(
    evidence.healthBefore.statusCode === 200 && evidence.healthBefore.status === "ok",
    "SRE_HEALTH_BEFORE_INVALID",
  );
  assert(
    evidence.healthAfter.statusCode === 200 && evidence.healthAfter.status === "ok",
    "SRE_HEALTH_AFTER_INVALID",
  );
  assert(
    evidence.healthBefore.observedCommit === SOURCE_SHA.slice(0, 12) &&
      evidence.healthAfter.observedCommit === SOURCE_SHA.slice(0, 12),
    "SRE_HEALTH_COMMIT_DRIFT",
  );

  assertOnlyKeys(evidence.readinessBefore, READINESS_KEYS, "SRE_READINESS_BEFORE_UNKNOWN_FIELD");
  assertOnlyKeys(evidence.readinessAfter, READINESS_KEYS, "SRE_READINESS_AFTER_UNKNOWN_FIELD");
  assert(
    evidence.readinessBefore.statusCode === 503 &&
      evidence.readinessBefore.status === "degraded" &&
      evidence.readinessBefore.errors.includes("CORNERMEX_COMMERCE_MODEL"),
    "SRE_READINESS_BEFORE_INVALID",
  );
  assert(
    !evidence.readinessAfter.errors.includes("CORNERMEX_COMMERCE_MODEL"),
    "SRE_COMMERCE_MODEL_NOT_CORRECTED",
  );

  assertOnlyKeys(evidence.supabaseReadiness, SUPABASE_KEYS, "SRE_SUPABASE_UNKNOWN_FIELD");
  assertOnlyKeys(evidence.rollback, ROLLBACK_KEYS, "SRE_ROLLBACK_UNKNOWN_FIELD");
  assert(
    evidence.rollback.mechanism === "railway_deployment_rollback_restores_custom_variables" &&
      evidence.rollback.targetDeploymentId === evidence.preChangeDeploymentId &&
      evidence.rollback.availabilityVerified === true,
    "SRE_ROLLBACK_MECHANISM_INVALID",
  );
  validateProduction(evidence.productionBefore);
  validateProduction(evidence.productionAfter);

  const appliedAt = parseTimestamp(evidence.changeAppliedAt, "SRE_CHANGE_TIMESTAMP_INVALID");
  const verifiedAt = parseTimestamp(evidence.verifiedAt, "SRE_VERIFIED_TIMESTAMP_INVALID");
  assert(verifiedAt >= appliedAt, "SRE_TIMESTAMP_ORDER_INVALID");
  assert(
    Number.isInteger(evidence.maximumEvidenceAgeSeconds) &&
      evidence.maximumEvidenceAgeSeconds > 0 &&
      evidence.maximumEvidenceAgeSeconds <= 604800,
    "SRE_MAXIMUM_AGE_INVALID",
  );
  assert(
    now().getTime() - verifiedAt <= evidence.maximumEvidenceAgeSeconds * 1000,
    "SRE_EVIDENCE_STALE",
  );
  const requiredActions = new Set(REQUIRED_UNEXECUTED_ACTIONS);
  if (evidence.result === "rolled_back") {
    requiredActions.delete("no_rollback");
    requiredActions.add("no_second_attempt");
  }
  assert(
    Array.isArray(evidence.actionsNotExecuted) &&
      requiredActions.size === evidence.actionsNotExecuted.length &&
      [...requiredActions].every((item) => evidence.actionsNotExecuted.includes(item)),
    "SRE_UNEXECUTED_ACTIONS_INCOMPLETE",
  );

  if (evidence.result === "executed_verified") {
    assert(
      evidence.readinessAfter.statusCode === 200 &&
        evidence.readinessAfter.status === "ready" &&
        evidence.readinessAfter.target === "reachable" &&
        evidence.readinessAfter.missing.length === 0 &&
        evidence.readinessAfter.errors.length === 0,
      "SRE_VERIFIED_READINESS_INVALID",
    );
    assert(
      evidence.supabaseReadiness.executed === true &&
        evidence.supabaseReadiness.result === "reachable",
      "SRE_SUPABASE_RESULT_INVALID",
    );
    assert(evidence.rollback.performed === false, "SRE_UNEXPECTED_ROLLBACK");
    assert(evidence.remainingBlocker === null, "SRE_UNEXPECTED_REMAINING_BLOCKER");
  } else if (evidence.result === "executed_degraded") {
    assert(
      evidence.readinessAfter.statusCode === 503 && evidence.readinessAfter.status === "degraded",
      "SRE_DEGRADED_READINESS_INVALID",
    );
    assert(
      typeof evidence.remainingBlocker === "string" && evidence.remainingBlocker.length > 0,
      "SRE_REMAINING_BLOCKER_REQUIRED",
    );
    assert(evidence.rollback.performed === false, "SRE_UNEXPECTED_ROLLBACK");
  } else {
    assert(evidence.rollback.performed === true, "SRE_ROLLBACK_REQUIRED");
  }

  return { status: "staging_readiness_execution_evidence_valid", result: evidence.result };
}

export function validateStagingReadinessExecutionEvidenceFile(filePath) {
  return validateStagingReadinessExecutionEvidence(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target =
    process.argv[2] || path.resolve("docs/program/STAGING_READINESS_EXECUTION_EVIDENCE.json");
  console.log(JSON.stringify(validateStagingReadinessExecutionEvidenceFile(target)));
}
