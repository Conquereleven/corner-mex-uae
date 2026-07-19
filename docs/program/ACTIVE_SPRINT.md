# Active Sprint: CornerMex P0 Production State Reconciliation

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/p0-production-state-reconciliation`
- Base: `bb9386f72197fb20912c328ac912c27894f3db02`
- Status: implementation in progress; production execution blocked

## Proven root cause

Both Railway contexts received the expected `main` commit, read `/railway.json`, and failed before the application build. Railpack selected Bun because the repository contains `bun.lock`; Bun 1.3.14 then rejected that stale lock under `--frozen-lockfile`. The two failures are the same repository defect, not source-SHA, runtime, health-check, Supabase, or secret failures.

The bounded remediation removes the stale Bun lock and retains `package-lock.json` as the single maintained dependency lock. CI already installs with `npm ci`, and Railway's configured build and start commands remain unchanged.

## Evidence reconciled

- `origin/main` equals the expected merge `bb9386f72197fb20912c328ac912c27894f3db02`.
- PR #8 head `33f2231443172b1956c5adf2b609a3e0bb02daab` received an explicit GitHub approval bound to that commit before merge.
- The post-merge audit observed successful GitHub repository checks, two failed Railway deployment statuses, and a failing Supabase Preview integration caused by remote/local migration-history mismatch. The Supabase project itself is `ACTIVE_HEALTHY` with the four expected active migrations.
- The A3.2b pending migration remains unapplied.
- `freshLiveReadOnlyPreflight` remains false because no reviewed remediation deployment has been observed.
- `independentReviewOfRemediationHead` is true for the merged PR #8 head only; this P0 branch requires a new review.

## Exit checklist

- [x] Verify repository and PR identities.
- [x] Preserve the dirty primary checkout.
- [x] Discover and classify both Railway failures read-only.
- [x] Verify canonical Supabase identity and active migration list read-only.
- [x] Add durable program-state records and deterministic validation.
- [ ] Complete the full local validation suite.
- [ ] Open a focused draft PR.
- [ ] Obtain Sonnet review of the exact P0 head.
- [ ] Obtain any separate production authorization before a Railway write.

## Explicitly not executed

No platform write, redeploy, database change, migration, DNS change, checkout/payment activation, public catalog/inventory activation, media ingestion, or outbound communication.
