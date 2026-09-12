/** Repository audit only. Deployment and credential presence are never runtime proof. */
export const GO_LIVE_BASELINE = "976676271ccca3c9f04c071a581ce6ab158c1b66";
export const GO_LIVE_AUDITED_AT = "2026-09-12";
export type ReadinessStatus =
  | "NOT CONFIGURED"
  | "BLOCKED"
  | "READY"
  | "ACTIVE"
  | "REQUIRES ATTENTION";

export const goLiveReadiness = [
  {
    id: "b2b-a",
    label: "B2B Foundation",
    status: "BLOCKED",
    reason:
      "Gate A migration absent from the audited production ledger; separate Founder authorization required.",
  },
  {
    id: "b2b-b",
    label: "B2B Portal",
    status: "BLOCKED",
    reason: "Gate A postflight must pass before a fresh Gate B authorization.",
  },
  {
    id: "b2b-c",
    label: "Pricing/Availability",
    status: "BLOCKED",
    reason: "Gate B postflight and membership smoke must pass before a fresh Gate C authorization.",
  },
  {
    id: "stripe-credentials",
    label: "Stripe Credentials",
    status: "NOT CONFIGURED",
    reason:
      "No validated test/live credential evidence recorded. Secret presence is not validation.",
  },
  {
    id: "stripe-webhook",
    label: "Stripe Webhook",
    status: "BLOCKED",
    reason:
      "Signed delivery, replay, mode separation and database mutation require isolated end-to-end evidence.",
  },
  {
    id: "stripe-migration",
    label: "Stripe Migration",
    status: "BLOCKED",
    reason: "Pending migration; productionApplied=false; separate Founder gate required.",
  },
  {
    id: "zoho-credentials",
    label: "Zoho Credentials",
    status: "NOT CONFIGURED",
    reason: "OAuth lifecycle, organization, region and VAT mapping remain unvalidated.",
  },
  {
    id: "zoho-migration",
    label: "Zoho Migration",
    status: "BLOCKED",
    reason: "Pending migration; separate Founder gate required.",
  },
  {
    id: "zoho-provider",
    label: "Zoho Provider",
    status: "NOT CONFIGURED",
    reason: "Books versus Invoice unconfirmed; repository activation is disabled.",
  },
  {
    id: "payment-reconciliation",
    label: "Payment Reconciliation",
    status: "BLOCKED",
    reason:
      "Per-order admin reader exists; no certified Stripe order. Storefront remains COD-only.",
  },
  {
    id: "invoice-reconciliation",
    label: "Invoice Reconciliation",
    status: "BLOCKED",
    reason:
      "Worker and mappings exist; pending-to-confirmed handoff and customer invoice visibility are missing.",
  },
  {
    id: "e2e",
    label: "E2E Certification",
    status: "BLOCKED",
    reason: "Local fixtures cannot certify provider execution or a controlled production order.",
  },
] satisfies Array<{ id: string; label: string; status: ReadinessStatus; reason: string }>;

export const operationalEvidenceRequirements = [
  "b2bAPostflight",
  "b2bBPostflight",
  "b2bCPostflight",
  "stripeMigration",
  "stripeCredentials",
  "stripeWebhook",
  "stripeTestPayment",
  "zohoMigration",
  "zohoCredentialsAndProvider",
  "invoiceReconciliation",
  "controlledOrder",
  "noCriticalFailures",
  "rollbackDocumented",
  "founderGoLiveApproval",
] as const;

type EvidenceKey = (typeof operationalEvidenceRequirements)[number];
export type OperationalEvidence = {
  projectRef: string;
  head: string;
  environment: "production";
  expiresAt: string;
  checks: Partial<Record<EvidenceKey, { passed: boolean; artifact: string }>>;
};

/** Checklist evaluation only: does not authenticate artifacts or grant activation authority. */
export function evaluateOperationalEvidence(
  evidence: OperationalEvidence | null,
  expectedHead: string,
  now: number,
) {
  const blockers: string[] = [];
  if (
    !evidence ||
    evidence.projectRef !== "wlrfknmrhowldygmvtvn" ||
    evidence.environment !== "production" ||
    !/^[a-f0-9]{40}$/.test(expectedHead) ||
    evidence.head !== expectedHead ||
    !Number.isFinite(Date.parse(evidence.expiresAt)) ||
    Date.parse(evidence.expiresAt) <= now
  )
    blockers.push("missing_or_stale_evidence_context");
  for (const key of operationalEvidenceRequirements) {
    const check = evidence?.checks[key];
    if (check?.passed !== true || !check.artifact?.trim()) blockers.push(key);
  }
  return { checklistComplete: blockers.length === 0, blockers };
}
