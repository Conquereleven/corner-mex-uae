# Acceptance: CornerMex A3.2a

## Outcome

`a3_2a_valid_but_blocked`. Production was not activated and the branch must remain unmerged pending independent review.

## Baseline and evidence

- Base `origin/main`: `100bb57fc92938a0b803c088abf57a03fa1e8a27`
- Reviewed A3.1 head: `8891728d572ea1c69963440c2b3ef25f2111959b`; merged tree verified identical
- CornerOps main observed: `a8a751bdbaf2b12fef3f94c83769bac52fffbaad`; no target write/OpenClaw activation found
- Supabase: `wlrfknmrhowldygmvtvn`, healthy, 20/20 RLS, 37 policies, zero Auth/Storage/commercial state, four expected migrations
- Railway staging: project `06d2ecdd-3c03-4480-8299-48c539595a94`, service `cornermex-web`, deployment `f84f6c13-8003-4207-839f-d6ff3c0067d2`; root/health/readiness/asset HTTP 200
- No deployment, DNS, callback, Auth, Storage, data, payment, messaging, Lovable, OpenClaw, or production write was performed

## Implemented

- locale-independent codepoint sorting preserving checksum `4d2ce1a09e698cde442fc2148a78db329aba3bc520b135eedb644977c7a6a29c`
- strict readiness, callback, and founder-decision contracts and validators
- static/live verification separation with explicit no-live wording
- fail-closed environment flags and sanitized readiness capability output
- privacy canaries for Railway, OAuth, and email-provider credentials
- Auth, Storage, catalog/inventory, callbacks, founder decision, security, and A3.2b runbook documentation

## Current blockers

Eleven founder decisions remain unresolved; rollback owner is unassigned; Railway source branch is not verified; Lovable runtime and custom-domain metadata are not independently verified. Therefore `readyForA3_2bReview` remains derived as false.

## Founder decisions recorded

- Railway production environment: `approved_for_a3_2b_execution_only`, decided by Joel / Founder at `2026-07-15T15:21:27-06:00`. Execution has not occurred; no environment, deployment, variables, DNS, callbacks, checkout, payments, products, or inventory changed.
- Lovable rollback window: approved for 14 full days after a successful future A3.2b cutover. Cutover has not occurred, the rollback window has not started, and Lovable has not been modified or retired.

Pending decisions: custom domain/DNS timing, Auth bootstrap, Storage creation, first catalog batch, physical inventory verification, checkout, payment provider, email provider, customer communication, rollback owner, and observation window.

## Validation

- A1 contract and A2 migration validators passed
- A2: 7/7; A3: 29/29; A3.2a: 44/44
- rehearsal and reconciliation checksum: `4d2ce1a09e698cde442fc2148a78db329aba3bc520b135eedb644977c7a6a29c`
- privacy guard: clean across 32 changed files
- target clean evidence, readiness, callback, founder-decision, and static verifier gates passed with the expected blocked status
- scoped ESLint and `lint:changed`: zero findings/delta
- typecheck, Vite build, and Railway Node build passed
- `git diff --check`: passed
- global lint remains inherited technical debt; counts are environment-dependent and the authoritative inventory belongs to the separate L0 baseline. Sprint-owned files add no changed-file lint findings.

Build output retains pre-existing chunk-size and third-party directive warnings; neither build failed.
