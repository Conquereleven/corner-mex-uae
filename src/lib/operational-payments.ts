export type ProviderMode = "test" | "live";
export function providerMode(value: unknown): ProviderMode | null {
  return value === "test" || value === "live" ? value : null;
}
export function stripeKeyMatchesMode(key: string | undefined, mode: ProviderMode | null) {
  return Boolean(mode && key?.startsWith(`sk_${mode}_`) && key.length > 12);
}
export type RuntimeGate = {
  mode: ProviderMode;
  enabled: boolean;
  generation: string;
  validUntil: string;
  eligibleAfter: string;
};
export function cardCapability(input: {
  schemaVersion?: number;
  gate?: RuntimeGate;
  mode: ProviderMode | null;
  secretMatches: boolean;
  webhookConfigured: boolean;
  enabled: boolean;
  now: number;
}) {
  const g = input.gate;
  return (
    input.schemaVersion === 2 &&
    input.enabled &&
    input.secretMatches &&
    input.webhookConfigured &&
    g?.enabled === true &&
    g.mode === input.mode &&
    Boolean(g.generation) &&
    Number.isFinite(Date.parse(g.validUntil)) &&
    Date.parse(g.validUntil) > input.now
  );
}
export function cumulativeRefund(captured: number, previous: number, incoming: number) {
  if (
    ![captured, previous, incoming].every(Number.isSafeInteger) ||
    captured <= 0 ||
    previous < 0 ||
    incoming < 0 ||
    previous > captured ||
    incoming > captured
  )
    throw new Error("REFUND_AMOUNT_INVALID");
  const refunded = Math.max(previous, incoming);
  return {
    refunded,
    kind: refunded === captured ? "full" : refunded > 0 ? "partial" : "none",
  } as const;
}
export function attemptAnomalies(
  attempts: Array<{ mode: string | null; captured: number; refunded: number }>,
  mode: ProviderMode,
) {
  const issues: string[] = [];
  if (attempts.some((a) => a.mode !== mode)) issues.push("provider_mode_mismatch");
  if (attempts.filter((a) => a.captured > 0).length > 1)
    issues.push("multiple_successful_attempts");
  if (attempts.some((a) => a.refunded < 0 || a.refunded > a.captured))
    issues.push("refund_amount_drift");
  return issues;
}
