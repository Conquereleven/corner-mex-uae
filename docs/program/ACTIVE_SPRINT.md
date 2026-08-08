# Active Sprint: CM-GOV-3 — Post-PR #21 Security & Program State Hygiene

- Owner: Claude
- Reviewer: Founder
- Branch: `security/cm-gov-3-post-pr21-hygiene`
- Base/main source: `77e5d24e8a3c9589dac7535480ed7d9dbc60a512`
- Status: implementation complete; draft PR pending independent review

## Verified current production result

- PR #21 (CM-COM-1C dual B2C/B2B commerce and admin access) is MERGED; merge commit `77e5d24e8a3c9589dac7535480ed7d9dbc60a512`; independently reviewed exact head `c9f82892b4bbe029f2b709eb6a3f00f24026c7c8` is contained in main.
- Production deployment: `18dc25e0-1244-44ff-9e66-3a5cc1f02208` (`SUCCESS`, `RUNNING`), source `c9f82892b4bb...` (PR #21 exact head), Founder-executed manual deployment.
- Staging deployment: `fefc9d83-4f06-4b67-8829-a9f033e3ab1f` (`SUCCESS`), source `77e5d24e8a3c...` (main).
- `/api/health` and `/api/ready`: `200` on both environments with matching commit provenance.
- Founder runtime acceptance completed: Google OAuth end-to-end, `/auth/callback`, authenticated `/account`, canonical admin authorization (`user_roles.role = 'admin'`), Master Dashboard.
- Checkout, payment, marketplace, commissions, external messaging, orders, inventory mutation and A3.2b remain disabled/not authorized.
- Canonical `public.products` remains empty; catalog population (A3.2b) stays a separately authorized operation.

## Sprint scope (CM-GOV-3)

- SECURITY: remove the preexisting `adminBootstrap` self-service zero-admin claim path; add regression coverage.
- OBSERVABILITY: health/readiness service identity derived from the runtime environment (`RAILWAY_SERVICE_NAME`, fallback `corner-mex-uae`) instead of the hardcoded `cornermex-web` label.
- PROGRAM STATE: reconcile `CURRENT_STATE.json`, `DEPLOYMENT_REGISTRY.json` and this file to verified post-merge reality; historical evidence documents preserved unchanged.
- PLATFORM CLEANUP: delete the accidental Railway project `pr21-head` after conclusive isolation proof.

## Known open items

- External "Supabase Preview" GitHub check fails on main: remote migration versions missing from `supabase/migrations` (integration drift; not a repository CI gate).
- Production deployment `18dc25e0...` is now ratified by `FD-CM-PROD-EXACT-HEAD-001` (recorded after execution); the next manual production deployment must originate from `main`.

## Explicitly not executed

No CM-COM-2 work, no A3.2b, no product population, no checkout/payment/external messaging enablement, no inventory or order mutation, no seller approval, no OAuth configuration change, no credential rotation, no DNS/custom domain change, no CornerOps write.
