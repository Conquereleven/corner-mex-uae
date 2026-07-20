# Railway Deployment Governance

## Binding model

CornerMex uses `automatic_staging_manual_production`.

- A reviewed merge to `main` may automatically deploy staging.
- A merge or push must never authorize a production deployment.
- Production activation is an explicit manual action after the exact source SHA, Founder decision ID, health/readiness evidence and rollback target are recorded.
- The active contract is machine-readable in `docs/program/DEPLOYMENT_REGISTRY.json` and enforced by `npm run validate:deployment-governance` in CI.

## Verified Railway topology

Observed at `2026-07-20T00:01:26Z` in project `06d2ecdd-3c03-4480-8299-48c539595a94` (`CornerMex UAE`).

| Environment | Service          | Repository / branch                     | Auto-deploy | Trigger                | Current source                             |
| ----------- | ---------------- | --------------------------------------- | ----------- | ---------------------- | ------------------------------------------ |
| staging     | `cornermex-web`  | `Conquereleven/corner-mex-uae` / `main` | enabled     | GitHub push to `main`  | `d470b7b57f6d625a7d60337ad16a59080c1bb37d` |
| production  | `corner-mex-uae` | `Conquereleven/corner-mex-uae` / `main` | disabled    | explicit manual action | `d470b7b57f6d625a7d60337ad16a59080c1bb37d` |

Both services previously had auto-deploy enabled. The merge of PR #10 therefore created staging deployment `1efd468e-8449-4495-a1f2-442984943b40` and production deployment `bac2a5b3-0b8a-4243-8046-531113a4ca18` from the same merged SHA. Disabling production auto-deploy did not create a deployment, restart or rollback; both existing instances remained `SUCCESS` and `RUNNING` on the same SHA.

Railway `Wait for CI` is disabled in both contexts. GitHub environments named `CornerMex UAE / staging` and `CornerMex UAE / production` exist, but the production environment has no required reviewers or wait timer, permits administrator bypass and is not referenced by the repository workflow. These controls therefore do not currently constitute a production approval gate.

## Production activation contract

Before any production action, the release record must contain all of the following:

1. An applicable Founder decision ID matching `^FD-CM-[A-Z0-9.-]+$`.
2. The exact 40-character Git source SHA visible in Railway before activation.
3. Passing CI for that exact SHA.
4. Passing `/api/health` and `/api/ready` evidence for the candidate configuration.
5. A verified rollback target and an explicit statement of whether it is directly redeployable or requires a rebuild.
6. A named operator and timestamp for the manual production action.

The operator must stop if the repository contract reports `production.autoDeploy=true`, the source SHA differs, readiness is degraded, the decision ID is absent, or the rollback target is not usable.

## Current containment and readiness

The running PR #10 deployments remain preserved. Staging `/api/health` returns `200` with commit `d470b7b57f6d`; staging `/api/ready` returns `503` because `CORNERMEX_COMMERCE_MODEL` is absent. Production is not publicly exposed, and a read-only variable-presence check shows that `CORNERMEX_COMMERCE_MODEL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are absent, so its readiness contract cannot pass.

This governance remediation does not authorize variable changes or rollback. Readiness repair and any runtime disposition require separate authorization. A3.2b, Supabase writes, DNS, payments, checkout, Lovable publication, DB1 changes, live media ingestion, public price/stock activation and external communications remain blocked.

## Rollback record

The previous successful source is `a558785d3fc2c1eb2aa9298087bba7f940094bcb`:

- staging deployment `66abbc09-04d1-4f98-b455-4fa9ac6893b7`;
- production deployment `228170ed-3e67-4be5-a39e-8bc07860bd78`.

Railway currently reports both entries as `REMOVED`. They are historical evidence, not an immediately available rollback button. Recovery to that source therefore requires a controlled rebuild from the exact commit after authorization. Lovable remains unchanged as the commercial rollback anchor.

## Change procedure

Any future change to this model must update the deployment registry and this document in the same pull request. CI rejects production auto-deploy, a Git push/merge production trigger, missing production preconditions, or any claim that the governance-only change created a deployment, restart or rollback.
