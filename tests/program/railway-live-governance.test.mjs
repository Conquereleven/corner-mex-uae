import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkRailwayLiveGovernance,
  LIVE_GOVERNANCE_STATES,
} from "../../scripts/program/check-railway-live-governance.mjs";
import { createRailwayLiveContextFetcher } from "../../scripts/program/railway-live-client.mjs";

const PROJECT_ID = "06d2ecdd-3c03-4480-8299-48c539595a94";
const STAGING_SHA = "a".repeat(40);

const buildRegistry = () => ({
  schemaVersion: "cornermex-deployment-registry-v2",
  repository: "Conquereleven/corner-mex-uae",
  railwayProjectId: PROJECT_ID,
  currentSourceCommit: STAGING_SHA,
  expectedContexts: [
    {
      context: "CornerMex UAE - cornermex-web",
      service: "cornermex-web",
      serviceId: "5a6b85da-3156-4fc1-828d-ec9e4019de7e",
      environment: "staging",
      environmentId: "385b8cb8-878b-4d83-ad46-2bc831fed829",
    },
    {
      context: "CornerMex UAE - corner-mex-uae",
      service: "corner-mex-uae",
      serviceId: "6702af28-5689-46fb-8896-b5a8b1fbba94",
      environment: "production",
      environmentId: "8f35b59c-7446-4514-a307-0b329ec62bd1",
    },
  ],
  governance: {
    model: "automatic_staging_manual_production",
    contexts: [
      {
        environment: "staging",
        connectedRepository: "Conquereleven/corner-mex-uae",
        watchedBranch: "main",
        autoDeploy: true,
        currentSourceSha: STAGING_SHA,
      },
      {
        environment: "production",
        connectedRepository: "Conquereleven/corner-mex-uae",
        watchedBranch: "main",
        autoDeploy: false,
        currentSourceSha: STAGING_SHA,
      },
    ],
  },
});

const withRegistry = async (mutateRegistry, liveByEnvironment, assertion) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-live-governance-"));
  const fixtureDir = path.join(baseDir, "docs/program");
  fs.mkdirSync(fixtureDir, { recursive: true });
  const registry = buildRegistry();
  mutateRegistry?.(registry);
  fs.writeFileSync(
    path.join(fixtureDir, "DEPLOYMENT_REGISTRY.json"),
    `${JSON.stringify(registry, null, 2)}\n`,
  );
  const fetchLiveContext = async ({ environment }) => {
    const live = liveByEnvironment[environment];
    if (live instanceof Error) throw live;
    if (typeof live === "function") return live();
    return live;
  };
  try {
    await assertion(
      () => checkRailwayLiveGovernance({ baseDir, fetchLiveContext, hasCredentials: () => true }),
      (options = {}) =>
        checkRailwayLiveGovernance({
          baseDir,
          fetchLiveContext,
          hasCredentials: () => true,
          ...options,
        }),
    );
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
};

const liveFor = (environment, overrides = {}) => {
  const base = {
    staging: {
      projectId: PROJECT_ID,
      environmentId: "385b8cb8-878b-4d83-ad46-2bc831fed829",
      serviceId: "5a6b85da-3156-4fc1-828d-ec9e4019de7e",
      environmentName: "staging",
      connectedRepository: "Conquereleven/corner-mex-uae",
      watchedBranch: "main",
      autoDeploy: true,
      waitForCi: false,
      currentDeploymentId: "deploy-staging-1",
      currentSourceSha: STAGING_SHA,
      deploymentStatus: "SUCCESS",
      instanceStatus: "RUNNING",
    },
    production: {
      projectId: PROJECT_ID,
      environmentId: "8f35b59c-7446-4514-a307-0b329ec62bd1",
      serviceId: "6702af28-5689-46fb-8896-b5a8b1fbba94",
      environmentName: "production",
      connectedRepository: "Conquereleven/corner-mex-uae",
      watchedBranch: "main",
      autoDeploy: false,
      waitForCi: false,
      currentDeploymentId: "deploy-production-1",
      currentSourceSha: STAGING_SHA,
      deploymentStatus: "SUCCESS",
      instanceStatus: "RUNNING",
    },
  };
  return { ...base[environment], ...overrides };
};

test("verified when live Railway state matches the committed registry exactly", async () => {
  await withRegistry(
    null,
    { staging: liveFor("staging"), production: liveFor("production") },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.VERIFIED);
      assert.equal(
        result.contexts.every((c) => c.status === LIVE_GOVERNANCE_STATES.VERIFIED),
        true,
      );
    },
  );
});

test("detects production auto-deploy unexpectedly active live", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging"),
      production: liveFor("production", { autoDeploy: true }),
    },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.DRIFT);
      const production = result.contexts.find((c) => c.environment === "production");
      assert.equal(production.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(production.drift.includes("auto_deploy_mismatch"));
      assert.ok(production.drift.includes("production_autodeploy_or_push_trigger_forbidden"));
    },
  );
});

test("detects a push/merge-shaped production trigger even if autoDeploy reports false", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging"),
      production: liveFor("production", { triggerHint: "github_push_main" }),
    },
    async (run) => {
      const result = await run();
      const production = result.contexts.find((c) => c.environment === "production");
      assert.equal(production.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(production.drift.includes("production_autodeploy_or_push_trigger_forbidden"));
    },
  );
});

test("detects incorrect connected repository identity", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging", { connectedRepository: "someone-else/corner-mex-uae-fork" }),
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(staging.drift.includes("connected_repository_mismatch"));
    },
  );
});

test("detects a watched branch different from main", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging", { watchedBranch: "staging-experiment" }),
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(staging.drift.includes("watched_branch_mismatch"));
    },
  );
});

test("reports malformed on a Railway response missing required fields", async () => {
  await withRegistry(
    null,
    {
      staging: { environmentName: "staging" }, // most fields missing
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.MALFORMED);
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.MALFORMED);
    },
  );
});

test("reports malformed on an incomplete Railway response (missing autoDeploy)", async () => {
  await withRegistry(
    null,
    {
      staging: (() => {
        const { autoDeploy, ...rest } = liveFor("staging");
        return rest;
      })(),
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.MALFORMED);
      assert.match(staging.reason, /missing_autoDeploy/);
    },
  );
});

test("reports malformed on an unrecognized (non-object) Railway response shape", async () => {
  await withRegistry(
    null,
    {
      staging: "not-an-object",
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.MALFORMED);
    },
  );
});

test("reports probe_unavailable when the Railway API call fails, never treats it as green", async () => {
  await withRegistry(
    null,
    {
      staging: new Error("RAILWAY_API_HTTP_503"),
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.PROBE_UNAVAILABLE);
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.PROBE_UNAVAILABLE);
      assert.match(staging.reason, /RAILWAY_API_HTTP_503/);
    },
  );
});

test("reports credentials_missing when no dedicated credential is available, and does not run any probe", async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-live-governance-"));
  fs.mkdirSync(path.join(baseDir, "docs/program"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "docs/program/DEPLOYMENT_REGISTRY.json"),
    JSON.stringify(buildRegistry()),
  );
  let probeCalled = false;
  const result = await checkRailwayLiveGovernance({
    baseDir,
    fetchLiveContext: async () => {
      probeCalled = true;
      return liveFor("staging");
    },
    hasCredentials: () => false,
  });
  fs.rmSync(baseDir, { recursive: true, force: true });
  assert.equal(result.status, LIVE_GOVERNANCE_STATES.CREDENTIALS_MISSING);
  assert.equal(result.reason, "dedicated_railway_viewer_credential_required");
  assert.equal(probeCalled, false, "must not call the live probe without credentials");
});

test("detects staging and production identities swapped", async () => {
  await withRegistry(
    null,
    {
      // staging context probed, but the live response describes the production service/env
      staging: liveFor("production"),
      production: liveFor("staging"),
    },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.DRIFT);
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(staging.drift.includes("environment_id_mismatch"));
      assert.ok(staging.drift.includes("service_id_mismatch"));
      assert.ok(staging.drift.includes("environment_name_mismatch"));
    },
  );
});

test("detects a live SHA different from the registry's declared state", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging", { currentSourceSha: "b".repeat(40) }),
      production: liveFor("production"),
    },
    async (run) => {
      const result = await run();
      const staging = result.contexts.find((c) => c.environment === "staging");
      assert.equal(staging.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(staging.drift.includes("current_source_sha_drift"));
    },
  );
});

test("detects an unexpected production deployment (new deployment id and SHA not reconciled in the registry)", async () => {
  await withRegistry(
    null,
    {
      staging: liveFor("staging"),
      production: liveFor("production", {
        currentDeploymentId: "unexpected-deploy-id",
        currentSourceSha: "c".repeat(40),
      }),
    },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.DRIFT);
      const production = result.contexts.find((c) => c.environment === "production");
      assert.equal(production.status, LIVE_GOVERNANCE_STATES.DRIFT);
      assert.ok(production.drift.includes("current_source_sha_drift"));
    },
  );
});

test("reports malformed when the registry itself has no governance contexts", async () => {
  await withRegistry(
    (registry) => {
      delete registry.governance;
    },
    { staging: liveFor("staging"), production: liveFor("production") },
    async (run) => {
      const result = await run();
      assert.equal(result.status, LIVE_GOVERNANCE_STATES.MALFORMED);
      assert.equal(result.reason, "registry_governance_contexts_missing");
    },
  );
});

test("never calls the live probe for credentials_missing and never returns VERIFIED without a probe function", async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-live-governance-"));
  fs.mkdirSync(path.join(baseDir, "docs/program"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "docs/program/DEPLOYMENT_REGISTRY.json"),
    JSON.stringify(buildRegistry()),
  );
  const result = await checkRailwayLiveGovernance({ baseDir, hasCredentials: () => true });
  fs.rmSync(baseDir, { recursive: true, force: true });
  assert.equal(result.status, LIVE_GOVERNANCE_STATES.CREDENTIALS_MISSING);
  assert.equal(result.reason, "no_live_probe_configured");
});

test("Route B reports monitoring_not_activated without invoking a probe", async () => {
  let called = false;
  const result = await checkRailwayLiveGovernance({
    monitoringEnabled: false,
    fetchLiveContext: async () => {
      called = true;
    },
    hasCredentials: () => true,
  });
  assert.equal(result.status, "railway_live_monitoring_not_activated");
  assert.equal(called, false);
});

test("Route B cannot claim verified from an injected comparator", async () => {
  await withRegistry(
    null,
    { staging: liveFor("staging"), production: liveFor("production") },
    async (_run, runRoute) => {
      const result = await runRoute({ allowLiveVerified: false });
      assert.notEqual(result.status, LIVE_GOVERNANCE_STATES.VERIFIED);
      assert.equal(result.reason, "railway_live_autodeploy_observation_not_supported");
    },
  );
});

test("Route B disables the unverified network client and schedule", () => {
  assert.throws(() => createRailwayLiveContextFetcher(), /OAUTH_PROJECT_VIEWER_TOKEN_REQUIRED/);
  assert.throws(
    () => createRailwayLiveContextFetcher({ token: "sanitized-test-token" }),
    /AUTODEPLOY_OBSERVATION_NOT_SUPPORTED/,
  );
  const workflow = fs.readFileSync(".github/workflows/railway-governance-drift.yml", "utf8");
  assert.doesNotMatch(workflow, /^\s*schedule:/m);
  assert.match(workflow, /RAILWAY_LIVE_MONITORING_ENABLED == 'true'/);
  assert.match(workflow, /RAILWAY_OAUTH_PROJECT_VIEWER_TOKEN/);
});
