# PR #8 Targeted Remediation Evidence

## Identity and scope

- Repository: `Conquereleven/corner-mex-uae`
- PR: `#8`
- Branch: `feature/a3-2b-execution-gate-hardening`
- Base: `13c9aa4a1fc87570dbf8180f87dc66ecc9bae5c2`
- Sonnet-reviewed old head: `2704eec978a80af8cd5f13c16c5ad5b25b1102be`
- New head: use the exact remote PR head recorded in the PR body and CI run for this evidence commit. A tracked file cannot contain the SHA of the commit that contains itself.
- PR remains draft; no merge was performed.

Only Sonnet findings F1, F2, and F3 were remediated. No production, Supabase, Railway, Lovable, DNS, payment, or other external runtime write was performed.

## F1: canonical rollback

`scripts/catalog/rollback.mjs` now uses only the canonical A3.2b relationships. Inside one explicit transaction it:

1. validates the execution UUID and locks the exact execution;
2. returns a verified no-op only when the execution is already `rolled_back` and has no dependent residue;
3. locks products joined through `catalog_import_product_ownership`;
4. records expected ownership, media, and review counts;
5. deletes `catalog_import_media_objects`, `catalog_import_reviews`, and `catalog_import_product_ownership` rows for the parameterized execution ID;
6. checks every dependent delete count;
7. deletes only the products proven owned by that execution;
8. changes the retained execution audit row to `rolled_back`;
9. verifies all scoped postconditions before commit;
10. rolls the transaction back on any error or count mismatch.

The integration test applies the platform prelude and these migrations in order:

1. `20260713222315_revoke_public_rls_auto_enable_execution.sql`
2. `20260714010000_commerce_foundation_a2.sql`
3. `20260714011000_private_admin_boundary_a2.sql`
4. `20260714012000_public_read_policy_boundary_a2.sql`
5. pending `20260716010000_catalog_import_foundation_a3_2b.sql`

It proves ownership/media/review deletion, exclusive product deletion, unrelated and execution-B product preservation, final `rolled_back` state, FK safety, malformed/unknown ID rejection, and safe repeated rollback. A regression guard rejects the obsolete `products.import_execution_id` and `media_objects` model.

## F2: synthetic preview classification

The preview now always emits:

```json
{
  "mode": "synthetic_fixture_preview",
  "evidenceClass": "NON_PRODUCTION_SYNTHETIC",
  "realDatabaseQueried": false,
  "eligibleAsExecutionEvidence": false
}
```

The explicit command is `catalog:rollback:preview:synthetic`. The old name remains a compatibility alias with identical output. Documentation and tests state that this is local format/scoping validation only, not readiness or A3.2b execution evidence.

## F3: PR narrative

The PR body was corrected to attribute the lockfile change to `pg@^8.16.3` and its PostgreSQL-test dependencies under Node 22/npm 10 compatibility. It no longer attributes the current lockfile diff to `lru-cache`. The PR body also describes the canonical rollback and synthetic preview classification.

## Validation

Focused and complete local validation passed:

- synthetic rollback preview classification;
- catalog rollback unit tests;
- canonical PostgreSQL 17 rollback integration test;
- A2, A3, A3.2a, A3.2b, and CM-2A/catalog tests and validators;
- migration ownership, canonical types, application references, schema authority, and canonical migration replay;
- `typecheck`, Cloudflare build, Railway build, and browser-secret scan;
- PR #9 remediation regressions, privacy, lint-changed, DB1 custody, and static activation-readiness validation.

The GitHub CI result and exact new remote head are recorded in the PR body/final handoff after push. Residual risk is limited to independent Sonnet rereview and CI confirmation of the exact pushed/proposed-merge heads. Production readiness remains blocked by its existing live-preflight and independent-review gates.

## Files changed

- `scripts/catalog/rollback.mjs`
- `tests/catalog/rollback-postgres.test.mjs`
- `tests/catalog/remediation.test.mjs`
- `package.json`
- `docs/activation/a3-2b/rollback.md`
- this evidence report
- PR #8 body on GitHub

## Safety confirmation

- Zero production actions.
- Zero remote Supabase/Railway/Lovable/DNS/payment writes.
- No merge, force push, destructive reset, clean, restore, stash, or rebase.
- The pre-existing local `main/package-lock.json` modification was isolated from this worktree and preserved unchanged.
