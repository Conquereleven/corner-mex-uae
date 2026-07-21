import fs from "node:fs";
import path from "node:path";

// Structural + business-rule validator for docs/program/STAGING_READINESS_CHANGE_REQUEST.schema.json
// records. This is a declarative policy checker only — it has no variable-write capability and
// does not call Railway, Supabase, or any other platform. It can never approve a production target.

const SHA = /^[0-9a-f]{40}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const DECISION_ID = /^FD-CM-[A-Z0-9.-]+$/;
const REQUEST_ID = /^SRC-\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+$/;

// The exact reconciled main SHA this sprint's evidence is bound to. A request proposing changes
// against a different SHA cannot be approved without fresh evidence collection first.
const RECONCILED_MAIN_SHA = "73790cb3724fc1f19bedd157fc237f07a46e4314";

// Sourced from src/config/commerce-env.ts. Adding a variable here does not authorize anything by
// itself — it only allows the *name* to appear in a request; approval still requires the
// contract-reference text below to match.
const ALLOWED_VARIABLE_NAMES = new Set([
  "CORNERMEX_COMMERCE_MODEL",
  "CORNERMEX_APPLICATION_ENV",
  "CORNERMEX_PUBLIC_APPLICATION_URL",
  "CORNERMEX_MARKETPLACE_ENABLED",
  "CORNERMEX_SELLER_AUTH_ENABLED",
  "CORNERMEX_SELLER_PAYOUTS_ENABLED",
  "CORNERMEX_COMMISSIONS_ENABLED",
  "CORNERMEX_CHECKOUT_ENABLED",
  "CORNERMEX_EXTERNAL_EMAIL_ENABLED",
  "CORNERMEX_EXTERNAL_MESSAGES_ENABLED",
  "CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED",
  "CORNERMEX_AUTOMATIC_IMPORT_ENABLED",
  "CORNERMEX_AUTOMATIC_INVENTORY_SYNC_ENABLED",
  "CORNERMEX_OPENCLAW_ENABLED",
  "CORNERMEX_CORNEROPS_WRITE_ENABLED",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_CORNERMEX_CHECKOUT_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]);

// The contract-reference text supplied for a known variable must mention its authoritative
// source so an approver can verify it without this validator ever reading a real value.
const CONTRACT_REFERENCE_REQUIRED_SUBSTRINGS = {
  CORNERMEX_COMMERCE_MODEL: ["commerce-env.ts", "single_merchant_with_internal_supplier_network"],
};

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

export function validateStagingReadinessChangeRequest(request, { now = () => new Date() } = {}) {
  assert(request && typeof request === "object" && !Array.isArray(request), "SRC_REQUEST_INVALID");
  assert(
    request.schemaVersion === "cornermex-staging-readiness-change-request-v1",
    "SRC_SCHEMA_VERSION_INVALID",
  );
  assert(REQUEST_ID.test(request.requestId || ""), "SRC_REQUEST_ID_INVALID");
  assert(DECISION_ID.test(request.founderDecisionId || ""), "SRC_DECISION_ID_INVALID");
  assert(SHA.test(request.exactMainSha || ""), "SRC_MAIN_SHA_INVALID");

  // Hard, unconditional boundary: this contract can never target production, regardless of
  // authorizationStatus. This is checked before anything else so it cannot be bypassed by any
  // later branch.
  assert(request.targetEnvironment === "staging", "SRC_PRODUCTION_TARGET_FORBIDDEN");

  assert(
    typeof request.targetService === "string" && request.targetService.length > 0,
    "SRC_TARGET_SERVICE_INVALID",
  );
  assert(
    Array.isArray(request.variableNames) && request.variableNames.length > 0,
    "SRC_VARIABLE_NAMES_INVALID",
  );
  for (const name of request.variableNames) {
    assert(ALLOWED_VARIABLE_NAMES.has(name), `SRC_UNKNOWN_VARIABLE:${name}`);
  }
  assert(
    request.proposedContractValues &&
      typeof request.proposedContractValues === "object" &&
      !Array.isArray(request.proposedContractValues),
    "SRC_CONTRACT_VALUES_INVALID",
  );
  for (const name of request.variableNames) {
    const reference = request.proposedContractValues[name];
    assert(
      typeof reference === "string" && reference.length > 0,
      `SRC_CONTRACT_VALUE_MISSING:${name}`,
    );
    const requiredSubstrings = CONTRACT_REFERENCE_REQUIRED_SUBSTRINGS[name];
    if (requiredSubstrings) {
      for (const substring of requiredSubstrings) {
        assert(reference.includes(substring), `SRC_CONTRACT_VALUE_OUTSIDE_CONTRACT:${name}`);
      }
    }
  }
  assert(request.valuesRedacted === true, "SRC_VALUES_REDACTED_REQUIRED");

  assert(
    typeof request.preChangeDeploymentId === "string" && request.preChangeDeploymentId.length > 0,
    "SRC_PRE_CHANGE_DEPLOYMENT_ID_INVALID",
  );
  assert(SHA.test(request.preChangeSourceSha || ""), "SRC_PRE_CHANGE_SOURCE_SHA_INVALID");
  assert(
    ["ok", "degraded", "unknown"].includes(request.preChangeHealth),
    "SRC_PRE_CHANGE_HEALTH_INVALID",
  );
  assert(
    ["ready", "degraded", "unknown"].includes(request.preChangeReadiness),
    "SRC_PRE_CHANGE_READINESS_INVALID",
  );
  assert(
    ["restart_required", "rebuild_required", "none_expected", "unknown"].includes(
      request.expectedRedeployBehavior,
    ),
    "SRC_REDEPLOY_BEHAVIOR_INVALID",
  );
  assert(
    typeof request.validationPlan === "string" && request.validationPlan.length > 0,
    "SRC_VALIDATION_PLAN_INVALID",
  );
  assert(
    /\/api\/ready/i.test(request.validationPlan) && /ready/i.test(request.validationPlan),
    "SRC_VALIDATION_PLAN_MISSING_READINESS_TARGET",
  );
  assert(
    typeof request.rollbackPlan === "string" && request.rollbackPlan.length > 0,
    "SRC_ROLLBACK_PLAN_INVALID",
  );
  assert(TIMESTAMP.test(request.createdAt || ""), "SRC_CREATED_AT_INVALID");
  assert(TIMESTAMP.test(request.expiresAt || ""), "SRC_EXPIRES_AT_INVALID");
  assert(
    Date.parse(request.expiresAt) >= Date.parse(request.createdAt),
    "SRC_EXPIRY_BEFORE_CREATION",
  );
  assert(
    Number.isInteger(request.maximumEvidenceAgeSeconds) &&
      request.maximumEvidenceAgeSeconds > 0 &&
      request.maximumEvidenceAgeSeconds <= 604800,
    "SRC_MAXIMUM_EVIDENCE_AGE_INVALID",
  );

  const AUTHORIZATION_STATES = new Set([
    "draft",
    "pending_founder_decision",
    "blocked_contract",
    "blocked_evidence",
    "approved_not_executed",
    "expired",
    "cancelled",
  ]);
  assert(AUTHORIZATION_STATES.has(request.authorizationStatus), "SRC_AUTHORIZATION_STATUS_INVALID");
  assert(request.executionStatus === "not_executed", "SRC_EXECUTION_STATUS_INVALID");

  if (request.authorizationStatus === "approved_not_executed") {
    const missing = [];
    if (!DECISION_ID.test(request.founderDecisionId || "")) missing.push("founder_decision_id");
    if (request.exactMainSha !== RECONCILED_MAIN_SHA) missing.push("main_sha_reconciled");
    if (request.preChangeHealth !== "ok") missing.push("health_ok");

    const nowMs = now().getTime();
    const observedAt = Date.parse(request.createdAt);
    const maxAgeMs = request.maximumEvidenceAgeSeconds * 1000;
    if (!Number.isFinite(observedAt) || nowMs - observedAt > maxAgeMs)
      missing.push("fresh_evidence");
    if (Date.parse(request.expiresAt) <= nowMs) missing.push("not_expired");

    if (missing.length > 0) {
      throw new Error(`SRC_APPROVED_NOT_EXECUTED_INCOMPLETE:${missing.join(",")}`);
    }
  }

  return {
    status: "staging_readiness_change_request_valid",
    authorizationStatus: request.authorizationStatus,
  };
}

export function validateStagingReadinessChangeRequestFile(filePath) {
  const request = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return validateStagingReadinessChangeRequest(request);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target =
    process.argv[2] || path.resolve("docs/program/STAGING_READINESS_CHANGE_REQUEST.example.json");
  console.log(JSON.stringify(validateStagingReadinessChangeRequestFile(target)));
}
