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

Founder decisions unresolved; rollback owner unassigned; Railway source branch not verified; Lovable runtime and custom-domain metadata not independently verified. Therefore `readyForA3_2bReview` is false.

## Validation

- A1 contract and A2 migration validators passed
- A2: 7/7; A3: 29/29; A3.2a: 37/37
- rehearsal and reconciliation checksum: `4d2ce1a09e698cde442fc2148a78db329aba3bc520b135eedb644977c7a6a29c`
- privacy guard: clean across 32 changed files
- target clean evidence, readiness, callback, founder-decision, and static verifier gates passed with the expected blocked status
- scoped ESLint and `lint:changed`: zero findings/delta
- typecheck, Vite build, and Railway Node build passed
- `git diff --check`: passed
- global lint remains the documented inherited baseline: 4,773 findings; it is not increased by sprint-owned files

Build output retains pre-existing chunk-size and third-party directive warnings; neither build failed.
