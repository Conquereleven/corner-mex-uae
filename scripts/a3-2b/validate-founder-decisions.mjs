import fs from "node:fs";
const c = JSON.parse(fs.readFileSync("contracts/cornermex-a3-2b-founder-decisions-v1.json"));
const expected = {
  dnsDomainTiming: "deferred_not_authorized_in_a3_2b",
  authBootstrap: "approved_founder_admin_only",
  storageCreation: "approved_catalog_infrastructure_and_controlled_media_ingestion",
  firstCatalogBatch: "approved_internal_draft_catalog",
  physicalInventory: "zero_until_physically_verified",
  checkout: "deferred_disabled",
  payments: "deferred_disabled",
  email: "deferred_disabled",
  customerCommunication: "not_authorized",
  rollbackOwner: "Joel / Founder",
  observationWindow: "48_hours",
};
export function validateFounderDecisions(contract = c) {
  if (contract.contractVersion !== "cornermex-a3-2b-founder-decisions-v1")
    throw new Error("A3_2B_DECISIONS_VERSION_MISMATCH");
  for (const [k, v] of Object.entries(expected))
    if (contract.decisions?.[k] !== v) throw new Error(`A3_2B_DECISION_INVALID_${k}`);
  if (Object.keys(contract.decisions).length !== Object.keys(expected).length)
    throw new Error("A3_2B_DECISIONS_NOT_CLOSED");
  return {
    status: "a3_2b_founder_decisions_resolved",
    resolved: Object.keys(expected).length,
    unanswered: [],
  };
}
if (import.meta.url === `file://${process.argv[1]}`)
  console.log(JSON.stringify(validateFounderDecisions()));
