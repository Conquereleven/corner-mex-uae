# Railway live governance contract

Status: `live_monitoring_deferred`; `manual_read_only_verification_required`.

## Authoritative evidence

Observed 2026-07-20 from Railway's official Public API documentation, official generated GraphQL collection, and `railwayapp/cli@c543c4b693eef200c17595746772bc4f8c74b37b`.

- Endpoint: `https://backboard.railway.com/graphql/v2`.
- OAuth header: `Authorization: Bearer <access token>`; project tokens instead use `Project-Access-Token` and are not accepted here.
- Minimum acceptable credential: OAuth access token with `openid project:viewer`, restricted during consent to this project. Access tokens expire after one hour. Long-running monitoring would additionally require `offline_access` and protected refresh-token rotation.
- Provisioning: create a dedicated Railway OAuth app, request only those scopes, select only this project, store tokens only as encrypted Actions secrets, and leave `RAILWAY_LIVE_MONITORING_ENABLED` unset until a sanitized live contract test passes.
- Rotation/revocation: revoke the OAuth grant/app, remove Actions secrets, repeat consent for the single project, and record rotation without token values.

## Read-only contract

The generated collection exposes `serviceInstanceAutoDeployStatus(projectId, environmentId, serviceId) { canEnable enabled reason }`. `enabled` is the documented auto-deploy boolean. The official CLI `EnvironmentInstances` query returns `environment(id, projectId)`, service instances with returned `serviceId` and `environmentId`, `source.repo`, `latestDeployment`, and `activeDeployments`; active deployments contain `id`, `status`, `createdAt`, `meta`, and instance status.

Official deployment documentation defines the latest successful query with `status: { successfulOnly: true }`. The CLI's `activeDeployments` relationship is preferred because it explicitly means currently deployed/running. Failed, crashed, removed, building, waiting, queued and skipped deployments are not candidates. Service-instance pagination uses `first/after` plus `pageInfo`; deployment connections support cursor pagination.

## Field classification and limitations

- Independently observable by documented shapes: service ID, environment ID, repository, active deployment ID/status/createdAt/meta, source SHA when present in `meta`, and auto-deploy `enabled`.
- Query-scoped: project ID supplied to the query.
- Not verified in a sanitized live response: watched branch, environment display name, Wait for CI, exact `meta` keys/nullability, and ordering beyond the documented successful-only example.
- No credential was provisioned and no live request was made. The repository cannot claim a live probe, complete governance verification, or active monitoring.

The comparator stays injectable for fixtures, but the disabled live runner cannot produce operational `live_governance_verified`. Manual read-only verification remains mandatory before activation can advance.
