import { assert, readJson } from "./lib.mjs";

export const REQUIRED_FOUNDER_DECISIONS = Object.freeze([
  "railway_production_environment",
  "lovable_rollback_window",
  "custom_domain_dns_timing",
  "auth_bootstrap_timing",
  "storage_bucket_creation",
  "first_catalog_batch",
  "physical_inventory_verification",
  "checkout_activation",
  "payment_provider_activation",
  "email_provider_activation",
  "customer_communication",
  "rollback_owner",
  "observation_window",
]);

export async function validateFounderDecisions(contract) {
  contract ??= await readJson("contracts/cornermex-founder-decisions-v1.json");
  assert(
    contract.contractVersion === "cornermex-founder-decisions-v1",
    "FOUNDER_CONTRACT_MISMATCH",
  );
  const ids = contract.decisions.map(({ id }) => id);
  assert(new Set(ids).size === ids.length, "DUPLICATE_FOUNDER_DECISION");
  for (const id of REQUIRED_FOUNDER_DECISIONS)
    assert(ids.includes(id), `MISSING_FOUNDER_DECISION_${id}`);
  assert(
    ids.every((id) => REQUIRED_FOUNDER_DECISIONS.includes(id)),
    "UNEXPECTED_FOUNDER_DECISION",
  );
  for (const decision of contract.decisions) {
    assert(decision.owner === "founder", `FOUNDER_DECISION_OWNER_MISSING_${decision.id}`);
    assert(
      ["unanswered", "yes", "no"].includes(decision.decision),
      `FOUNDER_DECISION_INVALID_${decision.id}`,
    );
    assert(decision.required === true, `FOUNDER_DECISION_REQUIRED_INVALID_${decision.id}`);
  }
  const unanswered = contract.decisions
    .filter(({ decision }) => decision === "unanswered")
    .map(({ id }) => id);
  return {
    status: unanswered.length
      ? "a3_2a_founder_decisions_pending"
      : "a3_2a_founder_decisions_complete",
    readyForA3_2bReview: unanswered.length === 0,
    unanswered,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateFounderDecisions()));
}
