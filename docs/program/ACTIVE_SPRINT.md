# Active Sprint: CM-RDY-1 — Staging Readiness Correction + Verified Closure

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/staging-readiness-evidence`
- Initial head: `87b7c4afd086e3ae34a36c9c6415ccadf398a9d6`
- Base/main source: `73790cb3724fc1f19bedd157fc237f07a46e4314`
- PR: `#13` (draft)
- Status: staging correction `executed_verified`; independent delta-only review pending

## Authorized operation

Founder decision `FD-CM-STAGING-READINESS-001` authorized exactly one change: set `CORNERMEX_COMMERCE_MODEL` to the repository contract value in Railway `staging / cornermex-web`. It did not authorize production, Supabase changes, commerce activation, payments, A3.2b, or external communication.

Railway applied one staged variable edit and automatically created deployment `43872f13-25bc-46ed-bc2d-7e8cddcebcb0`. No manual restart or redeploy was performed. The deployment became active from unchanged source `73790cb3724fc1f19bedd157fc237f07a46e4314`.

## Verified result

- `/api/health`: `200`, `status: ok`, commit `73790cb3724f`
- `/api/ready`: `200`, `status: ready`, `target: reachable`
- Supabase readiness probe: executed and reachable
- rollback target: `ab629441-4104-4b9c-b65d-66eafa6ba1af`; native Railway deployment rollback restores custom variables
- rollback performed: no
- production: unchanged at deployment `bac2a5b3-0b8a-4243-8046-531113a4ca18`, source `d470b7b57f6d625a7d60337ad16a59080c1bb37d`

## Exit checklist

- [x] Revalidate exact local/remote head, PR draft state, CI, main, staging, and production identities.
- [x] Verify rollback availability before writing.
- [x] Execute exactly one staging variable edit.
- [x] Observe Railway's automatic deployment without a manual restart/redeploy.
- [x] Verify health, readiness, Supabase reachability, source SHA, and production non-impact.
- [x] Record execution evidence and extend validation-only contracts.
- [x] Run focused and full validation.
- [ ] Commit, push, and update draft PR #13.
- [ ] Obtain Sonnet independent delta-only review of the exact final range.

## Explicitly not executed

No production variable change, deployment, restart, rollback, or activation; no manual staging restart/redeploy; no Supabase write; no migration; no DNS or Lovable action; no payment, checkout, commercial, catalog, or inventory activation; no A3.2b execution; no external communication; no merge; no ready-for-review transition.
