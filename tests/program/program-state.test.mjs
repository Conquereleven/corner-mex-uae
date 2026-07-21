import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateProgramState } from "../../scripts/program/validate-program-state.mjs";

const FROZEN_NOW = new Date("2026-07-21T18:56:00Z");
const FIXTURE_FILES = [
  "CURRENT_STATE.json",
  "DEPLOYMENT_REGISTRY.json",
  "AGENT_HANDOFF_SCHEMA.json",
];

const withFixture = (mutate, assertion) => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "cornermex-program-state-"));
  const fixtureDir = path.join(baseDir, "docs/program");
  fs.mkdirSync(fixtureDir, { recursive: true });
  for (const file of FIXTURE_FILES) {
    fs.copyFileSync(path.join("docs/program", file), path.join(fixtureDir, file));
  }
  const read = (file) => JSON.parse(fs.readFileSync(path.join(fixtureDir, file), "utf8"));
  const write = (file, value) =>
    fs.writeFileSync(path.join(fixtureDir, file), `${JSON.stringify(value, null, 2)}\n`);
  try {
    mutate({ read, write });
    assertion(() => validateProgramState({ baseDir, now: FROZEN_NOW }));
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
};

test("durable program state is internally consistent and fail-closed", () => {
  const result = validateProgramState({ now: FROZEN_NOW });
  assert.equal(result.status, "program_state_valid");
  assert.equal(result.railwayContexts, 2);
  assert.equal(result.failedDeployments, 4);
  assert.equal(result.deploymentWrites, 0);
  assert.equal(result.governanceWrites, 1);
});

const cases = [
  [
    "wrong main SHA",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.authority.observedMainSha = "f".repeat(40);
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_MAIN_DRIFT/,
  ],
  [
    "malformed main SHA",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.authority.expectedMainSha = "not-a-sha";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_EXPECTED_SHA_INVALID/,
  ],
  [
    "wrong canonical Supabase ref",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.platforms.supabase.projectRef = "foreignprojectref1234";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_SUPABASE_IDENTITY_INVALID/,
  ],
  [
    "wrong Railway project",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.platforms.railway.projectId = "wlrfknmrhowldygmvtvn";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_RAILWAY_IDENTITY_INVALID/,
  ],
  [
    "missing evidence",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      delete current.evidence;
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_EVIDENCE_REQUIRED/,
  ],
  [
    "invalid evidence class",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.evidence.class = "trusted_because_chat_said_so";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_EVIDENCE_CLASS_INVALID/,
  ],
  [
    "stale freshUntil",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.evidence.freshUntil = "2026-07-21T18:55:30Z";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_STATE_EVIDENCE_STALE/,
  ],
  [
    "invalid timestamp",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.evidence.observedAt = "2026-99-99";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_OBSERVED_AT_INVALID/,
  ],
  [
    "freshUntil before observedAt",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.evidence.freshUntil = "2026-07-18T19:26:37Z";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_FRESHNESS_WINDOW_INVALID/,
  ],
  [
    "contradictory readiness",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.readiness.declaredReady = true;
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_READINESS_CONTRADICTS_EVIDENCE/,
  ],
  [
    "DB1 and DB2 swapped",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      [current.platforms.databases[0].projectRef, current.platforms.databases[1].projectRef] = [
        current.platforms.databases[1].projectRef,
        current.platforms.databases[0].projectRef,
      ];
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_DATABASE_IDENTITY_INVALID/,
  ],
  [
    "DB2 and DB3 swapped",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      [current.platforms.databases[1].projectRef, current.platforms.databases[2].projectRef] = [
        current.platforms.databases[2].projectRef,
        current.platforms.databases[1].projectRef,
      ];
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_DATABASE_IDENTITY_INVALID/,
  ],
  [
    "truncated deployment history",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      registry.deployments.pop();
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /DEPLOYMENT_HISTORY_INCOMPLETE/,
  ],
  [
    "unknown database role",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.platforms.databases[2].role = "DB4_UNKNOWN";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_DATABASE_ROLE_UNKNOWN/,
  ],
  [
    "deployment created by governance change",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      registry.governance.lastPlatformChange.deploymentCreated = true;
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /RAILWAY_REDEPLOY_FORBIDDEN/,
  ],
  [
    "duplicate database role",
    ({ read, write }) => {
      const current = read("CURRENT_STATE.json");
      current.platforms.databases[2].role = "DB2_CANONICAL";
      write("CURRENT_STATE.json", current);
    },
    /PROGRAM_DATABASE_ROLE_DUPLICATE/,
  ],
  [
    "current source commit drifts from observed main",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      registry.currentSourceCommit = "f".repeat(40);
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /DEPLOYMENT_CURRENT_SOURCE_DRIFT/,
  ],
  [
    "current running deployment missing for a context",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      const stagingSha = registry.governance.contexts.find(
        (c) => c.environment === "staging",
      ).currentSourceSha;
      const currentDeployment = registry.deployments.find(
        (d) => d.sourceCommit === stagingSha && d.environment === "staging",
      );
      currentDeployment.instanceState = "CRASHED";
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /DEPLOYMENT_CURRENT_RUNTIME_INVALID/,
  ],
  [
    "historical rollback entry missing for a context",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      const rollbackDeployment = registry.deployments.find(
        (d) =>
          d.sourceCommit === registry.historicalSuccessfulCommit && d.environment === "production",
      );
      rollbackDeployment.state = "SUCCESS";
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /DEPLOYMENT_ROLLBACK_HISTORY_INVALID/,
  ],
  [
    "rollback availability falsely claimed as immediately usable",
    ({ read, write }) => {
      const registry = read("DEPLOYMENT_REGISTRY.json");
      registry.rollback.availability = "immediately_redeployable";
      write("DEPLOYMENT_REGISTRY.json", registry);
    },
    /DEPLOYMENT_ROLLBACK_AVAILABILITY_INVALID/,
  ],
];

for (const [name, mutate, expected] of cases) {
  test(`program state rejects ${name}`, () => {
    withFixture(mutate, (validate) => {
      assert.throws(validate, expected);
    });
  });
}
