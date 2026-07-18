# A3.2b CM-2A Remediation Acceptance

## Branch update identity

- Original PR #8 base: `06d1c71d56a4e343dfeda4eaff28b2a7dba828d1`.
- Remediated `main`: `13c9aa4a1fc87570dbf8180f87dc66ecc9bae5c2`.
- Original PR #8 head: `c2058c32ec08eaf4b5da8e0f53fb98b13923e4ef`.
- Update strategy: merge current `main` into the PR branch to preserve the original commits and avoid a force push.
- Rollback ref: `backup/pr8-c2058c32-before-main-13c9aa4`.
- The exact updated head and proposed merge SHA must be read from GitHub or `git rev-parse`; they are not self-recorded inside the commit they identify.

## Verified locally

- The CornerOps catalog source remains pinned to `a8a751bdbaf2b12fef3f94c83769bac52fffbaad`; this is a source artifact identity, not the CornerMex branch head.
- Fresh preview: 190 records = 148 ready + 41 review + 1 missing media; 189 media references; public exposure and inventory remain zero.
- Saved previews are recomputed from the exact pinned Git object and fail closed on source, count, classification or media fingerprint drift.
- The A3.2b migration remains in `supabase/pending-canonical`; it is not part of the four active canonical migrations.
- Its RLS policies use `commerce_private.is_admin(auth.uid())`, matching the post-PR #9 private admin boundary.
- Migration ownership was regenerated from the updated tree: 4 active, 1 pending and 42 quarantined Lovable DB1 migrations.

## Historical evidence

- Railway production source was observed read-only on `main` at the original base commit with deployment `SUCCESS`.
- That observation is historical and stale relative to remediated `main`; it is not activation evidence for the updated PR head.
- Railway source verification now requires an explicit 40-character `RAILWAY_EXPECTED_COMMIT` and fails closed when it is omitted or malformed.
- GitHub Actions verified rollback against disposable PostgreSQL: execution A removed, B and protected tables preserved, repeated A is an idempotent no-op, and unknown IDs fail closed.
- Founder decisions are resolved with Joel / Founder as rollback owner and a 48-hour observation window.

## Execution gate

Execution remains blocked. A fresh live read-only preflight is required, the exact updated head requires independent review, and historical Railway evidence must not be substituted for a current observation. The pending migration is not approved for execution by this branch update.

No Supabase migration, database write, Auth user, Storage object, Railway deployment, DNS change, Lovable change, catalog import, inventory activation, checkout, payment, email or customer communication occurred.
