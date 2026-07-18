# PR #8 Post-Main-Update Sonnet Review Packet

## Review target

- Repository: `Conquereleven/corner-mex-uae`
- PR: `#8`
- Branch: `feature/a3-2b-execution-gate-hardening`
- Original base: `06d1c71d56a4e343dfeda4eaff28b2a7dba828d1`
- Current base: `13c9aa4a1fc87570dbf8180f87dc66ecc9bae5c2`
- Original head: `c2058c32ec08eaf4b5da8e0f53fb98b13923e4ef`
- Strategy: non-destructive merge of current `main` into the PR branch
- Backup ref: `backup/pr8-c2058c32-before-main-13c9aa4`

Review the exact remote PR head and GitHub-generated proposed merge commit. Do not accept a pasted head or a branch checkout as a substitute for those identities.

## Conflicts resolved

1. `.github/workflows/ci.yml`: retained PR #9 schema-authority and merged-tree jobs; added the combined A3.2b test and readiness gates with disposable PostgreSQL.
2. `package.json`: retained current Vite/Lovable versions and all PR #9 governance scripts; restored the complete A3.2b command surface.
3. `package-lock.json`: started from current `main` and regenerated mechanically from the combined manifest.

## Semantic remediation

- The A3.2b migration remains quarantined at `supabase/pending-canonical/20260716010000_catalog_import_foundation_a3_2b.sql`.
- No Lovable DB1 migration returned to `supabase/migrations`.
- A3.2b RLS references now use `commerce_private.is_admin(auth.uid())`; `public.is_admin()` is rejected by the focused test.
- Migration ownership evidence was regenerated rather than manually editing checksums.
- Railway verification no longer defaults to the historical base commit. It requires an explicit full expected SHA and fails closed otherwise.
- The merged-tree gate includes A3.2b tests and readiness checks in addition to PR #9 governance and schema replay.

## Invariants to verify

- Active canonical migrations: 4.
- Pending canonical migrations: 1.
- Quarantined Lovable DB1 migrations: 42.
- Canonical generated types and schema fingerprint continue to match the active migration set.
- Browser output contains no production credentials or service-role secret.
- Catalog preview remains 190 total: 148 ready, 41 review, 1 missing media.
- Catalog import, inventory publication and customer-facing activation remain disabled.
- Readiness remains blocked until fresh live preflight and independent review are true.

## Adversarial expectations

The test and validation surface must fail closed for stale source identity, wrong canonical project, package/lock drift, missing or public admin helper, active DB1 migration leakage, stale generated types, missing rollback evidence, unsupported media validation claims, incomplete founder decisions, browser secrets and a substituted branch head.

## Reviewer commands

```bash
npm ci
npm run test:a3-2b
npm run validate:a3-2b:decisions
npm run validate:a3-2b:readiness
npm run validate:schema-authority
npm run validate:migration-ownership
npm run validate:canonical-types
npm run validate:application-schema-references
npm run test:canonical-migration-replay
npm run test:pr9-remediation
npm run privacy:a3
npm run lint:changed
```

The database rollback test and proposed-merge verification require disposable PostgreSQL. No production platform write is authorized.
