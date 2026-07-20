# Active Sprint: CM-GOV-2 — Governance Closure + Railway Live Drift Guard

- Owner: Codex
- Reviewer: Sonnet
- Branch: `ops/railway-live-drift-guard`
- Base: `a173dfc6d5b0d8b62710a1ce604d6df9ea63c373` (PR #11 merge SHA)
- Status: implementation complete; independent review pending

## PR #11 closure

PR #11 (`fix: require manual Railway production deployment`, head `153d88702d951d45bfae1a411a50eadfc29d0b40`) was independently reviewed (Sonnet: `APPROVE_EXACT_HEAD`), manually approved by a human reviewer bound to the exact head, and merged by the repository owner as merge commit `a173dfc6d5b0d8b62710a1ce604d6df9ea63c373`.

Post-merge, read-only observation confirmed the governance model worked exactly as designed:

- staging created a new deployment (`7051fc17-56f0-456a-b547-bbf2f468e489`) from the merge SHA, used `npm`, and passed its healthcheck;
- production created **no** new deployment and remains on its pre-merge deployment (`bac2a5b3-0b8a-4243-8046-531113a4ca18`, SHA `d470b7b57f6d625a7d60337ad16a59080c1bb37d`);
- no restart, rollback, or variable change occurred anywhere.

Staging and production intentionally run different source SHAs as a result. This divergence is the intended governance outcome, not drift — see `platforms.railway.note` in `docs/program/CURRENT_STATE.json` and the per-context comparison logic in `scripts/program/validate-program-state.mjs`.

## This sprint's work

Addresses Sonnet's residual findings (F1–F3) from the PR #11 review and builds the previously-missing live verification layer:

- **F1 (validator can only attest to the committed registry, never live Railway):** built `scripts/program/check-railway-live-governance.mjs`, a dependency-injectable, read-only comparator, wired into a separate `.github/workflows/railway-governance-drift.yml` (daily schedule + manual dispatch; PR-triggered runs stay static/fixture-only, no live credential). `docs/program/DEPLOYMENT_GOVERNANCE.md` now states this scope distinction near the top, not in a footnote.
- **F2 (Founder-decision-ID enforcement is procedural only):** added `docs/program/PRODUCTION_ACTIVATION_REQUEST.schema.json` + a deliberately-blocked `.example.json`, and `scripts/program/validate-production-activation-request.mjs`, which refuses to accept `authorizationStatus: "approved_not_executed"` unless every completeness element (Founder decision ID, exact SHA, green CI, green health, green readiness, `live_governance_verified`, usable rollback target, unexpired evidence) is genuinely present. This is a checkable policy artifact with no deployment executor.
- **F3 (missing negative tests):** added the four assertions Sonnet named (`DEPLOYMENT_CURRENT_SOURCE_DRIFT`, `DEPLOYMENT_CURRENT_RUNTIME_INVALID`, `DEPLOYMENT_ROLLBACK_HISTORY_INVALID`, `DEPLOYMENT_ROLLBACK_AVAILABILITY_INVALID`) to `tests/program/program-state.test.mjs`, plus a full fixture-based suite for the new live drift guard covering: verified match, production auto-deploy unexpectedly live, push/merge-shaped trigger, wrong repository, wrong branch, malformed/incomplete/non-object Railway responses, unreachable API, missing credential, staging/production identity swap, live SHA drift, and an unexpected production deployment. None call the network or require secrets.

Also added `scripts/program/assert-no-railway-writes.mjs`, a static scan rejecting any Railway write operation (`railway up/deploy/redeploy/restart/down`, known write mutations, the `mutation` keyword) inside the drift-guard scripts or workflow, run as its own CI step and its own test.

## Live credential posture

No dedicated Railway read-only credential exists yet. `RAILWAY_VIEWER_TOKEN` is required, must be Viewer-role only (no deploy, no variable-value access), and must be stored only as a GitHub Actions secret. Until it is provisioned, `live-drift-guard` runs on schedule/dispatch, honestly reports `live_governance_credentials_missing`, and fails closed (non-zero exit) rather than silently passing. This sprint does not add a broader existing token as a substitute.

## Exit checklist

- [x] Merge PR #11 at its exact reviewed head.
- [x] Verify staging deployed and production did not, read-only.
- [x] Create `ops/railway-live-drift-guard` from the merge SHA.
- [x] Declare validator scope (registry-only vs. live) near the top of `DEPLOYMENT_GOVERNANCE.md`.
- [x] Add the four missing negative tests plus the live-drift-guard and activation-request test suites.
- [x] Implement the read-only, dependency-injectable Railway Live Drift Guard.
- [x] Add the scheduled/dispatch-only GitHub Actions workflow with a sanitized job summary.
- [x] Add the declarative, non-executable production activation request contract.
- [x] Preserve the readiness block; add `docs/program/NEXT_READINESS_SPRINT.md` as an enumeration, not an execution.
- [ ] Obtain independent review of this exact branch head.
- [ ] Provision the dedicated `RAILWAY_VIEWER_TOKEN` credential (separate authorization, not part of this sprint).

## Explicitly not executed

No production deployment, restart, or rollback; no Railway configuration or variable change beyond what PR #11 already made; no Supabase write; no migration; no DNS change; no Lovable action; no payment, checkout, or commercial activation; no catalog/inventory change; no A3.2b execution; no external communication.
