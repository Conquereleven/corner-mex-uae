# Staging Readiness Evidence — CM-RDY-0

Collected 2026-07-21, read-only. No Railway or Supabase write performed to produce this document. No secret or variable value is recorded anywhere in this file. Finalized in micro-sprint `CM-RDY-0A` once the post-merge staging deployment reached a terminal state.

## Identity

- Repository: `Conquereleven/corner-mex-uae`
- Reconciled `main` SHA: `73790cb3724fc1f19bedd157fc237f07a46e4314` (PR #12 merge; confirmed against `origin/main` before this evidence was collected)
- Railway project: `06d2ecdd-3c03-4480-8299-48c539595a94` (`CornerMex UAE`)
- Staging: service `cornermex-web` (`5a6b85da-3156-4fc1-828d-ec9e4019de7e`), environment `385b8cb8-878b-4d83-ad46-2bc831fed829`, public domain `cornermex-web-staging.up.railway.app`
- Production: service `corner-mex-uae` (`6702af28-5689-46fb-8896-b5a8b1fbba94`), environment `8f35b59c-7446-4514-a307-0b329ec62bd1` (not publicly exposed; not probed live this sprint)

## Deployment state — final (CM-RDY-0A)

|                       | Staging                                                                                             | Production                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Active deployment** | `ab629441-4104-4b9c-b65d-66eafa6ba1af` @ `73790cb3724fc1f19bedd157fc237f07a46e4314` — **`SUCCESS`** | `bac2a5b3-0b8a-4243-8046-531113a4ca18` @ `d470b7b57f6d625a7d60337ad16a59080c1bb37d` |
| Previous deployment   | `7051fc17-56f0-456a-b547-bbf2f468e489` @ `a173dfc6d5b0d8b62710a1ce604d6df9ea63c373` — now `REMOVED` | unchanged — no new deployment created                                               |
| Auto-deploy           | `true` (per `docs/program/DEPLOYMENT_REGISTRY.json`)                                                | `false` (per same, and per PR #11/#12 governance verification)                      |

The staging deployment that PR #12's merge triggered (`ab629441` @ `73790cb`) progressed `QUEUED` → `BUILDING` → `SUCCESS` and is now the active, live instance, confirmed by both the Railway deployment record and by the `commit` field in a live `GET /api/health` response below. The record of it being observed mid-flight (`QUEUED`) during the original CM-RDY-0 evidence pass is preserved lower in this document as historical evidence, not presented as current. Production is confirmed unchanged throughout — no deployment, restart, or rollback occurred at any point across CM-RDY-0 or CM-RDY-0A.

## Live health result (final, against the active deployment)

```
GET https://cornermex-web-staging.up.railway.app/api/health
HTTP 200
{"status":"ok","service":"cornermex-web","runtime":"node","commerceModel":"single_merchant_with_internal_supplier_network","version":"unversioned","commit":"73790cb3724f"}
```

`commit` now reports `73790cb3724f`, confirming this response came from the new, active deployment (`ab629441`), not the removed prior one. `commerceModel` in this payload is a **hardcoded string literal in `src/routes/api/health.ts`**, not read from the environment — its presence here does not indicate the `CORNERMEX_COMMERCE_MODEL` environment variable is correctly set. See the readiness result below for the actual environment-driven check.

## Live readiness result (final, against the active deployment)

```
GET https://cornermex-web-staging.up.railway.app/api/ready
HTTP 503
{"status":"degraded","service":"cornermex-web","target":"unavailable","missing":[],"errors":["CORNERMEX_COMMERCE_MODEL"]}
```

**Identical in substance to the CM-RDY-0 result against the prior deployment** — the blocker did not change when the new deployment went live, which is expected: the deployment carried code changes only, no variable change was made or was in scope. `missing: []` — `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (the only two variables the code checks via explicit presence) are present. `errors: ["CORNERMEX_COMMERCE_MODEL"]` — this variable failed Zod schema validation, meaning **it is present but its value does not equal the required literal**. Because the environment schema (`environmentSchema.safeParse`) fails before `getReadinessResponse` ever reaches the Supabase reachability probe (`checkSupabaseReadiness`), **Supabase connectivity from staging was not and could not be exercised by this check** — that remains unknown, not confirmed either way.

## Historical evidence (CM-RDY-0, superseded — not current)

At original evidence-collection time, `ab629441` was still `QUEUED` and the live instance was the prior deployment:

```
GET https://cornermex-web-staging.up.railway.app/api/health  (against 7051fc17 @ a173dfc6)
HTTP 200
{"status":"ok","service":"cornermex-web","runtime":"node","commerceModel":"single_merchant_with_internal_supplier_network","version":"unversioned","commit":"a173dfc6d5b0"}

GET https://cornermex-web-staging.up.railway.app/api/ready  (against 7051fc17 @ a173dfc6)
HTTP 503
{"status":"degraded","service":"cornermex-web","target":"unavailable","missing":[],"errors":["CORNERMEX_COMMERCE_MODEL"]}
```

Kept for audit trail only. The "Deployment state — final" and "final, against the active deployment" sections above are current; this section is not.

## Code-level contract (source of truth — not inferred from variable names)

### `/api/health` — `src/routes/api/health.ts`

- Always returns `200` with `{status:"ok", service, runtime:"node", commerceModel:<hardcoded literal>, version, commit}`.
- Does not read any required environment variable, does not check Supabase, does not depend on `CORNERMEX_COMMERCE_MODEL`'s actual env value. It is a pure liveness check, not a readiness check.

### `/api/ready` — `src/routes/api/ready.ts` + `src/config/commerce-env.ts`

- Validates `process.env` against a Zod schema (`environmentSchema`).
- `CORNERMEX_COMMERCE_MODEL`: `z.literal("single_merchant_with_internal_supplier_network").default("single_merchant_with_internal_supplier_network")`. **Exact allowed value: the literal string `single_merchant_with_internal_supplier_network`, case-sensitive, no other value accepted.** If unset, Zod applies the default and validation passes for this field. If set to any other string, validation fails with an `errors` entry named for this field (exactly what was observed live).
- `SUPABASE_URL`: `z.string().url().optional()`, but `validateCommerceEnvironment` separately requires it via an explicit `!source.SUPABASE_URL` check → appears in `missing` if absent, not in `errors`.
- `SUPABASE_PUBLISHABLE_KEY`: `z.string().min(1).optional()`, same explicit-presence treatment as above.
- If schema validation passes and both Supabase variables are present, the handler calls `checkSupabaseReadiness(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, fetch)`, which does a live `GET {url}/rest/v1/categories?select=id&limit=1` with a 4-second timeout. `ready: true` → `200 {"status":"ready",...}`; `ready: false` or any thrown error → `503 {"status":"degraded",...}`.
- All other schema fields (`CORNERMEX_APPLICATION_ENV`, the various `CORNERMEX_*_ENABLED` flags, `STRIPE_*`, `VITE_*`) are `.optional()` with safe defaults (`false`/`undefined`) and do not block readiness on their own. `CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED=true` additionally requires `CORNERMEX_CHECKOUT_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `CORNERMEX_PUBLIC_APPLICATION_URL` — not relevant to the current staging failure, noted for completeness.
- `validateCommerceEnvironment` also flags any `VITE_*` variable name matching `SERVICE_ROLE|SECRET|PRIVATE|STRIPE_SECRET` as a leaked-client-secret error (`server_secret_exposed_as_<name>`) — none were present in this evidence pass (not in `errors`).

## Sanitized variable-presence matrix (names only — no values requested, received, or recorded)

| Variable                                                                                                                                                                                                                                                             | Required (staging)                       | Required (production) | Present in staging        | Present in production               | Allowed value contract                                                         | Current value read | Change authorized | Notes                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------- | ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ | ------------------ | ----------------- | ------------------------------------------------------------------------------------ |
| `CORNERMEX_COMMERCE_MODEL`                                                                                                                                                                                                                                           | Yes (exact literal or unset-for-default) | Yes (same)            | **YES**                   | Unknown (not re-probed this sprint) | Exact literal `single_merchant_with_internal_supplier_network`, case-sensitive | NO                 | NO                | Present but value fails schema validation — confirmed live via `/api/ready` `errors` |
| `SUPABASE_URL`                                                                                                                                                                                                                                                       | Yes                                      | Yes                   | **YES**                   | Unknown (not re-probed this sprint) | Valid URL (`z.string().url()`)                                                 | NO                 | NO                | Confirmed present via `missing: []` and via variable-name listing                    |
| `SUPABASE_PUBLISHABLE_KEY`                                                                                                                                                                                                                                           | Yes                                      | Yes                   | **YES**                   | Unknown (not re-probed this sprint) | Non-empty string (`z.string().min(1)`)                                         | NO                 | NO                | Confirmed present via `missing: []` and via variable-name listing                    |
| `VITE_SUPABASE_URL`                                                                                                                                                                                                                                                  | No (optional)                            | Unknown               | YES (name observed)       | Unknown                             | Valid URL, optional                                                            | NO                 | NO                | Not required by the readiness check itself                                           |
| `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                                                                                                                                                                      | No (optional)                            | Unknown               | YES (name observed)       | Unknown                             | Non-empty string, optional                                                     | NO                 | NO                | Not required by the readiness check itself                                           |
| `CORNERMEX_CHECKOUT_ENABLED`                                                                                                                                                                                                                                         | No (optional, defaults false)            | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Only relevant if payments are enabled                                                |
| `CORNERMEX_COMMISSIONS_ENABLED`                                                                                                                                                                                                                                      | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_MARKETPLACE_ENABLED`                                                                                                                                                                                                                                      | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_SELLER_AUTH_ENABLED`                                                                                                                                                                                                                                      | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_SELLER_PAYOUTS_ENABLED`                                                                                                                                                                                                                                   | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED`                                                                                                                                                                                                                           | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_EXTERNAL_EMAIL_ENABLED`                                                                                                                                                                                                                                   | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `CORNERMEX_EXTERNAL_MESSAGES_ENABLED`                                                                                                                                                                                                                                | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Not blocking readiness                                                               |
| `VITE_CORNERMEX_CHECKOUT_ENABLED`                                                                                                                                                                                                                                    | No                                       | Unknown               | YES (name observed)       | Unknown                             | `"true"`/`"false"`                                                             | NO                 | NO                | Client-side mirror flag, optional                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                                                                                                                                                                                          | No (optional)                            | Unknown               | Not observed in this pass | Unknown                             | Non-empty string, optional                                                     | NO                 | NO                | Absence-in-listing is not proof of absence; treat as unknown, not confirmed absent   |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CORNERMEX_PUBLIC_APPLICATION_URL`, `CORNERMEX_AUTOMATIC_IMPORT_ENABLED`, `CORNERMEX_AUTOMATIC_INVENTORY_SYNC_ENABLED`, `CORNERMEX_OPENCLAW_ENABLED`, `CORNERMEX_CORNEROPS_WRITE_ENABLED`, `CORNERMEX_APPLICATION_ENV` | No (all optional/defaulted)              | Unknown               | Not observed in this pass | Unknown                             | Various, all optional                                                          | NO                 | NO                | Not required for readiness; not blocking                                             |

**"Current value read" is `NO` for every row and "Change authorized" is `NO` for every row, without exception, in this sprint.**

## Proposed staging-only change (not executed)

Correct `CORNERMEX_COMMERCE_MODEL` in the **staging** environment of service `cornermex-web` to the exact literal `single_merchant_with_internal_supplier_network`. This value is not invented — it is the only value `src/config/commerce-env.ts` accepts, and is already present verbatim in the repository. See `docs/program/STAGING_READINESS_CHANGE_REQUEST.schema.json` and the accompanying `pending_founder_decision` example for the full, non-executable proposal.

- **Triggers redeploy?** Unknown with certainty from this repository alone — Railway typically restarts a service on a variable change to apply it to the running process; this repository code reads `process.env` per-request (not baked into a client bundle for this field), so a plain restart (not necessarily a full rebuild) would likely be sufficient. This must be confirmed operationally, not assumed, at execution time.
- **Isolated from production?** Yes — Railway environment variables are scoped per-environment; changing staging's copy of `CORNERMEX_COMMERCE_MODEL` does not touch production's copy, and production's auto-deploy is independently confirmed `false`.
- **Rollback:** Railway retains variable-change history in its dashboard/audit log; the operator executing the change should note the current (pre-change) value out-of-band before changing it, since this review process is not permitted to read it. Rollback is: restore that noted prior value.
- **Verification:** re-run the same live `GET /api/health` and `GET /api/ready` checks used in this document; expect `/api/ready` to no longer list `CORNERMEX_COMMERCE_MODEL` in `errors` (it may still return `503` if the subsequent Supabase reachability check fails — that would be a _new_, separate, currently-unknown finding, not this one).

## Risk assessment

- **Blast radius:** staging only, by construction (per-environment variable scoping, confirmed).
- **Reversibility:** high — a variable value revert plus a restart, no data migration or schema change involved.
- **Unknowns carried forward:** whether Supabase is actually reachable from staging once the schema check passes; production's current variable presence/values (not re-probed this sprint). Resolved in CM-RDY-0A: `ab629441` reached `SUCCESS` and its health/readiness are now confirmed live (see above) — the readiness blocker is unchanged from the prior deployment.

## Actions not performed in producing this document

No Railway variable create/update/delete; no deployment, redeploy, restart, or rollback; no Railway mutation of any kind; no Supabase write; no migration; no DNS change; no Lovable action; no payment, checkout, or commercial/product/inventory activation; no A3.2b execution; no customer/supplier/email/WhatsApp communication; no production activation; no Railway credential provisioning; no secret or variable value read, logged, or recorded.

## Remaining Founder decision required

Authorize (or decline) the staging-only `CORNERMEX_COMMERCE_MODEL` value correction described above and formalized in `docs/program/STAGING_READINESS_CHANGE_REQUEST.example.json`. No production decision is requested or implied by this document.
