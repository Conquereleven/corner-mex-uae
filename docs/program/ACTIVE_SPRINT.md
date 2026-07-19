# Active Sprint: CornerMex P0 Production State Reconciliation

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/p0-production-state-reconciliation`
- Base: `bb9386f72197fb20912c328ac912c27894f3db02`
- Status: implementation in progress; production execution blocked

## Proven root cause

Both Railway contexts received commits `13c9aa4a1fc87570dbf8180f87dc66ecc9bae5c2` and `bb9386f72197fb20912c328ac912c27894f3db02`, read `/railway.json`, and failed before the application build. Railpack selected Bun because the repository contained `bun.lock`; Bun 1.3.14 then rejected that stale lock under `--frozen-lockfile`. The four failures form one `failed_deployment_sequence` caused by the same repository defect, not source-SHA, runtime, health-check, Supabase, or secret failures. No runtime outage is asserted because the last successful deployments at `a558785d3fc2c1eb2aa9298087bba7f940094bcb` remained the observed runtime anchors.

The bounded remediation removes the stale Bun lock and retains `package-lock.json` as the single maintained dependency lock. CI already installs with `npm ci`, and Railway's configured build and start commands remain unchanged.

## Evidence reconciled

- `origin/main` equals the expected merge `bb9386f72197fb20912c328ac912c27894f3db02`.
- PR #8 head `33f2231443172b1956c5adf2b609a3e0bb02daab` received an explicit GitHub approval bound to that commit before merge.
- Read-only Railway history records four failed deployments across the two expected contexts and two successful runtime anchors at `a558785d3fc2c1eb2aa9298087bba7f940094bcb`.
- The post-merge audit observed successful GitHub repository checks and a failing Supabase Preview integration caused by remote/local migration-history mismatch. The canonical Supabase project itself is `ACTIVE_HEALTHY` with the four expected active migrations.
- The A3.2b pending migration remains unapplied.
- `freshLiveReadOnlyPreflight` remains false because no reviewed remediation deployment has been observed.
- `independentReviewOfRemediationHead` is true for the merged PR #8 head only; this P0 branch requires a new review.

## Exit checklist

- [x] Verify repository and PR identities.
- [x] Preserve the dirty primary checkout.
- [x] Discover and classify the complete Railway failure sequence read-only.
- [x] Verify canonical Supabase identity and active migration list read-only.
- [x] Add durable program-state records and deterministic validation.
- [x] Complete the full local validation suite.
- [x] Update the focused PR.
- [ ] Obtain Sonnet review of the exact P0 head.
- [ ] Obtain any separate production authorization before a Railway write.

## Explicitly not executed

No platform write, redeploy, database change, migration, DNS change, checkout/payment activation, public catalog/inventory activation, media ingestion, or outbound communication.
