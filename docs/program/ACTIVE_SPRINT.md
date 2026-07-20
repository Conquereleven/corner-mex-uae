# Active Sprint: PR #10 Railway Auto-Deploy Governance

- Owner: Codex
- Reviewer: independent reviewer
- Branch: `ops/railway-autodeploy-governance`
- Base: `d470b7b57f6d625a7d60337ad16a59080c1bb37d`
- Status: governance remediation implemented; review and readiness remediation pending

## Incident and trigger

Merging PR #10 automatically deployed exact commit `d470b7b57f6d625a7d60337ad16a59080c1bb37d` to staging and production. Railway UI discovery confirmed that both services watched `main` with auto-deploy enabled. GitHub merges were therefore implicitly production-authorizing platform events.

The two deployments remain `SUCCESS` and `RUNNING`, use npm and have no pre-deploy command. Staging health passes, but staging readiness is degraded because `CORNERMEX_COMMERCE_MODEL` is missing. Production is unexposed and lacks all three variables required by the readiness contract. No outage is asserted, but the runtime is not declared ready.

## Governance correction

Production auto-deploy is disabled while the GitHub repository and `main` branch remain connected. Staging remains automatic. The platform change created no deployment, restart or rollback and preserved both running deployment IDs.

Repository records now define `automatic_staging_manual_production`. CI rejects `production.autoDeploy=true` and rejects a Git push or merge as the production trigger. Future production activation requires an explicit Founder decision ID, exact SHA, green health/readiness and a verified rollback target.

## Exit checklist

- [x] Verify repository, merge SHA, project, services and environments.
- [x] Identify the exact shared GitHub auto-deploy trigger.
- [x] Record source SHA, package manager, instance state and deployment history.
- [x] Disable production auto-deploy without deploying.
- [x] Verify staging remains automatic and production is manual.
- [x] Add durable governance records and a fail-closed CI validator.
- [ ] Obtain independent review of the exact governance branch head.
- [ ] Under separate authorization, restore required Railway readiness variables and rerun readiness checks.
- [ ] Obtain a Founder decision ID before any future production activation.

## Explicitly not executed

No deployment, restart, rollback, Supabase write, migration, DNS change, checkout/payment activation, Lovable publication, DB1 change, live media ingestion, public price/stock activation or external communication was performed.
