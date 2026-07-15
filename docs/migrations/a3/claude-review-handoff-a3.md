# A3.1 Independent Review Handoff

## Review Decision

Review the branch `feature/production-migration-rehearsal-a3-1` without merging it. The retired Supabase project `ywyiejqnbyzjfatojvkh` is not a migration source. The canonical project `wlrfknmrhowldygmvtvn` is an empty greenfield baseline.

## Required Review Scope

- source inventory and target clean-state evidence;
- all 25 source-to-target decisions and exclusion assertions;
- JSON Schema alignment and deterministic validators;
- synthetic transformation, identity, money and reconciliation rules;
- privacy/secret guard coverage;
- Auth new-enrollment and Storage checksum strategies;
- performance-advisor classification;
- A3.2 activation sequence, objective rollback triggers and prohibitions.

## Safety Assertions

- no Supabase writes, migrations, Auth changes or Storage changes;
- no production Railway deploy, DNS switch or callback change;
- no legacy data invention and no PII in fixtures;
- products and variants remain inactive;
- commercial inventory remains zero;
- customers, orders, payments and reviews remain empty;
- seller/marketplace semantics, stock-50 and CornerOps planning stock-100 are excluded;
- the pull request remains unmerged until critical findings are resolved and founder authorization is recorded.

## Reproduce

```bash
npm run test:alignment
npm run validate:a2-migration
npm run test:a2
npm run validate:a3:inventory
npm run validate:a3:mapping
npm run test:a3
npm run rehearse:a3
npm run reconcile:a3
npm run privacy:a3
npm run verify:a3:target-clean
npx eslint scripts/a3/*.mjs tests/a3/*.mjs
npm run lint:changed
npm run typecheck
npm run build
npm run build:railway
git diff --check
```

`eslint .` is not a release gate for this branch because the repository baseline currently contains thousands of unrelated historical formatting findings. A3 files pass targeted ESLint, and changed tracked files do not increase the established baseline.

## Expected Evidence

- mapping coverage: 100%, 25 decisions;
- A2 tests: 7 passing;
- A3 tests: 10 passing;
- rehearsal checksum: `6762fc8586df77c10cf9ea2eb38928e3ab389e13f4491faa6975cdc9b507b5d4`;
- duplicate/orphan counts: zero;
- inventory: zero;
- privacy guard: clean;
- TypeScript and both builds: passing.
