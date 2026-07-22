# Active Sprint: CM-PROD-1 — Controlled Production Frontend Launch

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/production-frontend-launch-evidence`
- Base/main source: `068b9babacbadf0e786579e056e3363d7afb641c`
- Founder decision: `FD-CM-PROD-LAUNCH-001`
- Status: production launch `executed_verified`; short evidence delta review pending

## Verified production result

- Railway deployment: `b3184cee-67b7-4506-969b-bf18fead3292` (`SUCCESS`, active)
- previous rollback target: `bac2a5b3-0b8a-4243-8046-531113a4ca18`
- source: `068b9babacbadf0e786579e056e3363d7afb641c`
- URL: `https://corner-mex-uae-production.up.railway.app`
- region: `asia-southeast1-eqsg3a`
- `/`: `200`, non-empty frontend, public navigation operational
- `/api/health`: `200`, `status: ok`, commit `068b9babacba`
- `/api/ready`: `200`, `status: ready`, `target: reachable`
- checkout, payment, marketplace, commissions, external messaging, orders, inventory mutation and A3.2b: disabled
- rollback performed: no

## Platform writes performed

Railway production received one grouped application containing the Singapore region correction, one Railway public domain, and variables `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `CORNERMEX_COMMERCE_MODEL`. Secret values were never printed or committed. Railway created one deployment from the exact authorized source. Production auto-deploy remained disabled.

## Explicitly not executed

No Supabase write, migration, schema change, credential creation or rotation, custom domain, DNS, checkout, payment, marketplace, commission, order, inventory mutation, external message, A3.2b, Lovable action, or commercial activation was performed.

## Exit checklist

- [x] Verify exact merged source and green CI.
- [x] Verify staging read-only and production rollback target.
- [x] Apply the minimum authorized Railway configuration in one group.
- [x] Observe exact-source deployment through SUCCESS and activation.
- [x] Verify health, readiness, Supabase reachability, public frontend and commercial-off gates.
- [x] Record redacted execution evidence and minimum tests.
- [ ] Obtain Sonnet short evidence delta review before merge.
