import fs from "node:fs";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const sha = /^[0-9a-f]{40}$/;
const evidenceClasses = new Set([
  "verified_live",
  "verified_repository",
  "documented_only",
  "historical",
  "inferred",
  "unknown",
  "blocked",
]);

export function validateProgramState() {
  const current = readJson("docs/program/CURRENT_STATE.json");
  const registry = readJson("docs/program/DEPLOYMENT_REGISTRY.json");
  const handoff = readJson("docs/program/AGENT_HANDOFF_SCHEMA.json");

  assert(current.schemaVersion === "joint-program-state-v1", "PROGRAM_STATE_VERSION_INVALID");
  assert(current.system === "cornermex", "PROGRAM_STATE_SYSTEM_INVALID");
  assert(
    current.authority.repository === "Conquereleven/corner-mex-uae",
    "PROGRAM_REPOSITORY_INVALID",
  );
  assert(sha.test(current.authority.expectedMainSha), "PROGRAM_EXPECTED_SHA_INVALID");
  assert(sha.test(current.authority.observedMainSha), "PROGRAM_OBSERVED_SHA_INVALID");
  assert(
    current.authority.expectedMainSha === current.authority.observedMainSha,
    "PROGRAM_MAIN_DRIFT",
  );
  assert(evidenceClasses.has(current.evidence.class), "PROGRAM_EVIDENCE_CLASS_INVALID");
  assert(Number.isFinite(Date.parse(current.evidence.observedAt)), "PROGRAM_OBSERVED_AT_INVALID");
  assert(
    current.platforms.supabase.projectRef === "wlrfknmrhowldygmvtvn",
    "PROGRAM_SUPABASE_IDENTITY_INVALID",
  );
  assert(current.platforms.supabase.writePerformed === false, "PROGRAM_SUPABASE_WRITE_FORBIDDEN");
  assert(current.platforms.lovable.writePerformed === false, "PROGRAM_LOVABLE_WRITE_FORBIDDEN");
  assert(current.readiness.declaredReady === false, "PROGRAM_READINESS_MUST_REMAIN_BLOCKED");
  assert(
    current.safety.writesBlocked &&
      current.safety.externalSendsBlocked &&
      current.safety.customerImpactBlocked,
    "PROGRAM_SAFETY_GATE_OPEN",
  );

  assert(
    registry.schemaVersion === "cornermex-deployment-registry-v1",
    "DEPLOYMENT_REGISTRY_VERSION_INVALID",
  );
  assert(
    registry.expectedCommit === current.authority.observedMainSha,
    "DEPLOYMENT_EXPECTED_SHA_MISMATCH",
  );
  assert(registry.deployments.length === 2, "DEPLOYMENT_CONTEXT_COUNT_INVALID");
  for (const deployment of registry.deployments) {
    assert(deployment.sourceCommit === registry.expectedCommit, "DEPLOYMENT_SOURCE_SHA_MISMATCH");
    assert(deployment.state === "FAILED", "DEPLOYMENT_STATE_NOT_RECONCILED");
    assert(deployment.failureStage === "dependency_install", "DEPLOYMENT_FAILURE_STAGE_INVALID");
    assert(
      deployment.failureClassification === "package_manager_lockfile_mismatch",
      "DEPLOYMENT_ROOT_CAUSE_INVALID",
    );
    assert(deployment.buildCommand === "npm run build:railway", "DEPLOYMENT_BUILD_COMMAND_INVALID");
    assert(deployment.startCommand === "npm run start:railway", "DEPLOYMENT_START_COMMAND_INVALID");
    assert(deployment.healthPath === "/api/health", "DEPLOYMENT_HEALTH_PATH_INVALID");
    assert(evidenceClasses.has(deployment.evidenceClass), "DEPLOYMENT_EVIDENCE_CLASS_INVALID");
  }
  assert(registry.remediation.railwayWritePerformed === false, "RAILWAY_WRITE_FORBIDDEN");
  assert(registry.remediation.redeployPerformed === false, "RAILWAY_REDEPLOY_FORBIDDEN");

  assert(
    handoff.$schema === "https://json-schema.org/draft/2020-12/schema",
    "HANDOFF_SCHEMA_DRAFT_INVALID",
  );
  assert(
    handoff.properties.repository.const === "Conquereleven/corner-mex-uae",
    "HANDOFF_REPOSITORY_INVALID",
  );
  assert(handoff.required.includes("platformWrites"), "HANDOFF_PLATFORM_WRITES_REQUIRED");
  assert(handoff.required.includes("finalStatus"), "HANDOFF_FINAL_STATUS_REQUIRED");

  return {
    status: "program_state_valid",
    repository: current.authority.repository,
    main: current.authority.observedMainSha,
    railwayContexts: registry.deployments.length,
    productionWrites: 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(validateProgramState()));
}
