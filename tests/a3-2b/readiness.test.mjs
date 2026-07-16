import test from "node:test";
import assert from "node:assert/strict";
import { validateFounderDecisions } from "../../scripts/a3-2b/validate-founder-decisions.mjs";
import { validateReadiness } from "../../scripts/a3-2b/validate-execution-readiness.mjs";
test("deferred decisions are resolved and 48h owner is required", () => {
  assert.deepEqual(validateFounderDecisions().unanswered, []);
  const bad = JSON.parse(
    JSON.stringify({
      contractVersion: "cornermex-a3-2b-founder-decisions-v1",
      decidedBy: "Joel / Founder",
      decidedAt: "2026-07-16T00:00:00Z",
      decisions: {
        dnsDomainTiming: "deferred_not_authorized_in_a3_2b",
        authBootstrap: "approved_founder_admin_only",
        storageCreation: "approved_catalog_infrastructure_and_controlled_media_ingestion",
        firstCatalogBatch: "approved_internal_draft_catalog",
        physicalInventory: "zero_until_physically_verified",
        checkout: "deferred_disabled",
        payments: "deferred_disabled",
        email: "deferred_disabled",
        customerCommunication: "not_authorized",
        rollbackOwner: "unassigned",
        observationWindow: "48_hours",
      },
    }),
  );
  assert.throws(() => validateFounderDecisions(bad), /rollbackOwner/);
});
test("resolved decisions never override incomplete technical gates", () => {
  const blocked = validateReadiness();
  assert.equal(blocked.ready, false);
  const c = {
    contractVersion: "cornermex-a3-2b-execution-readiness-v1",
    canonicalProject: "wlrfknmrhowldygmvtvn",
    sourceCommit: "a8a751bdbaf2b12fef3f94c83769bac52fffbaad",
    technicalGates: {
      stalePreviewProtection: true,
      rollbackDbDryRun: false,
      mediaContentValidation: true,
      sourcePinRequired: true,
      railwaySourceIntrospection: true,
      freshLiveReadOnlyPreflight: false,
      independentReviewOfRemediationHead: false,
    },
    declaredReady: true,
  };
  assert.throws(() => validateReadiness(c), /CONTRADICTS/);
});
test("readiness rejects an altered source identity or gate set", () => {
  const base = {
    contractVersion: "cornermex-a3-2b-execution-readiness-v1",
    canonicalProject: "wlrfknmrhowldygmvtvn",
    sourceCommit: "a8a751bdbaf2b12fef3f94c83769bac52fffbaad",
    technicalGates: {
      stalePreviewProtection: true,
      rollbackDbDryRun: false,
      mediaContentValidation: true,
      sourcePinRequired: true,
      railwaySourceIntrospection: true,
      freshLiveReadOnlyPreflight: false,
      independentReviewOfRemediationHead: false,
    },
    declaredReady: false,
  };
  const source = structuredClone(base);
  source.sourceCommit = "f".repeat(40);
  assert.throws(() => validateReadiness(source), /IDENTITY/);
  const extra = structuredClone(base);
  extra.technicalGates.manualOverride = true;
  assert.throws(() => validateReadiness(extra), /GATE_SET/);
});
