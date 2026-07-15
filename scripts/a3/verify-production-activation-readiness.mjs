import { pathToFileURL } from "node:url";
import { readJson, stableStringify } from "./lib.mjs";
import { validateProductionActivationReadiness } from "./validate-production-activation-readiness.mjs";

const REDACTED_FIELDS = /(?:token|secret|password|credential|key|databaseUrl)/i;

function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !REDACTED_FIELDS.test(key))
        .map(([key, entry]) => [key, sanitized(entry)]),
    );
  }
  return value;
}

function assertLiveMatchesContract(live, contract) {
  const expected = {
    canonicalProjectRef: contract.canonicalProjectRef,
    railwayProjectId: contract.railwayProjectId,
    railwayEnvironment: contract.railwayEnvironment,
    railwayService: contract.railwayService,
    database: contract.database,
    auth: contract.auth,
    storage: contract.storage,
    railway: contract.railway,
  };
  if (stableStringify(sanitized(live)) !== stableStringify(sanitized(expected))) {
    throw new Error("LIVE_EVIDENCE_CONTRADICTS_COMMITTED_CONTRACT");
  }
}

export async function verifyProductionActivationReadiness({
  env = process.env,
  now = new Date(),
  liveCollector,
} = {}) {
  const contract = await readJson("contracts/cornermex-production-activation-readiness-v1.json");
  const validation = await validateProductionActivationReadiness(contract, { now });
  const liveMode = env.A3_LIVE_READ_ONLY === "true";
  if (!liveMode) {
    return {
      mode: "static",
      status: validation.status,
      checkedAt: now.toISOString(),
      liveQueryPerformed: false,
      message:
        "Committed activation-readiness evidence validated. No live platform query was performed.",
      ...validation,
    };
  }

  if (!liveCollector) {
    const modulePath = env.A3_LIVE_READ_ONLY_ADAPTER_MODULE;
    if (!modulePath) throw new Error("LIVE_READ_ONLY_ADAPTER_REQUIRED");
    const module = await import(pathToFileURL(modulePath).href);
    liveCollector = module.collectReadOnlyEvidence;
  }
  if (typeof liveCollector !== "function") throw new Error("LIVE_READ_ONLY_ADAPTER_INVALID");
  const live = await liveCollector();
  assertLiveMatchesContract(live, contract);
  return {
    mode: "live_read_only",
    status: validation.status,
    checkedAt: now.toISOString(),
    liveQueryPerformed: true,
    checksPerformed: contract.checksPerformed,
    checksNotPerformed: contract.checksNotPerformed,
    ...validation,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(await verifyProductionActivationReadiness()));
  } catch (error) {
    console.error(
      JSON.stringify({ status: "a3_2a_activation_readiness_failed", error: error.message }),
    );
    process.exit(1);
  }
}
