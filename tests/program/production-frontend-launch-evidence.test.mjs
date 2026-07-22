import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const evidence = JSON.parse(
  fs.readFileSync("docs/program/PRODUCTION_FRONTEND_LAUNCH_EVIDENCE.json", "utf8"),
);

test("CM-PROD-1 evidence pins the authorized source and rollback", () => {
  assert.equal(evidence.founderDecisionId, "FD-CM-PROD-LAUNCH-001");
  assert.equal(evidence.exactSourceSha, "068b9babacbadf0e786579e056e3363d7afb641c");
  assert.equal(evidence.railway.deploymentId, "b3184cee-67b7-4506-969b-bf18fead3292");
  assert.equal(evidence.rollback.targetDeploymentId, "bac2a5b3-0b8a-4243-8046-531113a4ca18");
  assert.equal(evidence.rollback.performed, false);
});

test("CM-PROD-1 evidence keeps every execution capability off", () => {
  for (const [name, enabled] of Object.entries(evidence.capabilities)) {
    assert.equal(enabled, false, `${name} must remain false`);
  }
  assert.equal(evidence.checks.health.httpStatus, 200);
  assert.equal(evidence.checks.readiness.status, "ready");
  assert.equal(evidence.checks.readiness.target, "reachable");
  assert.equal(evidence.secretValues, "redacted_not_recorded");
});
