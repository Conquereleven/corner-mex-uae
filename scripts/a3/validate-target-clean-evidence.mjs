import { assert, readJson } from "./lib.mjs";

export async function validateTargetCleanEvidence(state) {
  state ??= await readJson("contracts/cornermex-target-clean-state-a3.json");
  assert(state.projectRef === "wlrfknmrhowldygmvtvn", "target project mismatch");
  assert(state.publicTables === 20 && state.rlsTables === 20, "target table/RLS drift");
  assert(state.policies === 37, "target policy drift");
  assert(typeof state.observedAt === "string", "missing evidence timestamp");
  assert(typeof state.evidenceValidUntil === "string", "missing evidence expiry");
  assert(typeof state.schemaFingerprint === "string", "missing schema fingerprint");
  for (const field of [
    "authUsers",
    "storageBuckets",
    "storageObjects",
    "products",
    "inventory",
    "orders",
    "payments",
    "reviews",
    "rehearsalSchemas",
    "securityAdvisorFindings",
  ]) {
    assert(state[field] === 0, `target evidence is not clean: ${field}`);
  }
  assert(
    state.containsSecrets === false && state.containsPii === false,
    "target evidence is unsafe",
  );
  return {
    status: "a3_committed_target_clean_evidence_valid",
    projectRef: state.projectRef,
    observedAt: state.observedAt,
    evidenceValidUntil: state.evidenceValidUntil,
    schemaFingerprint: state.schemaFingerprint,
    liveQueryPerformed: false,
    message: "Committed clean-state evidence validated. No live Supabase query was performed.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateTargetCleanEvidence()));
}
