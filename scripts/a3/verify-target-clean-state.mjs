import { assert, readJson } from "./lib.mjs";

export async function verifyTargetCleanState() {
  const state = await readJson("contracts/cornermex-target-clean-state-a3.json");
  assert(state.projectRef === "wlrfknmrhowldygmvtvn", "target project mismatch");
  assert(state.publicTables === 20 && state.rlsTables === 20, "target table/RLS drift");
  assert(state.policies === 37, "target policy drift");
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
    assert(state[field] === 0, `target is not clean: ${field}`);
  }
  assert(
    state.containsSecrets === false && state.containsPii === false,
    "target evidence is unsafe",
  );
  return { status: "a3_target_clean", schemaFingerprint: state.schemaFingerprint };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await verifyTargetCleanState()));
}
