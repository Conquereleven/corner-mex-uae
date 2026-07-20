import fs from "node:fs";
import path from "node:path";

const EXPECTED_REPOSITORY = "Conquereleven/corner-mex-uae";
const EXPECTED_RAILWAY_PROJECT = "06d2ecdd-3c03-4480-8299-48c539595a94";
const SHA = /^[0-9a-f]{40}$/;
const DECISION_ID = /^FD-CM-[A-Z0-9.-]+$/;

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const readRegistry = (baseDir) =>
  JSON.parse(
    fs.readFileSync(path.resolve(baseDir, "docs/program/DEPLOYMENT_REGISTRY.json"), "utf8"),
  );

export function validateDeploymentGovernance({ baseDir = process.cwd() } = {}) {
  const registry = readRegistry(baseDir);
  const governance = registry.governance;

  assert(registry.repository === EXPECTED_REPOSITORY, "DEPLOYMENT_REPOSITORY_INVALID");
  assert(registry.railwayProjectId === EXPECTED_RAILWAY_PROJECT, "RAILWAY_PROJECT_INVALID");
  assert(governance?.model === "automatic_staging_manual_production", "GOVERNANCE_MODEL_INVALID");
  assert(Array.isArray(governance.contexts), "GOVERNANCE_CONTEXTS_REQUIRED");

  const staging = governance.contexts.find(({ environment }) => environment === "staging");
  const production = governance.contexts.find(({ environment }) => environment === "production");
  assert(staging, "STAGING_GOVERNANCE_REQUIRED");
  assert(production, "PRODUCTION_GOVERNANCE_REQUIRED");
  assert(staging.autoDeploy === true, "STAGING_AUTODEPLOY_EXPECTED");
  assert(production.autoDeploy === false, "PRODUCTION_AUTODEPLOY_FORBIDDEN");
  assert(production.trigger === "explicit_manual_action", "PRODUCTION_TRIGGER_INVALID");
  assert(
    production.connectedRepository === EXPECTED_REPOSITORY && production.watchedBranch === "main",
    "PRODUCTION_SOURCE_IDENTITY_INVALID",
  );
  assert(SHA.test(production.currentSourceSha), "PRODUCTION_SOURCE_SHA_INVALID");
  assert(
    production.requiredDecisionIdPattern === DECISION_ID.source,
    "PRODUCTION_DECISION_PATTERN_INVALID",
  );
  assert(
    production.requiredPreconditions?.includes("health_and_readiness_green") &&
      production.requiredPreconditions?.includes("rollback_target_verified"),
    "PRODUCTION_PRECONDITIONS_INCOMPLETE",
  );

  const change = governance.lastPlatformChange;
  assert(change?.productionAutoDeployBefore === true, "GOVERNANCE_PRESTATE_INVALID");
  assert(change?.productionAutoDeployAfter === false, "GOVERNANCE_POSTSTATE_INVALID");
  assert(change?.deploymentCreated === false, "GOVERNANCE_CHANGE_DEPLOYED");
  assert(change?.restartPerformed === false, "GOVERNANCE_CHANGE_RESTARTED");
  assert(change?.rollbackPerformed === false, "GOVERNANCE_CHANGE_ROLLED_BACK");

  return {
    status: "deployment_governance_valid",
    model: governance.model,
    stagingAutoDeploy: staging.autoDeploy,
    productionAutoDeploy: production.autoDeploy,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(validateDeploymentGovernance()));
}
