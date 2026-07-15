# Acceptance A3.1

Status: `a3_1_remediation_ready_for_claude_rereview`

## Decision Change

The founder confirmed that legacy project `ywyiejqnbyzjfatojvkh` no longer exists and `wlrfknmrhowldygmvtvn` is the canonical CornerMex home. A source-to-target production migration is therefore impossible and unnecessary. A3.1 validates a greenfield activation from the empty A2 baseline and never fabricates legacy rows.

## Baseline

- CornerMex base: `255e7fcb40b6ecb7e6b5928e16d3b2442c735fe5`
- CornerOps main: `a8a751bdbaf2b12fef3f94c83769bac52fffbaad`
- Canonical Supabase: `wlrfknmrhowldygmvtvn`
- Railway staging: `CornerMex UAE/staging/cornermex-web`
- Shared contract checksum: `b87acfbdeac1427e141677616a0d8fbda5ecabc10a4c84012a9bd5d8bc98249a`

## Canonical State

- Project status: `ACTIVE_HEALTHY`
- PostgreSQL: 17
- Public tables: 20
- RLS tables: 20
- Policies: 37
- Schema fingerprint: `ffce61d5cca7d6e92699f72f4e593bb1`
- Auth users: 0
- Storage buckets/objects: 0/0
- Products, inventory, orders, payments and reviews: 0
- Rehearsal schemas: 0
- Security Advisor findings: 0
- Performance Advisor: classified in the A3 performance plan; no migration applied

## Rehearsal

- Fixture: deterministic synthetic catalog only
- Products/variants: inactive
- Inventory: zero
- Customers/orders/payments/reviews: zero
- Identity mapping: deterministic namespaced UUIDs
- Money: AED integer minor units; no FX
- Foreign keys: reconciled
- Duplicate/orphan counts: zero
- Output: in-memory/stdout only, never inserted
- Determinism and idempotency: verified by checksum

## Safety

- Canonical database writes: none
- Auth or Storage changes: none
- Migrations or hardening changes applied: none
- Production Railway deployment/DNS/callback changes: none
- Lovable production: unchanged
- CornerOps runtime/write boundary: unchanged
- Checkout, payments, sends, product activation, imports and sync: disabled
- PII/secrets committed: none

## Independent Review Gate

Claude Code must review the mapping, synthetic transformations, privacy guard, performance classification, Auth/Storage strategies and A3.2 activation/rollback runbook. This PR must not be merged until critical findings are resolved and founder authorization is recorded.

## Validation Results

- A1 contract validation: pass
- A2 migration validator: pass
- A2 tests: 7/7 pass
- A3 inventory and mapping validators: pass
- A3 tests: 29/29 pass, including malformed mappings, prohibited domains, invalid money, identity collisions, reordered fixtures and privacy canaries
- Targeted A3 ESLint and changed-file lint: pass
- TypeScript: pass
- Vite production build: pass
- Railway Node build: pass
- `git diff --check`: pass
- Privacy/secret guard: pass across the full changed-file set, including untracked artifacts, with no matched value disclosed
- Clean-state command: validates only committed, expiring evidence and explicitly reports that no live query occurred
- Full `eslint .`: not a usable gate because the repository baseline contains unrelated historical formatting debt; A3 adds no lint regression

## Read-Only Platform Verification

- Supabase `wlrfknmrhowldygmvtvn`: `ACTIVE_HEALTHY`, PostgreSQL 17, four existing migrations unchanged
- Public schema: exact 20 tables, all RLS enabled, all row counts zero
- Auth users, Storage buckets/objects and `a3_rehearsal_*` schemas: zero
- Security Advisor: zero findings; existing performance findings remain documented for A3.2 review
- Railway: existing `CornerMex UAE/staging/cornermex-web` deployment online; root, health and readiness returned HTTP 200
- CornerOps: local `main` clean; no target connection, writes or OpenClaw calls
- Platform mutations performed by A3.1 remediation: none

Review packet: `docs/migrations/a3/claude-review-handoff-a3.md`.
