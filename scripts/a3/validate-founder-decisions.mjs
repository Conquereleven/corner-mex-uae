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

  const railway = contract.decisions.find(({ id }) => id === "railway_production_environment");
  assert(railway.decision === "yes", "RAILWAY_PRODUCTION_DECISION_NOT_APPROVED");
  assert(
    railway.status === "approved_for_a3_2b_execution_only",
    "RAILWAY_PRODUCTION_DECISION_SCOPE_INVALID",
  );
  assert(railway.scope === "railway_production_environment", "RAILWAY_DECISION_SCOPE_INVALID");
  assert(railway.decidedBy === "Joel / Founder", "RAILWAY_DECIDED_BY_INVALID");
  assert(Number.isFinite(Date.parse(railway.decidedAt)), "RAILWAY_DECIDED_AT_INVALID");
  assert(railway.executionPhase === "a3.2b", "RAILWAY_EXECUTION_PHASE_INVALID");
  assert(railway.executionOccurred === false, "RAILWAY_EXECUTION_MUST_REMAIN_FALSE");
  assert(railway.conditions.length === 10, "RAILWAY_DECISION_CONDITIONS_INCOMPLETE");
  assert(railway.prohibitions.length === 9, "RAILWAY_DECISION_PROHIBITIONS_INCOMPLETE");

  const lovable = contract.decisions.find(({ id }) => id === "lovable_rollback_window");
  assert(lovable.decision === "yes", "LOVABLE_ROLLBACK_DECISION_NOT_APPROVED");
  assert(
    lovable.status === "approved_14_day_post_cutover_rollback_window",
    "LOVABLE_ROLLBACK_DECISION_SCOPE_INVALID",
  );
  assert(lovable.scope === "lovable_commercial_rollback_anchor", "LOVABLE_SCOPE_INVALID");
  assert(lovable.decidedBy === "Joel / Founder", "LOVABLE_DECIDED_BY_INVALID");
  assert(Number.isFinite(Date.parse(lovable.decidedAt)), "LOVABLE_DECIDED_AT_INVALID");
  assert(lovable.executionPhase === "post_a3_2b_cutover", "LOVABLE_PHASE_INVALID");
  assert(lovable.executionOccurred === false, "LOVABLE_EXECUTION_MUST_REMAIN_FALSE");
  assert(lovable.cutoverExecuted === false, "LOVABLE_CUTOVER_MUST_REMAIN_FALSE");
  assert(lovable.rollbackWindowDays === 14, "LOVABLE_ROLLBACK_WINDOW_MUST_BE_14_DAYS");
  assert(lovable.rollbackWindowStarted === false, "LOVABLE_ROLLBACK_WINDOW_NOT_STARTED");
  assert(lovable.lovableRetired === false, "LOVABLE_MUST_NOT_BE_RETIRED");
  assert(lovable.conditions.length === 5, "LOVABLE_DECISION_CONDITIONS_INCOMPLETE");
  assert(lovable.prohibitions.length === 5, "LOVABLE_DECISION_PROHIBITIONS_INCOMPLETE");

  const unanswered = contract.decisions
    .filter(({ decision }) => decision === "unanswered")
    .map(({ id }) => id);
  return {
    status: unanswered.length
      ? "a3_2a_founder_decisions_pending"
      : "a3_2a_founder_decisions_complete",
    readyForA3_2bReview: unanswered.length === 0,
    approved: contract.decisions.filter(({ decision }) => decision === "yes").map(({ id }) => id),
    unanswered,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateFounderDecisions()));
}
