# Railway Deployment Governance

## Validator scope — read this before trusting a green CI run

`npm run validate:deployment-governance` and `npm run validate:program-state` validate **repository consistency only**. They read `docs/program/DEPLOYMENT_REGISTRY.json` and the other committed program-state files and check that those documents are internally consistent, correctly shaped, and declare the intended model. **They never query Railway.** A green CI run on these two checks proves the _documentation_ is self-consistent — it does not, by itself, prove that Railway's actual live configuration matches what the documentation claims.

Live Railway configuration (auto-deploy state, connected repository, watched branch, current source SHA, deployment/instance status) is verified separately by the **Railway Live Drift Guard** (`scripts/program/check-railway-live-governance.mjs`, run via `.github/workflows/railway-governance-drift.yml`). That guard is the only component in this repository that reads live platform state, and it does so strictly read-only — it has no ability to deploy, restart, roll back, or modify Railway configuration or variables (this is enforced by a static source-scan that rejects the presence of any Railway write operation in the guard's own code).

Any difference between the committed registry and live Railway state is a **drift**, and the guard fails closed on drift, on an unreachable/unauthenticated Railway API, and on a malformed or unrecognized API response — a failed or unavailable live probe is never treated as a passing result. See "Railway Live Drift Guard" below for the exact states it can report.

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

## Railway Live Drift Guard

`scripts/program/check-railway-live-governance.mjs` is the only component that reads live Railway state. It is invoked by `.github/workflows/railway-governance-drift.yml`, separately from the repository-consistency checks in `ci.yml`.

- On every pull request touching governance files, and on `workflow_dispatch`, only the **static** checks run (`validate:deployment-governance`, `validate:program-state`, the guard's own unit tests against injected fixtures, and a static scan rejecting any Railway write operation in the guard's own code). No live Railway call happens here.
- The **live** probe only runs on a daily `schedule` (03:17 UTC) or an explicit `workflow_dispatch` with `run_live_probe: true`, and only reads — it never deploys, restarts, rolls back, or writes variables.
- It compares live Railway state per environment (project/environment/service identifiers, connected repository, watched branch, auto-deploy state, current deployment ID and source SHA, deployment/instance status — never variable values) against `docs/program/DEPLOYMENT_REGISTRY.json`.
- It reports exactly one of five states; **only `live_governance_verified` is green**: `live_governance_verified`, `live_governance_drift_detected`, `live_governance_probe_unavailable`, `live_governance_response_malformed`, `live_governance_credentials_missing`. A failed or unreachable live query is never reported as verified.
- Live access requires a dedicated `RAILWAY_VIEWER_TOKEN` GitHub Actions secret bound to a Viewer/read-only Railway identity with no deploy and no variable-value access. That secret does not exist yet. Until it is provisioned, the live job runs, honestly reports `live_governance_credentials_missing`, and fails closed (non-zero exit) rather than silently passing. Do not satisfy this by reusing a broader existing token.

## Change procedure

Any future change to this model must update the deployment registry and this document in the same pull request. CI rejects production auto-deploy, a Git push/merge production trigger, missing production preconditions, or any claim that the governance-only change created a deployment, restart or rollback. Any change to the live drift guard's scripts or workflow must keep passing the write-operation scan in `scripts/program/assert-no-railway-writes.mjs`.
