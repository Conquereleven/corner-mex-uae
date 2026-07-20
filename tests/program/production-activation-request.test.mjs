import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProductionActivationRequest,
  validateProductionActivationRequestFile,
} from "../../scripts/program/validate-production-activation-request.mjs";

const SHA_A = "a173dfc6d5b0d8b62710a1ce604d6df9ea63c373";
const SHA_ROLLBACK = "a558785d3fc2c1eb2aa9298087bba7f940094bcb";

const baseRequest = () => ({
  schemaVersion: "cornermex-production-activation-request-v1",
  requestId: "PAR-2026-07-20-test-request",
  founderDecisionId: "FD-CM-TEST-001",
  exactSourceSha: SHA_A,
  requester: "codex",
  operator: "joel",
  createdAt: "2026-07-20T00:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  ci: { runId: 1, conclusion: "success" },
  healthEvidence: { observedAt: "2026-07-20T00:00:00Z", path: "/api/health", status: "ok" },
  readinessEvidence: { observedAt: "2026-07-20T00:00:00Z", path: "/api/ready", status: "ok" },
  liveGovernanceEvidence: {
    observedAt: "2026-07-20T00:00:00Z",
    status: "live_governance_verified",
  },
  rollbackTarget: SHA_ROLLBACK,
  rollbackAvailability: "historical_removed_rebuild_required",
  expectedProductionService: "corner-mex-uae",
  expectedEnvironment: "production",
  authorizationStatus: "draft",
  executionStatus: "not_executed",
});

test("accepts a well-formed draft request", () => {
  const result = validateProductionActivationRequest(baseRequest());
  assert.equal(result.status, "production_activation_request_valid");
  assert.equal(result.authorizationStatus, "draft");
});

test("accepts approved_not_executed only when every completeness element is green", () => {
  const request = { ...baseRequest(), authorizationStatus: "approved_not_executed" };
  const result = validateProductionActivationRequest(request);
  assert.equal(result.authorizationStatus, "approved_not_executed");
});

test("rejects approved_not_executed missing a Founder decision ID", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    founderDecisionId: "",
  };
  assert.throws(() => validateProductionActivationRequest(request), /PAR_DECISION_ID_INVALID/);
});

test("rejects approved_not_executed when CI is not green", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    ci: { runId: 1, conclusion: "failure" },
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*ci_green/,
  );
});

test("rejects approved_not_executed when health is not green", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    healthEvidence: { ...baseRequest().healthEvidence, status: "degraded" },
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*health_green/,
  );
});

test("rejects approved_not_executed when readiness is not green", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    readinessEvidence: { ...baseRequest().readinessEvidence, status: "degraded" },
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*readiness_green/,
  );
});

test("rejects approved_not_executed when live governance evidence is not verified", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    liveGovernanceEvidence: {
      observedAt: "2026-07-20T00:00:00Z",
      status: "live_governance_credentials_missing",
    },
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*live_governance_green/,
  );
});

test("rejects approved_not_executed when the rollback target is not usable", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    rollbackAvailability: "unknown",
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*rollback_target_usable/,
  );
});

test("rejects approved_not_executed when evidence has already expired", () => {
  const request = {
    ...baseRequest(),
    authorizationStatus: "approved_not_executed",
    createdAt: "2020-01-01T00:00:00Z",
    expiresAt: "2020-01-02T00:00:00Z",
  };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_APPROVED_NOT_EXECUTED_INCOMPLETE:.*fresh_evidence/,
  );
});

test("rejects an incorrect schema version", () => {
  const request = { ...baseRequest(), schemaVersion: "cornermex-production-activation-request-v0" };
  assert.throws(() => validateProductionActivationRequest(request), /PAR_SCHEMA_VERSION_INVALID/);
});

test("rejects a Founder decision ID that does not match the required pattern", () => {
  const request = { ...baseRequest(), founderDecisionId: "NOT-A-DECISION-ID" };
  assert.throws(() => validateProductionActivationRequest(request), /PAR_DECISION_ID_INVALID/);
});

test("rejects a malformed source SHA", () => {
  const request = { ...baseRequest(), exactSourceSha: "not-a-sha" };
  assert.throws(() => validateProductionActivationRequest(request), /PAR_SOURCE_SHA_INVALID/);
});

test("rejects executionStatus other than not_executed (no executor exists)", () => {
  const request = { ...baseRequest(), executionStatus: "executed" };
  assert.throws(() => validateProductionActivationRequest(request), /PAR_EXECUTION_STATUS_INVALID/);
});

test("rejects an unrecognized authorizationStatus", () => {
  const request = { ...baseRequest(), authorizationStatus: "silently_deployed" };
  assert.throws(
    () => validateProductionActivationRequest(request),
    /PAR_AUTHORIZATION_STATUS_INVALID/,
  );
});

test("the committed example is a blocked template, not an approved request", () => {
  const result = validateProductionActivationRequestFile(
    "docs/program/PRODUCTION_ACTIVATION_REQUEST.example.json",
  );
  assert.notEqual(result.authorizationStatus, "approved_not_executed");
});
