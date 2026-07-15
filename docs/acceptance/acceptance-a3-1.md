# Acceptance A3.1

Status: `a3_1_blocked_by_source_access`

## Baseline

- CornerMex main: `255e7fcb40b6ecb7e6b5928e16d3b2442c735fe5`
- CornerOps main: `a8a751bdbaf2b12fef3f94c83769bac52fffbaad`
- Active Supabase: `ywyiejqnbyzjfatojvkh`
- Target Supabase: `wlrfknmrhowldygmvtvn`
- Railway staging deployment: `75795c59-5c01-45f3-a64c-458b8fffd583`
- Shared contract checksum: `b87acfbdeac1427e141677616a0d8fbda5ecabc10a4c84012a9bd5d8bc98249a`

## Preflight Result

- Both repositories were clean and matched their expected main SHAs.
- A2 implementation and evidence PRs are merged.
- Railway `staging/cornermex-web` is online. The default Railway `production` environment has no service configuration.
- The target retains 20 public tables, 20 RLS-enabled tables, 37 policies, zero business rows, zero Auth users, zero Storage buckets and no `a3_rehearsal_*` schema.
- Target Security Advisor has no findings. Performance Advisor remains non-blocking and unchanged in category.
- The active project ref in the local CornerMex configuration matches `ywyiejqnbyzjfatojvkh`.

## Source Access Blocker

The authenticated Supabase connector can access `nhxpujypqxbjiqqddxqt` and `wlrfknmrhowldygmvtvn`, but not the active project. Metadata and aggregate SQL requests to `ywyiejqnbyzjfatojvkh` are rejected before execution with a permission error. The authenticated Supabase dashboard also redirects away from that project.

The production publishable key permits RLS-scoped HEAD counts for known public tables. Those counts are preserved in the sanitized inventory contract, but they do not prove complete production counts, hidden rows, schema metadata, Auth state, Storage state, policies, grants, functions, triggers, callbacks or integrity. `sellers` is inaccessible even through that public path.

A complete migration map, Auth strategy decision, Storage strategy decision and data reconciliation rehearsal would therefore rely on assumptions. The A3.1 stop conditions require stopping instead.

## Minimum Access Required

Provide a dedicated, temporary production database role or equivalent platform connection that is technically constrained to:

- read-only transactions;
- catalog/metadata reads;
- aggregate SELECT access needed for counts, duplicates, orphans and checksums;
- aggregate Auth/provider inspection without identities;
- aggregate Storage bucket/object inspection without object paths;
- no INSERT, UPDATE, DELETE, TRUNCATE, DDL, function execution, Auth mutation, Storage mutation or configuration mutation.

Do not paste credentials into GitHub, PRs, chat or documentation. Store any approved credential only in a local ignored secret file or an authenticated connector.

## Safety Proof

- Production database writes: none.
- Production migrations, functions, triggers, grants and policies changed: none.
- Production Auth or Storage changes: none.
- Production configuration, callbacks, DNS and secrets changed: none.
- Target schema or data changed: none.
- Railway deployments triggered: none.
- CornerOps runtime or data boundary changed: none.
- External sends, customer/supplier contact, Lovable and OpenClaw calls: none.

## Deferred Until Access Is Resolved

- complete active-source inventory;
- source-to-target migration map;
- Auth and Storage migration strategy selection;
- synthetic transformation and reconciliation tooling;
- performance hardening classification against live source evidence;
- A3.2 runbook revision;
- full A3.1 CI gates and review-ready PR.

