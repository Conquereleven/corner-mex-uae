# A3.2a independent review handoff

## Requested decision

Review the exact PR head for `feature/production-activation-readiness-a3-2a`. Do not merge it and do not interpret approval as authorization for A3.2b.

Expected implementation result: `a3_2a_valid_but_blocked`, with `readyForA3_2bReview=false`.

## Review scope

- locale-independent codepoint ordering and unchanged A3.1 checksum
- strict production-readiness JSON contract/schema and adversarial validator
- static/live evidence separation and explicit read-only adapter requirement
- callback inventory and founder-decision completeness
- fail-closed environment flags and sanitized `/api/ready` capability output
- privacy canary coverage
- Auth, Storage, catalog/inventory, security, rollback, and A3.2b runbooks
- CI static-only gates and absence of platform credentials

## Reproduce

```bash
npm run test:alignment
npm run validate:a2-migration
npm run test:a2
npm run validate:a3:inventory
npm run validate:a3:mapping
npm run test:a3
npm run rehearse:a3
npm run reconcile:a3
npm run privacy:a3
npm run validate:a3:target-clean-evidence
npm run validate:a3-2a:readiness
npm run validate:a3-2a:callbacks
npm run validate:a3-2a:founder-decisions
npm run test:a3-2a
npm run verify:a3:activation-readiness
npx eslint scripts/a3/*.mjs tests/a3/*.mjs tests/a3-2a/*.mjs
npm run lint:changed
npm run typecheck
npm run build
npm run build:railway
git diff --check
```

`npm run lint` is expected to fail on the documented inherited baseline. See `docs/quality/lint-debt-baseline-a3-2a.md`; sprint-owned files must remain clean.

## Evidence and limitations

- Base commit: `100bb57fc92938a0b803c088abf57a03fa1e8a27`
- A3.1 checksum remains `4d2ce1a09e698cde442fc2148a78db329aba3bc520b135eedb644977c7a6a29c`
- Supabase evidence: healthy, 20/20 RLS, 37 policies, zero Auth/Storage/commercial state
- Railway staging evidence: root, health, readiness, and asset HTTP 200
- No platform mutation or deployment occurred
- Railway source branch, Lovable runtime metadata, and custom-domain metadata remain `NOT VERIFIED`
- Railway production-environment execution is approved for A3.2b only and has not occurred
- the 14-day post-cutover Lovable rollback window is approved but has not started; Lovable is not retired
- 11 founder decisions remain unanswered and rollback owner is unassigned

## Founder decision re-review

Verify the existing decision enum remains `yes|no|unanswered` and that only these two entries are `yes`:

1. `railway_production_environment`: `approved_for_a3_2b_execution_only`, with all execution and production flags false.
2. `lovable_rollback_window`: exactly 14 days after successful future cutover, with cutover, window-start, and retirement false.

The remaining decisions must stay unanswered. `readyForA3_2bReview` must remain false and derived from actual blockers. Re-review the exact updated PR head; do not merge and do not execute A3.2b.

## Safety assertions

No production environment, deployment, DNS, callback, Auth user, Storage bucket/object, catalog row, inventory, order, payment, review, external communication, OpenClaw action, or CornerOps write was created or enabled. The committed evidence expires and must be refreshed through an approved live read-only adapter immediately before any A3.2b review.
