import test from "node:test";
import assert from "node:assert/strict";
import {
  validateStagingReadinessChangeRequest,
  validateStagingReadinessChangeRequestFile,
} from "../../scripts/program/validate-staging-readiness-change-request.mjs";

const MAIN_SHA = "73790cb3724fc1f19bedd157fc237f07a46e4314";
const PRE_CHANGE_SHA = "a173dfc6d5b0d8b62710a1ce604d6df9ea63c373";

const baseRequest = () => ({
  schemaVersion: "cornermex-staging-readiness-change-request-v1",
  requestId: "SRC-2026-07-21-test-request",
  founderDecisionId: "FD-CM-TEST-002",
  exactMainSha: MAIN_SHA,
  targetEnvironment: "staging",
  targetService: "cornermex-web",
  variableNames: ["CORNERMEX_COMMERCE_MODEL"],
  proposedContractValues: {
    CORNERMEX_COMMERCE_MODEL:
      "exact literal from src/config/commerce-env.ts: single_merchant_with_internal_supplier_network",
  },
  valuesRedacted: true,
  preChangeDeploymentId: "7051fc17-56f0-456a-b547-bbf2f468e489",
  preChangeSourceSha: PRE_CHANGE_SHA,
  preChangeHealth: "ok",
  preChangeReadiness: "degraded",
  expectedRedeployBehavior: "restart_required",
  validationPlan:
    "GET /api/ready and confirm the response is ready with no CORNERMEX_COMMERCE_MODEL error.",
  rollbackPlan: "Restore the noted prior value and allow Railway to restart the service.",
  createdAt: "2026-07-21T18:20:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  maximumEvidenceAgeSeconds: 604800,
  authorizationStatus: "draft",
  executionStatus: "not_executed",
});

test("accepts a well-formed draft request", () => {
  const result = validateStagingReadinessChangeRequest(baseRequest());
  assert.equal(result.status, "staging_readiness_change_request_valid");
});

test("accepts approved_not_executed only when completeness elements are satisfied", () => {
  const request = { ...baseRequest(), authorizationStatus: "approved_not_executed" };
  const result = validateStagingReadinessChangeRequest(request);
  assert.equal(result.authorizationStatus, "approved_not_executed");
});

test("rejects a production target unconditionally, even if otherwise well-formed", () => {
  const request = { ...baseRequest(), targetEnvironment: "production" };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_PRODUCTION_TARGET_FORBIDDEN/,
  );
});

test("rejects approval missing a Founder decision", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    founderDecisionId: "",
  };
  assert.throws(() => validateStagingReadinessChangeRequest(request), /SRC_DECISION_ID_INVALID/);
});

test("rejects an unknown variable name", () => {
  const request = { ...baseRequest(), variableNames: ["SOME_RANDOM_VARIABLE"] };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_UNKNOWN_VARIABLE:SOME_RANDOM_VARIABLE/,
  );
});

test("rejects a proposed contract value that does not reference the authoritative source", () => {
  const request = {
    ...baseRequest(),
    proposedContractValues: { CORNERMEX_COMMERCE_MODEL: "whatever seems right" },
  };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_CONTRACT_VALUE_OUTSIDE_CONTRACT:CORNERMEX_COMMERCE_MODEL/,
  );
});

test("rejects a malformed main SHA", () => {
  const request = { ...baseRequest(), exactMainSha: "not-a-sha" };
  assert.throws(() => validateStagingReadinessChangeRequest(request), /SRC_MAIN_SHA_INVALID/);
});

test("rejects approval when the main SHA does not match the reconciled evidence SHA", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    exactMainSha: "f".repeat(40),
  };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_APPROVED_NOT_EXECUTED_INCOMPLETE:.*main_sha_reconciled/,
  );
});

test("rejects approval when evidence is stale relative to an injected clock", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    createdAt: "2020-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    maximumEvidenceAgeSeconds: 3600,
  };
  assert.throws(
    () =>
      validateStagingReadinessChangeRequest(request, {
        now: () => new Date("2020-01-02T00:00:00Z"),
      }),
    /SRC_APPROVED_NOT_EXECUTED_INCOMPLETE:.*fresh_evidence/,
  );
});

test("rejects approval when pre-change health is degraded", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    preChangeHealth: "degraded",
  };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_APPROVED_NOT_EXECUTED_INCOMPLETE:.*health_ok/,
  );
});

test("requires the validation plan to explicitly name the readiness target", () => {
  const request = { ...baseRequest(), validationPlan: "Check that things look fine." };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_VALIDATION_PLAN_MISSING_READINESS_TARGET/,
  );
});

test("requires valuesRedacted to be true", () => {
  const request = { ...baseRequest(), valuesRedacted: false };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_VALUES_REDACTED_REQUIRED/,
  );
});

test("rejects an unknown executionStatus", () => {
  const request = { ...baseRequest(), executionStatus: "executed" };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_EXECUTION_STATUS_INVALID/,
  );
});

test("rejects more than one variable", () => {
  const request = {
    ...baseRequest(),
    variableNames: ["CORNERMEX_COMMERCE_MODEL", "SUPABASE_URL"],
    proposedContractValues: {
      CORNERMEX_COMMERCE_MODEL:
        "exact literal from src/config/commerce-env.ts: single_merchant_with_internal_supplier_network",
      SUPABASE_URL: "src/config/commerce-env.ts",
    },
  };
  assert.throws(() => validateStagingReadinessChangeRequest(request), /SRC_VARIABLE_NAMES_INVALID/);
});

test("rejects unknown fields", () => {
  const request = { ...baseRequest(), surprise: true };
  assert.throws(() => validateStagingReadinessChangeRequest(request), /SRC_UNKNOWN_FIELD:surprise/);
});

for (const executionStatus of ["executed_verified", "executed_degraded", "rolled_back"]) {
  test(`accepts authorized ${executionStatus} with durable evidence`, () => {
    const request = {
      ...baseRequest(),
      founderDecisionId: "FD-CM-STAGING-READINESS-001",
      authorizationStatus: "approved_executed",
      executionStatus,
      executionEvidenceFile: "docs/program/STAGING_READINESS_EXECUTION_EVIDENCE.json",
    };
    assert.equal(validateStagingReadinessChangeRequest(request).executionStatus, executionStatus);
  });
}

test("rejects an executed request without its evidence file", () => {
  const request = {
    ...baseRequest(),
    founderDecisionId: "FD-CM-STAGING-READINESS-001",
    authorizationStatus: "approved_executed",
    executionStatus: "executed_verified",
  };
  assert.throws(
    () => validateStagingReadinessChangeRequest(request),
    /SRC_EXECUTION_EVIDENCE_REQUIRED/,
  );
});

test("the committed example records the verified authorized execution", () => {
  const result = validateStagingReadinessChangeRequestFile(
    "docs/program/STAGING_READINESS_CHANGE_REQUEST.example.json",
  );
  assert.equal(result.authorizationStatus, "approved_executed");
  assert.equal(result.executionStatus, "executed_verified");
});
