import fs from "node:fs";
import path from "node:path";

const EXPECTED_REPOSITORY = "Conquereleven/corner-mex-uae";
const EXPECTED_RAILWAY_PROJECT = "06d2ecdd-3c03-4480-8299-48c539595a94";
const EXPECTED_DATABASE_IDENTITIES = Object.freeze({
  DB1_LEGACY: "d9495376-339d-44dd-9c8a-db0f7b451f96",
  DB2_CANONICAL: "wlrfknmrhowldygmvtvn",
  DB3_CORNEROPS_SOURCE: "nhxpujypqxbjiqqddxqt",
});
const REVIEWED_A3_2B_REMEDIATION_HEAD = "33f2231443172b1956c5adf2b609a3e0bb02daab";
const SHA = /^[0-9a-f]{40}$/;
const ISO_UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const EVIDENCE_CLASSES = new Set([
  "verified_live",
  "verified_repository",
  "documented_only",
  "historical",
  "inferred",
  "unknown",
  "blocked",
]);

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const parseTimestamp = (value, code) => {
  assert(typeof value === "string" && ISO_UTC_SECONDS.test(value), code);
  const milliseconds = Date.parse(value);
  const canonical = Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString().replace(".000Z", "Z")
    : null;
  assert(canonical === value, code);
  return milliseconds;
};

const readJson = (baseDir, relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(baseDir, relativePath), "utf8"));

export function validateProgramState({ baseDir = process.cwd(), now = new Date() } = {}) {
  const current = readJson(baseDir, "docs/program/CURRENT_STATE.json");
  const registry = readJson(baseDir, "docs/program/DEPLOYMENT_REGISTRY.json");
  const handoff = readJson(baseDir, "docs/program/AGENT_HANDOFF_SCHEMA.json");

  assert(current.schemaVersion === "joint-program-state-v1", "PROGRAM_STATE_VERSION_INVALID");
  assert(current.system === "cornermex", "PROGRAM_STATE_SYSTEM_INVALID");
  assert(current.authority?.repository === EXPECTED_REPOSITORY, "PROGRAM_REPOSITORY_INVALID");
  assert(SHA.test(current.authority.expectedMainSha), "PROGRAM_EXPECTED_SHA_INVALID");
  assert(SHA.test(current.authority.observedMainSha), "PROGRAM_OBSERVED_SHA_INVALID");
  assert(
    current.authority.expectedMainSha === current.authority.observedMainSha,
    "PROGRAM_MAIN_DRIFT",
  );

  assert(current.evidence && typeof current.evidence === "object", "PROGRAM_EVIDENCE_REQUIRED");
  assert(EVIDENCE_CLASSES.has(current.evidence.class), "PROGRAM_EVIDENCE_CLASS_INVALID");
  const observedAt = parseTimestamp(current.evidence.observedAt, "PROGRAM_OBSERVED_AT_INVALID");
  const freshUntil = parseTimestamp(current.evidence.freshUntil, "PROGRAM_FRESH_UNTIL_INVALID");
  assert(freshUntil >= observedAt, "PROGRAM_FRESHNESS_WINDOW_INVALID");
  const nowMilliseconds = now instanceof Date ? now.getTime() : Date.parse(now);
  assert(Number.isFinite(nowMilliseconds), "PROGRAM_VALIDATION_CLOCK_INVALID");
  assert(nowMilliseconds <= freshUntil, "PROGRAM_STATE_EVIDENCE_STALE");

  assert(
    current.platforms?.railway?.projectId === EXPECTED_RAILWAY_PROJECT,
    "PROGRAM_RAILWAY_IDENTITY_INVALID",
  );
  assert(Array.isArray(current.platforms?.databases), "PROGRAM_DATABASE_IDENTITIES_REQUIRED");
  const roles = current.platforms.databases.map(({ role }) => role);
  assert(new Set(roles).size === roles.length, "PROGRAM_DATABASE_ROLE_DUPLICATE");
  assert(
    roles.length === Object.keys(EXPECTED_DATABASE_IDENTITIES).length &&
      roles.every((role) => Object.hasOwn(EXPECTED_DATABASE_IDENTITIES, role)),
    "PROGRAM_DATABASE_ROLE_UNKNOWN",
  );
  for (const identity of current.platforms.databases) {
    assert(
      identity.projectRef === EXPECTED_DATABASE_IDENTITIES[identity.role],
      "PROGRAM_DATABASE_IDENTITY_INVALID",
    );
  }
  assert(
    current.platforms.supabase?.projectRef === EXPECTED_DATABASE_IDENTITIES.DB2_CANONICAL,
    "PROGRAM_SUPABASE_IDENTITY_INVALID",
  );
  assert(current.platforms.supabase.writePerformed === false, "PROGRAM_SUPABASE_WRITE_FORBIDDEN");
  assert(current.platforms.lovable?.writePerformed === false, "PROGRAM_LOVABLE_WRITE_FORBIDDEN");

  const readinessGates = [
    current.readiness?.freshLiveReadOnlyPreflight,
    current.readiness?.independentReviewOfRemediationHead,
  ];
  assert(
    readinessGates.every((value) => typeof value === "boolean"),
    "PROGRAM_READINESS_INVALID",
  );
  if (current.readiness.independentReviewOfRemediationHead) {
    assert(
      current.readiness.reviewedRemediationHeadSha === REVIEWED_A3_2B_REMEDIATION_HEAD,
      "PROGRAM_REVIEWED_HEAD_IDENTITY_INVALID",
    );
  }
  assert(
    current.readiness.declaredReady === readinessGates.every(Boolean),
    "PROGRAM_READINESS_CONTRADICTS_EVIDENCE",
  );
  assert(
    current.readiness.currentP0RemediationReview?.complete === false &&
      current.readiness.currentP0RemediationReview?.reviewedHeadSha === null,
    "PROGRAM_P0_REVIEW_MUST_REMAIN_PENDING",
  );
  assert(
    current.safety?.writesBlocked &&
      current.safety.externalSendsBlocked &&
      current.safety.customerImpactBlocked,
    "PROGRAM_SAFETY_GATE_OPEN",
  );

  assert(
    registry.schemaVersion === "cornermex-deployment-registry-v2",
    "DEPLOYMENT_REGISTRY_VERSION_INVALID",
  );
  assert(registry.repository === EXPECTED_REPOSITORY, "DEPLOYMENT_REPOSITORY_INVALID");
  assert(
    registry.railwayProjectId === EXPECTED_RAILWAY_PROJECT,
    "DEPLOYMENT_RAILWAY_IDENTITY_INVALID",
  );
  assert(
    registry.incidentClassification === "unexpected_automated_platform_write" &&
      registry.outageVerified === false,
    "DEPLOYMENT_IMPACT_CLASSIFICATION_INVALID",
  );
  assert(
    parseTimestamp(registry.observedAt, "DEPLOYMENT_OBSERVED_AT_INVALID") === observedAt,
    "DEPLOYMENT_OBSERVATION_MISMATCH",
  );
  assert(Array.isArray(registry.expectedContexts), "DEPLOYMENT_CONTEXT_SCHEMA_INVALID");
  assert(Array.isArray(registry.failedSourceCommits), "DEPLOYMENT_COMMIT_SCHEMA_INVALID");
  assert(registry.expectedContexts.length > 0, "DEPLOYMENT_CONTEXT_SCHEMA_INVALID");
  assert(registry.failedSourceCommits.length > 0, "DEPLOYMENT_COMMIT_SCHEMA_INVALID");
  assert(
    registry.failedSourceCommits.every((commit) => SHA.test(commit)),
    "DEPLOYMENT_SHA_INVALID",
  );
  assert(SHA.test(registry.currentSourceCommit), "DEPLOYMENT_SHA_INVALID");
  assert(SHA.test(registry.historicalSuccessfulCommit), "DEPLOYMENT_SHA_INVALID");
  assert(
    registry.currentSourceCommit === current.authority.observedMainSha,
    "DEPLOYMENT_CURRENT_SOURCE_DRIFT",
  );
  assert(Array.isArray(registry.deployments), "DEPLOYMENT_HISTORY_REQUIRED");

  const deploymentIds = registry.deployments.map(({ deploymentId }) => deploymentId);
  assert(new Set(deploymentIds).size === deploymentIds.length, "DEPLOYMENT_ID_DUPLICATE");
  const expectedHistoryCount =
    registry.expectedContexts.length * (registry.failedSourceCommits.length + 2);
  assert(registry.deployments.length === expectedHistoryCount, "DEPLOYMENT_HISTORY_INCOMPLETE");

  for (const context of registry.expectedContexts) {
    const contextDeployments = registry.deployments.filter(
      (deployment) =>
        deployment.serviceId === context.serviceId &&
        deployment.environmentId === context.environmentId,
    );
    assert(
      contextDeployments.every(
        (deployment) =>
          deployment.context === context.context &&
          deployment.service === context.service &&
          deployment.environment === context.environment,
      ),
      "DEPLOYMENT_CONTEXT_IDENTITY_INVALID",
    );
    for (const commit of registry.failedSourceCommits) {
      const failures = contextDeployments.filter(
        (deployment) => deployment.sourceCommit === commit && deployment.state === "FAILED",
      );
      assert(failures.length === 1, "DEPLOYMENT_FAILED_SEQUENCE_INCOMPLETE");
      const [failure] = failures;
      assert(failure.failureStage === "dependency_install", "DEPLOYMENT_FAILURE_STAGE_INVALID");
      assert(
        failure.failureClassification === "package_manager_lockfile_mismatch",
        "DEPLOYMENT_ROOT_CAUSE_INVALID",
      );
    }
    const current = contextDeployments.filter(
      (deployment) =>
        deployment.sourceCommit === registry.currentSourceCommit &&
        deployment.state === "SUCCESS" &&
        deployment.instanceState === "RUNNING" &&
        deployment.packageManager === "npm",
    );
    assert(current.length === 1, "DEPLOYMENT_CURRENT_RUNTIME_INVALID");
    const historicalRollback = contextDeployments.filter(
      (deployment) =>
        deployment.sourceCommit === registry.historicalSuccessfulCommit &&
        deployment.state === "REMOVED" &&
        deployment.originalResult === "SUCCESS",
    );
    assert(historicalRollback.length === 1, "DEPLOYMENT_ROLLBACK_HISTORY_INVALID");
  }

  for (const deployment of registry.deployments) {
    assert(SHA.test(deployment.sourceCommit), "DEPLOYMENT_SHA_INVALID");
    assert(deployment.sourceBranch === "main", "DEPLOYMENT_SOURCE_BRANCH_INVALID");
    assert(deployment.buildCommand === "npm run build:railway", "DEPLOYMENT_BUILD_COMMAND_INVALID");
    assert(deployment.startCommand === "npm run start:railway", "DEPLOYMENT_START_COMMAND_INVALID");
    assert(deployment.healthPath === "/api/health", "DEPLOYMENT_HEALTH_PATH_INVALID");
    assert(EVIDENCE_CLASSES.has(deployment.evidenceClass), "DEPLOYMENT_EVIDENCE_CLASS_INVALID");
  }
  assert(
    registry.governance?.lastPlatformChange?.deploymentCreated === false,
    "RAILWAY_REDEPLOY_FORBIDDEN",
  );
  assert(
    registry.rollback?.availability === "historical_removed_rebuild_required",
    "DEPLOYMENT_ROLLBACK_AVAILABILITY_INVALID",
  );

  assert(
    handoff.$schema === "https://json-schema.org/draft/2020-12/schema",
    "HANDOFF_SCHEMA_DRAFT_INVALID",
  );
  assert(handoff.properties.repository.const === EXPECTED_REPOSITORY, "HANDOFF_REPOSITORY_INVALID");
  assert(handoff.required.includes("platformWrites"), "HANDOFF_PLATFORM_WRITES_REQUIRED");
  assert(handoff.required.includes("finalStatus"), "HANDOFF_FINAL_STATUS_REQUIRED");

  return {
    status: "program_state_valid",
    repository: current.authority.repository,
    main: current.authority.observedMainSha,
    railwayContexts: registry.expectedContexts.length,
    failedDeployments: registry.expectedContexts.length * registry.failedSourceCommits.length,
    deploymentWrites: 0,
    governanceWrites: 1,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(validateProgramState()));
}
