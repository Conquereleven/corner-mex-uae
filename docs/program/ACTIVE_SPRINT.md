# Active Sprint: CM-RDY-0 — Post-Merge Reconciliation + Staging Readiness Evidence

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/staging-readiness-evidence`
- Base: `73790cb3724fc1f19bedd157fc237f07a46e4314` (PR #12 merge SHA)
- Status: evidence gathered and documented; independent review pending; no repair executed

## PR #12 closure

PR #12 (`feat: add Railway governance comparator and activation safeguards`, head `2d3d45501c63983c2a0639088fd71dc0083da5e7`) was independently reviewed (Sonnet: `APPROVE_WITH_LOW_FINDINGS`), merged by the repository owner as merge commit `73790cb3724fc1f19bedd157fc237f07a46e4314`. `origin/main` confirmed at this exact SHA before this sprint began.

## Post-merge Railway observation (read-only)

- Staging (`cornermex-web`, service `5a6b85da-3156-4fc1-828d-ec9e4019de7e`): the merge auto-triggered a new deployment (`ab629441-4104-4b9c-b65d-66eafa6ba1af`, source `73790cb`), as the governance model intends. It was still `QUEUED` at evidence-collection time — not yet confirmed `SUCCESS`. The currently live staging instance (confirmed via a direct `GET /api/health`) is still the prior deployment (`7051fc17`, commit `a173dfc6`).
- Production (`corner-mex-uae`, service `6702af28-5689-46fb-8896-b5a8b1fbba94`): confirmed unchanged — still deployment `bac2a5b3-0b8a-4243-8046-531113a4ca18` at source `d470b7b57f6d625a7d60337ad16a59080c1bb37d`. No new deployment, restart, or rollback.
- Zero Railway writes performed by this sprint or observed as a side effect of the merge beyond the expected staging auto-deploy.

## Staging readiness — corrected finding

Live `GET /api/health` → `200 ok`. Live `GET /api/ready` → `503`, body `{"missing":[],"errors":["CORNERMEX_COMMERCE_MODEL"]}`.

This **corrects** the readiness label carried in prior program-state documents (`degraded_missing_CORNERMEX_COMMERCE_MODEL`). Read-only variable-name discovery (names only, no values requested or received) confirms `CORNERMEX_COMMERCE_MODEL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` are all **present** in staging. The actual blocker, per `src/config/commerce-env.ts`, is that `CORNERMEX_COMMERCE_MODEL`'s current value does not satisfy the schema's exact literal (`single_merchant_with_internal_supplier_network`) — an `errors` case, not a `missing` case. Full detail in `docs/program/STAGING_READINESS_EVIDENCE.md`.

## This sprint's work

1. Reconciled durable state (`CURRENT_STATE.json`) to the real PR #12 merge SHA and the corrected readiness finding above.
2. Documented the exact code-level health/readiness contract (`docs/program/STAGING_READINESS_EVIDENCE.md`), sourced only from `src/routes/api/{health,ready}.ts` and `src/config/commerce-env.ts` — not inferred from variable names.
3. Built a sanitized variable-presence matrix (names only, never values) for staging.
4. Authored a non-executable staging change-request contract (`docs/program/STAGING_READINESS_CHANGE_REQUEST.schema.json` + a `pending_founder_decision` example) proposing the minimal staging-only correction, with no value invented — the required value is already the literal defined in code.
5. Added a validator + focused tests enforcing: production targets rejected, missing Founder decision blocks approval, unknown variables rejected, off-contract values rejected, invalid/mismatched main SHA rejected, stale evidence rejected, degraded health blocks approval, an explicit readiness-verification step is required in the validation plan, `valuesRedacted` must be `true`, and `executionStatus` can never leave `not_executed`.

## Exit checklist

- [x] Verify `origin/main` matches the exact expected merge SHA before starting.
- [x] Work in an isolated worktree/branch; leave the primary checkout's stash and untracked evidence untouched.
- [x] Observe staging/production post-merge state, read-only.
- [x] Re-verify staging readiness live rather than propagate a prior claim; correct it where evidence disagreed.
- [x] Build the sanitized variable matrix (names only).
- [x] Produce the evidence artifact and the non-executable change-request contract.
- [x] Add focused tests; run full local validation once.
- [ ] Obtain independent review of this exact branch head.
- [ ] Obtain Founder authorization for the proposed staging-only value correction (separate from this sprint).
- [ ] Execute the staging variable correction (separate, later, separately authorized sprint).
- [ ] Re-verify staging readiness live after that correction.

## Explicitly not executed

No Railway variable create/update/delete; no manual deployment, redeploy, restart, or rollback; no Railway mutation; no Supabase write; no migration; no DNS change; no Lovable action; no payment, checkout, or commercial/product/inventory activation; no A3.2b execution; no email/WhatsApp/customer/supplier communication; no production activation; no Railway credential provisioning.
