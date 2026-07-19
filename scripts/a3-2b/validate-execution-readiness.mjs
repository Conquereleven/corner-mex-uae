import fs from "node:fs";
import { validateFounderDecisions } from "./validate-founder-decisions.mjs";
export function validateReadiness(
  contract = JSON.parse(fs.readFileSync("contracts/cornermex-a3-2b-execution-readiness-v1.json")),
) {
  validateFounderDecisions();
  const expectedGates = [
    "stalePreviewProtection",
    "rollbackDbDryRun",
    "mediaContentValidation",
    "sourcePinRequired",
    "railwaySourceIntrospection",
    "freshLiveReadOnlyPreflight",
    "independentReviewOfRemediationHead",
  ];
  if (
    contract.contractVersion !== "cornermex-a3-2b-execution-readiness-v1" ||
    contract.canonicalProject !== "wlrfknmrhowldygmvtvn" ||
    contract.sourceCommit !== "a8a751bdbaf2b12fef3f94c83769bac52fffbaad" ||
    contract.reviewedRemediationHeadSha !== "33f2231443172b1956c5adf2b609a3e0bb02daab"
  )
    throw new Error("A3_2B_READINESS_IDENTITY_MISMATCH");
  if (
    JSON.stringify(Object.keys(contract.technicalGates).sort()) !==
    JSON.stringify(expectedGates.sort())
  )
    throw new Error("A3_2B_READINESS_GATE_SET_MISMATCH");
  if (Object.values(contract.technicalGates).some((value) => typeof value !== "boolean"))
    throw new Error("A3_2B_READINESS_GATE_TYPE_MISMATCH");
  const ready = Object.values(contract.technicalGates).every(Boolean);
  if (contract.declaredReady !== ready)
    throw new Error("A3_2B_DECLARED_READINESS_CONTRADICTS_EVIDENCE");
  return {
    status: ready ? "a3_2b_execution_ready" : "a3_2b_execution_blocked",
    ready,
    technicalGates: contract.technicalGates,
  };
}
if (import.meta.url === `file://${process.argv[1]}`)
  console.log(JSON.stringify(validateReadiness()));
