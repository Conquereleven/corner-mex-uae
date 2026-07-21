# Next Readiness Sprint — handoff note, not authorization

This document enumerates future work. It does not authorize, schedule, or execute any of it. No Railway variable, Supabase configuration, DNS record, or commercial capability is changed by this note or by the sprint that produced it (`CM-RDY-0 — Post-Merge Reconciliation + Staging Readiness Evidence`).

## Current blocked state (verified live 2026-07-21; see `docs/program/STAGING_READINESS_EVIDENCE.md`)

- Staging readiness: degraded — **not** because `CORNERMEX_COMMERCE_MODEL` is absent (it is present; corrected from a prior stale claim). Live `/api/ready` returns `503` with `missing: []` and `errors: ["CORNERMEX_COMMERCE_MODEL"]`: the variable exists but its value does not satisfy the exact literal `single_merchant_with_internal_supplier_network` required by `src/config/commerce-env.ts`.
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are present in staging (confirmed by `missing: []`); their values and live Supabase reachability were not and could not be checked, because readiness returns early on the `CORNERMEX_COMMERCE_MODEL` validation failure before ever attempting the Supabase reachability probe.
- Production readiness was not re-verified this sprint (staging-first; production out of scope for CM-RDY-0). Treat production's readiness state as unknown-until-reverified, not as confirmed degraded or confirmed fine.
- `docs/program/CURRENT_STATE.json` → `readiness.declaredReady`: `false`.
- Production activation: not authorized. No Founder decision ID has been recorded for any exact SHA.

## Future work (enumerated only, not started)

1. ~~Confirm the contract for each required readiness variable~~ — done this sprint for staging: see `docs/program/STAGING_READINESS_EVIDENCE.md` for the exact code-derived contract (`src/config/commerce-env.ts`).
2. Obtain Founder authorization for the exact `CORNERMEX_COMMERCE_MODEL` value correction proposed in `docs/program/STAGING_READINESS_CHANGE_REQUEST.example.json` (staging only). The canonical value is already known from code (`single_merchant_with_internal_supplier_network`) — no new value needs to be invented, only authorized and applied.
3. Under that separate authorization, apply the value correction to staging only, using platform tooling outside this repository's scope.
4. Verify `/api/health` and `/api/ready` on staging return healthy/ready after the repair (live GET, same discipline as this sprint), and separately verify whatever Supabase reachability check follows once the environment schema passes.
5. Obtain an independent review of the staging readiness repair, bound to its exact deployment SHA.
6. Only after staging is verified ready and reviewed, and only as a fully separate action, evaluate whether production needs the same correction — confirm production's actual current variable presence and readiness live first; do not assume it mirrors staging's fix.
7. For any future production activation, use `docs/program/PRODUCTION_ACTIVATION_REQUEST.schema.json` with every completeness element genuinely green — unaffected by this sprint.

## Explicitly out of scope for this note and for CM-RDY-0

Variable changes, migrations, Supabase writes, A3.2b, DNS, Lovable actions, payments, checkout, commercial activation, catalog/inventory changes, production restarts, automatic rollbacks, manual/production deployment, Railway credential provisioning, and external communications.
