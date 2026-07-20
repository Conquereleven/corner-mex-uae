import fs from "node:fs";
import path from "node:path";

// This module must never contain a Railway write operation (deploy, redeploy, restart, down,
// GraphQL mutations, variable upserts). scripts/program/assert-no-railway-writes.mjs statically
// scans this file's own source text for forbidden patterns as part of CI.

const SHA = /^[0-9a-f]{40}$/;

export const LIVE_GOVERNANCE_STATES = Object.freeze({
  VERIFIED: "live_governance_verified",
  DRIFT: "live_governance_drift_detected",
  PROBE_UNAVAILABLE: "live_governance_probe_unavailable",
  MALFORMED: "live_governance_response_malformed",
  CREDENTIALS_MISSING: "live_governance_credentials_missing",
});

const REQUIRED_LIVE_STRING_FIELDS = Object.freeze([
  "projectId",
  "environmentId",
  "serviceId",
  "environmentName",
  "connectedRepository",
  "watchedBranch",
  "currentDeploymentId",
  "currentSourceSha",
  "deploymentStatus",
  "instanceStatus",
]);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validates the shape of a single live-probe result without trusting its field types.
 * Returns a list of shape errors; an empty list means the shape is acceptable.
 */
function shapeErrors(live) {
  if (!isPlainObject(live)) return ["response_not_an_object"];
  const errors = [];
  for (const field of REQUIRED_LIVE_STRING_FIELDS) {
    if (typeof live[field] !== "string" || live[field].length === 0) {
      errors.push(`missing_${field}`);
    }
  }
  if (typeof live.autoDeploy !== "boolean") errors.push("missing_autoDeploy");
  if (
    live.waitForCi !== undefined &&
    live.waitForCi !== null &&
    typeof live.waitForCi !== "boolean"
  ) {
    errors.push("invalid_waitForCi");
  }
  if (
    typeof live.currentSourceSha === "string" &&
    live.currentSourceSha &&
    !SHA.test(live.currentSourceSha)
  ) {
    errors.push("invalid_current_source_sha_format");
  }
  return errors;
}

const readRegistry = (baseDir) =>
  JSON.parse(
    fs.readFileSync(path.resolve(baseDir, "docs/program/DEPLOYMENT_REGISTRY.json"), "utf8"),
  );

/**
 * Compares one live-probed context against the committed registry's declared governance for
 * that same environment. Returns the list of drift reasons; an empty list means no drift.
 */
function driftReasons({ live, declared, expectedContext, railwayProjectId }) {
  const drift = [];
  if (live.projectId !== railwayProjectId) drift.push("project_id_mismatch");
  if (live.environmentId !== expectedContext.environmentId) drift.push("environment_id_mismatch");
  if (live.serviceId !== expectedContext.serviceId) drift.push("service_id_mismatch");
  if (live.environmentName !== expectedContext.environment) drift.push("environment_name_mismatch");
  if (live.connectedRepository !== declared.connectedRepository)
    drift.push("connected_repository_mismatch");
  if (live.watchedBranch !== declared.watchedBranch) drift.push("watched_branch_mismatch");
  if (live.autoDeploy !== declared.autoDeploy) drift.push("auto_deploy_mismatch");

  const liveTriggerLooksLikePushOrMerge =
    typeof live.triggerHint === "string" && /push|merge/i.test(live.triggerHint);
  if (
    expectedContext.environment === "production" &&
    (live.autoDeploy === true || liveTriggerLooksLikePushOrMerge)
  ) {
    drift.push("production_autodeploy_or_push_trigger_forbidden");
  }

  // The committed registry's declared currentSourceSha is the only reconciled source of truth
  // this guard trusts. A live SHA that differs from it is drift by definition: the registry is
  // only updated by a reviewed PR, so an unreconciled live difference means something changed
  // Railway's source outside of that reviewed process.
  if (live.currentSourceSha !== declared.currentSourceSha) drift.push("current_source_sha_drift");

  return drift;
}

/**
 * Read-only comparison of live Railway governance state against the committed deployment
 * registry. Never mutates Railway. `fetchLiveContext` is injected so this can be fully unit
 * tested without network access or credentials.
 */
export async function checkRailwayLiveGovernance({
  baseDir = process.cwd(),
  fetchLiveContext,
  hasCredentials = () => Boolean(process.env.RAILWAY_VIEWER_TOKEN),
} = {}) {
  if (!hasCredentials()) {
    return {
      status: LIVE_GOVERNANCE_STATES.CREDENTIALS_MISSING,
      reason: "dedicated_railway_viewer_credential_required",
      contexts: [],
    };
  }
  if (typeof fetchLiveContext !== "function") {
    return {
      status: LIVE_GOVERNANCE_STATES.CREDENTIALS_MISSING,
      reason: "no_live_probe_configured",
      contexts: [],
    };
  }

  let registry;
  try {
    registry = readRegistry(baseDir);
  } catch (error) {
    return {
      status: LIVE_GOVERNANCE_STATES.MALFORMED,
      reason: `registry_unreadable:${error?.message || "unknown"}`,
      contexts: [],
    };
  }

  const governance = registry?.governance;
  if (
    !governance ||
    !Array.isArray(governance.contexts) ||
    !Array.isArray(registry.expectedContexts)
  ) {
    return {
      status: LIVE_GOVERNANCE_STATES.MALFORMED,
      reason: "registry_governance_contexts_missing",
      contexts: [],
    };
  }
  if (typeof registry.railwayProjectId !== "string" || !registry.railwayProjectId) {
    return {
      status: LIVE_GOVERNANCE_STATES.MALFORMED,
      reason: "registry_railway_project_id_missing",
      contexts: [],
    };
  }

  const results = [];
  for (const expectedContext of registry.expectedContexts) {
    const declared = governance.contexts.find((c) => c.environment === expectedContext.environment);
    if (!declared) {
      results.push({
        environment: expectedContext.environment,
        status: LIVE_GOVERNANCE_STATES.MALFORMED,
        reason: "declared_governance_context_missing",
      });
      continue;
    }

    let live;
    try {
      live = await fetchLiveContext({
        projectId: registry.railwayProjectId,
        environmentId: expectedContext.environmentId,
        serviceId: expectedContext.serviceId,
        environment: expectedContext.environment,
      });
    } catch (error) {
      results.push({
        environment: expectedContext.environment,
        status: LIVE_GOVERNANCE_STATES.PROBE_UNAVAILABLE,
        reason: error?.message || "live_probe_failed",
      });
      continue;
    }

    const errors = shapeErrors(live);
    if (errors.length > 0) {
      results.push({
        environment: expectedContext.environment,
        status: LIVE_GOVERNANCE_STATES.MALFORMED,
        reason: errors.join(","),
      });
      continue;
    }

    const drift = driftReasons({
      live,
      declared,
      expectedContext,
      railwayProjectId: registry.railwayProjectId,
    });

    results.push({
      environment: expectedContext.environment,
      status: drift.length > 0 ? LIVE_GOVERNANCE_STATES.DRIFT : LIVE_GOVERNANCE_STATES.VERIFIED,
      drift,
      live: {
        projectId: live.projectId,
        environmentId: live.environmentId,
        serviceId: live.serviceId,
        environmentName: live.environmentName,
        connectedRepository: live.connectedRepository,
        watchedBranch: live.watchedBranch,
        autoDeploy: live.autoDeploy,
        waitForCi: live.waitForCi ?? null,
        currentDeploymentId: live.currentDeploymentId,
        currentSourceSha: live.currentSourceSha,
        deploymentStatus: live.deploymentStatus,
        instanceStatus: live.instanceStatus,
      },
    });
  }

  const statusPriority = [
    LIVE_GOVERNANCE_STATES.MALFORMED,
    LIVE_GOVERNANCE_STATES.PROBE_UNAVAILABLE,
    LIVE_GOVERNANCE_STATES.DRIFT,
  ];
  const overall =
    statusPriority.find((state) => results.some((r) => r.status === state)) ||
    LIVE_GOVERNANCE_STATES.VERIFIED;

  return { status: overall, contexts: results };
}
