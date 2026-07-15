import { assert, readJson } from "./lib.mjs";

export const EXPECTED_IDENTITIES = Object.freeze({
  projectRef: "wlrfknmrhowldygmvtvn",
  railwayProjectId: "06d2ecdd-3c03-4480-8299-48c539595a94",
  railwayEnvironment: "staging",
  railwayService: "cornermex-web",
  schemaFingerprint: "ffce61d5cca7d6e92699f72f4e593bb1",
});

const ZERO_FIELDS = ["products", "inventory", "orders", "payments", "reviews", "rehearsalSchemas"];
const BLOCKED_FLAGS = [
  "checkoutEnabled",
  "paymentsEnabled",
  "emailEnabled",
  "messagingEnabled",
  "automaticImportEnabled",
  "automaticInventorySyncEnabled",
  "openClawEnabled",
  "cornerOpsWritesEnabled",
  "productionActivated",
];

function parseTimestamp(value, field) {
  const timestamp = Date.parse(value);
  assert(Number.isFinite(timestamp), `${field.toUpperCase()}_INVALID`);
  return timestamp;
}

export async function validateProductionActivationReadiness(contract, options = {}) {
  contract ??= await readJson("contracts/cornermex-production-activation-readiness-v1.json");
  const now = options.now ?? new Date();
  assert(
    contract.contractVersion === "cornermex-production-activation-readiness-v1",
    "READINESS_CONTRACT_VERSION_MISMATCH",
  );
  assert(contract.sprint === "a3.2a", "READINESS_SPRINT_MISMATCH");
  assert(contract.canonicalProjectRef === EXPECTED_IDENTITIES.projectRef, "PROJECT_REF_MISMATCH");
  assert(
    contract.railwayProjectId === EXPECTED_IDENTITIES.railwayProjectId,
    "RAILWAY_PROJECT_MISMATCH",
  );
  assert(
    contract.railwayEnvironment === EXPECTED_IDENTITIES.railwayEnvironment,
    "RAILWAY_ENVIRONMENT_MISMATCH",
  );
  assert(
    contract.railwayService === EXPECTED_IDENTITIES.railwayService,
    "RAILWAY_SERVICE_MISMATCH",
  );
  assert(/^[0-9a-f]{40}$/.test(contract.sourceCommit), "SOURCE_COMMIT_INVALID");

  const observedAt = parseTimestamp(contract.observedAt, "observedAt");
  const validUntil = parseTimestamp(contract.evidenceValidUntil, "evidenceValidUntil");
  assert(validUntil > observedAt, "EVIDENCE_WINDOW_INVALID");
  assert(now.getTime() <= validUntil, "ACTIVATION_EVIDENCE_EXPIRED");

  assert(contract.database.status === "ACTIVE_HEALTHY", "DATABASE_NOT_HEALTHY");
  assert(contract.database.publicTables === 20, "PUBLIC_TABLE_COUNT_MISMATCH");
  assert(contract.database.rlsTables === 20, "RLS_COVERAGE_INCOMPLETE");
  assert(contract.database.policies >= 37, "POLICY_COUNT_INCOMPLETE");
  assert(
    contract.database.schemaFingerprint === EXPECTED_IDENTITIES.schemaFingerprint,
    "SCHEMA_FINGERPRINT_MISMATCH",
  );
  assert(contract.database.securityAdvisorFindings === 0, "SECURITY_ADVISOR_FINDINGS_PRESENT");
  for (const field of ZERO_FIELDS) {
    assert(contract.database.zeroState[field] === 0, `NONZERO_${field.toUpperCase()}`);
  }
  assert(contract.auth.users === 0, "UNEXPECTED_AUTH_USERS");
  assert(contract.auth.bootstrapComplete === false, "AUTH_BOOTSTRAP_MUST_NOT_BE_COMPLETE");
  assert(contract.storage.buckets === 0, "UNEXPECTED_STORAGE_BUCKETS");
  assert(contract.storage.objects === 0, "UNEXPECTED_STORAGE_OBJECTS");
  assert(contract.storage.bootstrapComplete === false, "STORAGE_BOOTSTRAP_MUST_NOT_BE_COMPLETE");

  assert(contract.railway.status === "online", "RAILWAY_NOT_ONLINE");
  assert(
    contract.railway.sourceRepository === "Conquereleven/corner-mex-uae",
    "RAILWAY_REPO_MISMATCH",
  );
  for (const field of ["rootHttp", "healthHttp", "readinessHttp", "assetHttp"]) {
    assert(contract.railway[field] === 200, `RAILWAY_${field.toUpperCase()}_FAILED`);
  }
  assert(contract.railway.productionEnvironmentExists === false, "PRODUCTION_ENVIRONMENT_EXISTS");
  assert(contract.railway.duplicateServiceExists === false, "DUPLICATE_RAILWAY_SERVICE_EXISTS");
  for (const flag of BLOCKED_FLAGS) {
    assert(contract.runtimeFlags[flag] === false, `UNSAFE_FLAG_${flag.toUpperCase()}`);
  }
  assert(contract.callbacks.changed === false, "CALLBACKS_CHANGED");
  assert(contract.dns.changed === false, "DNS_CHANGED");
  assert(contract.rollback.anchor === "Lovable Cloud", "ROLLBACK_ANCHOR_MISSING");
  assert(Array.isArray(contract.blockers), "BLOCKERS_INVALID");
  assert(Array.isArray(contract.founderDecisions), "FOUNDER_DECISIONS_INVALID");

  const reviewReady =
    contract.blockers.length === 0 &&
    contract.rollback.executable === true &&
    contract.rollback.owner !== "unassigned" &&
    contract.checksNotPerformed.length === 0;
  assert(
    contract.readyForA3_2bReview === reviewReady,
    "DECLARED_A3_2B_READINESS_CONTRADICTS_EVIDENCE",
  );

  return {
    status: reviewReady ? "ready_for_a3_2b_review" : "a3_2a_valid_but_blocked",
    evidenceFresh: true,
    readyForA3_2bReview: reviewReady,
    blockers: contract.blockers,
    checksNotPerformed: contract.checksNotPerformed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateProductionActivationReadiness()));
}
