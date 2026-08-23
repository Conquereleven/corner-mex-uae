import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contractPath = "contracts/cm-mcp-5-controlled-activation-readiness-v1.json";
const runbookPath = "docs/mcp/CM-MCP-5-CONTROLLED-ACTIVATION-PLAN.md";

const read = (path) => readFile(path, "utf8");

test("CM-MCP-5 is repository planning with every production mutation false", async () => {
  const contract = JSON.parse(await read(contractPath));

  assert.equal(contract.contractVersion, "cm-mcp-5-controlled-activation-readiness-v1");
  assert.equal(contract.status, "planning_only");
  assert.equal(contract.changeBoundary.repositoryPlanningOnly, true);

  for (const [key, value] of Object.entries(contract.changeBoundary)) {
    if (key !== "repositoryPlanningOnly") {
      assert.equal(value, false, `${key} must remain false`);
    }
  }

  assert.equal(contract.governance.executionCommandsIncluded, false);
  assert.equal(contract.governance.railwayIsOutsideActivationPath, true);
});

test("CM-MCP-5 reconciles merged and ready prerequisites without treating them as authorization", async () => {
  const contract = JSON.parse(await read(contractPath));

  assert.equal(contract.baseline.mainSha, "14c8b58ccf05abb45659b3634158c5d0bff133f9");
  assert.deepEqual(
    contract.baseline.prerequisitePullRequests.map(({ number, headSha, state }) => ({
      number,
      headSha,
      state,
    })),
    [
      {
        number: 58,
        headSha: "ab102761df3b96c5c16f20fd7eddb209fde2017b",
        state: "merged",
      },
      {
        number: 59,
        headSha: "4de02a90e8603b68ba4428142ffdd82d62728fe8",
        state: "ready_unmerged",
      },
    ],
  );
  assert.equal(
    contract.baseline.prerequisitePullRequests[0].mergeCommit,
    "14c8b58ccf05abb45659b3634158c5d0bff133f9",
  );
});

test("CM-MCP-5 keeps each future production gate separately unauthorized", async () => {
  const contract = JSON.parse(await read(contractPath));
  const expectedGates = [
    "db2_apply",
    "db2_postflight",
    "oauth_enable",
    "oauth_client_register",
    "grant_provision",
    "edge_deploy",
    "remote_rehearsal",
  ];

  assert.deepEqual(
    contract.productionGates.map((gate) => gate.id),
    expectedGates,
  );

  for (const gate of contract.productionGates) {
    assert.equal(gate.executionStatus, "not_authorized", `${gate.id} must be unauthorized`);
    assert.equal(gate.requiresFounderAuthorization, true, `${gate.id} needs Founder approval`);
    assert.equal(gate.requiresExactArtifactIdentity, true, `${gate.id} needs exact identity`);
  }

  assert.equal(contract.governance.aggregateAuthorizationAllowed, false);
  assert.equal(contract.governance.authorizationCarriesAcrossHeadChanges, false);
  assert.equal(contract.governance.authorizationCarriesAcrossGates, false);
  assert.equal(contract.governance.failedGateStopsSequence, true);
});

test("CM-MCP-5 constrains the first rehearsal to the minimum read surface", async () => {
  const contract = JSON.parse(await read(contractPath));

  assert.equal(contract.firstRehearsalPosture.dynamicClientRegistration, "disabled");
  assert.deepEqual(contract.firstRehearsalPosture.initialPermissions, [
    "catalog:read",
    "inventory:read",
    "ops:read",
  ]);
  assert.deepEqual(contract.firstRehearsalPosture.browserOriginsInitiallyAllowed, []);
  assert.equal(contract.firstRehearsalPosture.serviceRoleCredentialAllowed, false);

  for (const permission of [
    "orders:read",
    "b2b:read",
    "orders:note",
    "orders:transition",
    "b2b:write",
  ]) {
    assert.ok(contract.firstRehearsalPosture.deferredPermissions.includes(permission));
  }
});

test("CM-MCP-5 runbook contains no executable activation command or secret value", async () => {
  const runbook = await read(runbookPath);

  for (const required of [
    "Readiness and planning only",
    "This document is not authorization",
    "Approval for one row never authorizes the next row",
    "No execution command, credential, client secret, user identifier, redirect URI, or live grant value",
    "Railway is outside the activation path",
  ]) {
    assert.ok(runbook.includes(required), `runbook must include: ${required}`);
  }

  for (const forbidden of [
    "supabase db push",
    "supabase migration up",
    "supabase functions deploy",
    "gh pr merge",
    "railway up",
  ]) {
    assert.equal(runbook.includes(forbidden), false, `runbook must not contain: ${forbidden}`);
  }
});
