import fs from "node:fs";
import path from "node:path";

// Structural + business-rule validator for docs/program/PRODUCTION_ACTIVATION_REQUEST.schema.json
// records. This is a declarative policy checker only — it has no deployment capability and does
// not call Railway, Supabase, or any other platform.

const SHA = /^[0-9a-f]{40}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const DECISION_ID = /^FD-CM-[A-Z0-9.-]+$/;
const REQUEST_ID = /^PAR-\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+$/;

const AUTHORIZATION_STATES = new Set([
  "draft",
  "pending_founder_decision",
  "blocked_readiness",
  "blocked_governance",
  "approved_not_executed",
  "expired",
  "cancelled",
]);
const LIVE_GOVERNANCE_STATES = new Set([
  "live_governance_verified",
  "live_governance_drift_detected",
  "live_governance_probe_unavailable",
  "live_governance_response_malformed",
  "live_governance_credentials_missing",
]);

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

export function validateProductionActivationRequest(request) {
  assert(
    request?.schemaVersion === "cornermex-production-activation-request-v1",
    "PAR_SCHEMA_VERSION_INVALID",
  );
  assert(REQUEST_ID.test(request.requestId || ""), "PAR_REQUEST_ID_INVALID");
  assert(DECISION_ID.test(request.founderDecisionId || ""), "PAR_DECISION_ID_INVALID");
  assert(SHA.test(request.exactSourceSha || ""), "PAR_SOURCE_SHA_INVALID");
  assert(
    typeof request.requester === "string" && request.requester.length > 0,
    "PAR_REQUESTER_INVALID",
  );
  assert(
    typeof request.operator === "string" && request.operator.length > 0,
    "PAR_OPERATOR_INVALID",
  );
  assert(TIMESTAMP.test(request.createdAt || ""), "PAR_CREATED_AT_INVALID");
  assert(TIMESTAMP.test(request.expiresAt || ""), "PAR_EXPIRES_AT_INVALID");
  assert(
    Date.parse(request.expiresAt) >= Date.parse(request.createdAt),
    "PAR_EXPIRY_BEFORE_CREATION",
  );

  assert(Number.isInteger(request.ci?.runId), "PAR_CI_RUN_ID_INVALID");
  assert(
    ["success", "failure", "cancelled", "pending", "unknown"].includes(request.ci?.conclusion),
    "PAR_CI_CONCLUSION_INVALID",
  );

  assert(
    TIMESTAMP.test(request.healthEvidence?.observedAt || ""),
    "PAR_HEALTH_OBSERVED_AT_INVALID",
  );
  assert(request.healthEvidence?.path === "/api/health", "PAR_HEALTH_PATH_INVALID");
  assert(
    ["ok", "degraded", "unknown"].includes(request.healthEvidence?.status),
    "PAR_HEALTH_STATUS_INVALID",
  );

  assert(
    TIMESTAMP.test(request.readinessEvidence?.observedAt || ""),
    "PAR_READINESS_OBSERVED_AT_INVALID",
  );
  assert(request.readinessEvidence?.path === "/api/ready", "PAR_READINESS_PATH_INVALID");
  assert(
    ["ok", "degraded", "unknown"].includes(request.readinessEvidence?.status),
    "PAR_READINESS_STATUS_INVALID",
  );

  assert(
    TIMESTAMP.test(request.liveGovernanceEvidence?.observedAt || ""),
    "PAR_LIVE_GOVERNANCE_OBSERVED_AT_INVALID",
  );
  assert(
    LIVE_GOVERNANCE_STATES.has(request.liveGovernanceEvidence?.status),
    "PAR_LIVE_GOVERNANCE_STATUS_INVALID",
  );

  assert(SHA.test(request.rollbackTarget || ""), "PAR_ROLLBACK_TARGET_INVALID");
  assert(
    ["immediately_redeployable", "historical_removed_rebuild_required", "unknown"].includes(
      request.rollbackAvailability,
    ),
    "PAR_ROLLBACK_AVAILABILITY_INVALID",
  );

  assert(
    typeof request.expectedProductionService === "string" &&
      request.expectedProductionService.length > 0,
    "PAR_EXPECTED_SERVICE_INVALID",
  );
  assert(request.expectedEnvironment === "production", "PAR_EXPECTED_ENVIRONMENT_INVALID");

  assert(AUTHORIZATION_STATES.has(request.authorizationStatus), "PAR_AUTHORIZATION_STATUS_INVALID");
  assert(request.executionStatus === "not_executed", "PAR_EXECUTION_STATUS_INVALID");

  if (request.authorizationStatus === "approved_not_executed") {
    const missing = [];
    if (!DECISION_ID.test(request.founderDecisionId || "")) missing.push("founder_decision_id");
    if (!SHA.test(request.exactSourceSha || "")) missing.push("exact_source_sha");
    if (request.ci?.conclusion !== "success") missing.push("ci_green");
    if (request.healthEvidence?.status !== "ok") missing.push("health_green");
    if (request.readinessEvidence?.status !== "ok") missing.push("readiness_green");
    if (request.liveGovernanceEvidence?.status !== "live_governance_verified") {
      missing.push("live_governance_green");
    }
    if (
      request.rollbackAvailability !== "immediately_redeployable" &&
      request.rollbackAvailability !== "historical_removed_rebuild_required"
    ) {
      missing.push("rollback_target_usable");
    }
    const freshnessWindowMs = Date.parse(request.expiresAt) - Date.now();
    if (!Number.isFinite(freshnessWindowMs) || freshnessWindowMs <= 0)
      missing.push("fresh_evidence");

    if (missing.length > 0) {
      throw new Error(`PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:${missing.join(",")}`);
    }
  }

  return {
    status: "production_activation_request_valid",
    authorizationStatus: request.authorizationStatus,
  };
}

export function validateProductionActivationRequestFile(filePath) {
  const request = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return validateProductionActivationRequest(request);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target =
    process.argv[2] || path.resolve("docs/program/PRODUCTION_ACTIVATION_REQUEST.example.json");
  console.log(JSON.stringify(validateProductionActivationRequestFile(target)));
}
