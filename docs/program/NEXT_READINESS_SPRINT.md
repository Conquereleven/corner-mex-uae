# Next Readiness Sprint — handoff note, not authorization

This document enumerates future work. It does not authorize, schedule, or execute any of it. No Railway variable, Supabase configuration, DNS record, or commercial capability is changed by this note or by the sprint that produced it (`CM-GOV-2 — Governance Closure + Railway Live Drift Guard`).

## Current blocked state (must remain true until a separate sprint changes it)

- Staging readiness: degraded — `CORNERMEX_COMMERCE_MODEL` is absent.
- Production readiness: degraded — `CORNERMEX_COMMERCE_MODEL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` are absent.
- `docs/program/CURRENT_STATE.json` → `readiness.declaredReady`: `false`.
- Production activation: not authorized. No Founder decision ID has been recorded for any exact SHA.

## Future work (enumerated only, not started)

1. Confirm the contract for each required readiness variable (name, expected shape/format, which service consumes it) without recording or guessing at authorized values.
2. Define the authorized value for each variable through the appropriate Founder/engineering channel, without writing it into this repository or any durable record here.
3. Repair staging first: apply the confirmed variables to the staging environment only, under its own explicit authorization.
4. Verify `/api/health` and `/api/ready` on staging return healthy/ready after the repair, using the same read-only evidence discipline as this sprint.
5. Obtain an independent review of the staging readiness repair, bound to its exact deployment SHA.
6. Only after staging is verified ready and reviewed, request a separate, explicit Founder decision for production — using `docs/program/PRODUCTION_ACTIVATION_REQUEST.schema.json` to record the request, with every completeness element (Founder decision ID, exact SHA, green CI, green health, green readiness, `live_governance_verified`, usable rollback target, fresh evidence) genuinely satisfied before `authorizationStatus` may become `approved_not_executed`.
7. Evaluate production activation itself as a distinct, later, separately authorized action — this note does not schedule or presuppose a timeline for it.

## Explicitly out of scope for this note and for CM-GOV-2

Variable changes, migrations, Supabase writes, A3.2b, DNS, Lovable actions, payments, checkout, commercial activation, catalog/inventory changes, production restarts, automatic rollbacks, manual production deployment, and external communications.
