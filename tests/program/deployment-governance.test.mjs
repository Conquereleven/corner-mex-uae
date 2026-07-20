import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDeploymentGovernance } from "../../scripts/program/validate-deployment-governance.mjs";

const withRegistry = (mutate, assertion) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-deploy-governance-"));
  const fixtureDir = path.join(baseDir, "docs/program");
  fs.mkdirSync(fixtureDir, { recursive: true });
  const registry = JSON.parse(fs.readFileSync("docs/program/DEPLOYMENT_REGISTRY.json", "utf8"));
  mutate(registry);
  fs.writeFileSync(
    path.join(fixtureDir, "DEPLOYMENT_REGISTRY.json"),
    `${JSON.stringify(registry, null, 2)}\n`,
  );
  try {
    assertion(() => validateDeploymentGovernance({ baseDir }));
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
};

test("accepts automatic staging with manual production", () => {
  const result = validateDeploymentGovernance();
  assert.equal(result.status, "deployment_governance_valid");
  assert.equal(result.stagingAutoDeploy, true);
  assert.equal(result.productionAutoDeploy, false);
});

test("rejects production auto-deploy", () => {
  withRegistry(
    (registry) => {
      registry.governance.contexts.find(
        ({ environment }) => environment === "production",
      ).autoDeploy = true;
    },
    (validate) => assert.throws(validate, /PRODUCTION_AUTODEPLOY_FORBIDDEN/),
  );
});

test("rejects merge or push as the production trigger", () => {
  withRegistry(
    (registry) => {
      registry.governance.contexts.find(({ environment }) => environment === "production").trigger =
        "github_push_main";
    },
    (validate) => assert.throws(validate, /PRODUCTION_TRIGGER_INVALID/),
  );
});

test("rejects a governance change that created a deployment", () => {
  withRegistry(
    (registry) => {
      registry.governance.lastPlatformChange.deploymentCreated = true;
    },
    (validate) => assert.throws(validate, /GOVERNANCE_CHANGE_DEPLOYED/),
  );
});
