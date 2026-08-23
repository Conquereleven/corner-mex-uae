# CM-B2B-OPS-PROD-READINESS-1 — B2B production migration gates

## Status and boundary

This is an auditable readiness package for a future authorized production window. It does not authorize or perform either migration, SQL mutation, live grant change, deployment, OAuth/MCP activation, Railway change, or synthetic production-data creation.

Canonical target: `wlrfknmrhowldygmvtvn`.

Repository baseline expected and observed before this branch was created: `d7117596581e01fd2c752873363d58576f14ab54`. The expected baseline was exactly `origin/main`, so there was no baseline discrepancy.

Read-only production evidence captured at `2026-08-23T04:19:29Z` confirmed:

- latest ledger row `20260823004146 sec_rls_1_b2b_private_rls`;
- both target migration names absent from the ledger;
- all inspected prerequisite schemas, relations and `public.set_updated_at()` present;
- all six foundation relation names and `public.b2b_portal_v1(text,uuid,jsonb)` absent;
- `commerce_private` owned by `postgres` and required application roles present;
- 16 current security-advisor findings before either gate.

That snapshot is evidence of readiness work, not a substitute for a fresh preflight in the authorized window.

## Exact artifacts and mandatory order

| Gate | Source artifact                                                    | Migration name              | SHA-256                                                            |
| ---- | ------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------ |
| A    | `supabase/migrations/20260823023904_cm_b2b_ops_foundation_1.sql`   | `cm_b2b_ops_foundation_1`   | `68a715a13ac27c59e8d397ccb4f0179556608e84ea8a081929d5132e5fc7cbb0` |
| B    | `supabase/migrations/20260823040000_cm_b2b_portal_1a_boundary.sql` | `cm_b2b_portal_1a_boundary` | `130430bf58e80e1af6ba0accf9679f38977c5e65273e33a2670f1102c0d07852` |

The order is mandatory: Gate A, successful commit, complete Gate A postflight green, then a new Founder authorization, then Gate B. Gate B references all six Gate A tables and cannot be created or exercised safely before them. No aggregate authorization and no authorization carryover are valid.

Before either gate, recompute the SHA-256 from the reviewed checkout and compare it byte-for-byte with this table and `contracts/cm-b2b-ops-prod-readiness-1.json`. A mismatch is a STOP.

## Gate A — Foundation apply

1. Record target project ref, operator, UTC time, reviewed repository HEAD, artifact filename, migration name and recomputed SHA-256.
2. Obtain the Gate A-specific Founder command shown below. It authorizes Gate A only.
3. Run `docs/b2b/sql/gate-a-foundation-preflight.sql` through an approved read-only query path. Retain both result sets. Every check must be `green`.
4. Run fresh security advisors and retain the complete response as the before-Gate-A baseline.
5. In the separately authorized execution task, apply only the exact Gate A bytes through the canonical migration mechanism. This readiness task does not perform or simulate that action.
6. If the apply reports an error, times out, or has an uncertain transaction outcome, stop. Resolve ledger and catalog state read-only before deciding anything else.
7. Run `docs/b2b/sql/gate-a-foundation-postflight.sql`. Retain all summary, FK and constraint rows.
8. Run fresh security advisors and compare stable finding identities with the immediate pre-apply set.
9. Declare Gate A postflight green only when all checks, FK targets, constraints and advisor delta match the contract. Otherwise stop; Gate B remains forbidden.

Gate A proves:

- all six `commerce_private` foundation tables exist and are owned by `postgres`;
- RLS is enabled and forced on every table;
- there are zero policies and zero direct grants to `PUBLIC`, `anon`, `authenticated` or `service_role`;
- all nine foreign keys target the existing canonical accounts, `auth.users` and `public.product_variants` identities encoded by the migration;
- pricing, saved-list quantity/order and inventory-policy constraints are present and validated;
- six update triggers use the existing `public.set_updated_at()` function;
- no portal RPC exists yet and the existing commerce/B2B RPC fingerprints remain unchanged.

The forced-RLS/no-policy posture is intentionally stricter than the older private-table pattern from SEC-RLS-1. Direct browser/app-role access is denied. Revoking `service_role` table grants also ensures this package creates no service-role table path; the application code separately contains no browser service-role credential.

## Gate B — Portal boundary apply

Gate B may begin only after Gate A postflight is explicitly recorded green. The Founder must then issue a new Gate B-specific authorization; the Gate A command is invalid for Gate B.

1. Record the Gate A postflight evidence identifier and its green disposition.
2. Record the new Gate B Founder command, operator, UTC time, reviewed HEAD, exact artifact identity and recomputed SHA-256.
3. Run `docs/b2b/sql/gate-b-portal-boundary-preflight.sql` read-only. Every check must be `green`, and the existing RPC fingerprints must match the retained Gate A custody set.
4. Run fresh security advisors and retain the immediate pre-Gate-B set.
5. In the separately authorized execution task, apply only the exact Gate B bytes through the canonical migration mechanism.
6. On any error, timeout or uncertain transaction outcome, stop and resolve ledger/catalog state read-only.
7. Run `docs/b2b/sql/gate-b-portal-boundary-postflight.sql`. Every check must be `green`.
8. Run fresh security advisors and classify the delta.
9. Perform the non-destructive runtime smoke below. Any incomplete or failed smoke is a STOP and requires emergency-disable evaluation.

Gate B proves the exact `public.b2b_portal_v1(text,uuid,jsonb)` identity is owned by `postgres`, is `SECURITY DEFINER`, and fixes `search_path` to `pg_catalog, public, commerce_private`. `EXECUTE` must be false for `PUBLIC`, `anon` and `service_role`, and true only for `authenticated`.

The definition must retain `auth.uid()`, reject a null actor, and require both an active membership and active account for every account-scoped action. Account discovery must remain actor-filtered. Saved-list lookup must bind the list to `p_account_id`; reorder lookup must bind the order to the authenticated buyer. The six private tables must remain forced-RLS, policy-free and without direct application-role grants.

The RPC's only writes are bounded saved-list operations inside `commerce_private`. Its `orders` and `reorder_draft` actions are reads. It must not insert, update or delete orders, order items, payments, inventory, inventory movements or suppliers.

## Non-destructive runtime smoke after Gate B

Use an existing production user who already has an active B2B account membership. Do not create a user, account, membership, saved list, saved-list item, order or product for the smoke. Record response status and a redacted structural result only; do not copy customer data into the repository.

1. Anonymous boundary: invoke the RPC without an authenticated session. It must fail before data is returned because `anon` has no execute grant.
2. Account discovery: as the existing user, call action `accounts` with no account ID. It must return only that actor's active memberships.
3. Cross-account denial: using an existing account ID to which that user does not belong, call the read action `saved_lists`. It must return `CM_B2B_ACCOUNT_MEMBERSHIP_REQUIRED` and no data. Do not guess or enumerate IDs; use an operator-approved known negative fixture already present in production. If none exists, mark this step blocked rather than manufacture one.
4. Quick Order: choose an existing active SKU visible in the canonical catalogue and call action `search` with a bounded query and limit. Confirm every returned product/variant is active and the response contains read-only availability. Do not add an item or submit an order.
5. Saved Lists: for the user's existing active account, call action `saved_lists`. An empty list is a valid green response. If lists exist, confirm only lists for that account are returned. Do not call `create_list`, `rename_list`, `add_item`, `set_quantity`, `remove_item` or `reorder_items` during this production smoke.
6. Reorder boundary: call action `orders`, choose one existing order returned for the same authenticated buyer, and call `reorder_draft`. Confirm it returns an intent/eligibility view and the notice that no order is recreated. If the user has no existing order, record `blocked_no_existing_order`; do not create one. The runtime smoke is not fully green until an existing qualifying order can be checked in a separately authorized observation.
7. Compare relevant order, payment and inventory audit/telemetry before and after the read calls. There must be no mutation attributable to the smoke and no service-role credential in the browser path.

The production UI may be used to verify route rendering, loading/error behavior and the three read surfaces, but no control that writes a saved list or cart draft should be submitted during this smoke.

## Rollback and emergency disable strategy

No rollback in this plan drops a table or discards customer data.

### Transaction failure before commit

Treat the migration mechanism as transactional but verify rather than assume. On a reported error or uncertain outcome:

- stop the sequence immediately;
- do not retry and do not proceed to the next gate;
- read the ledger and catalogs to distinguish full rollback, commit, or uncertain state;
- preserve error/output evidence;
- require a new reviewed remediation and new Founder authorization before any retry.

If the transaction rolled back, no schema rollback is needed. Partial object presence is unexpected and a STOP requiring investigation.

### Gate A post-commit semantic mismatch

Do not drop or truncate any foundation table. Because Gate A creates no RPC and grants no application role access, the minimum containment is to keep Gate B unapplied and the private tables unreachable. If catalog evidence shows an accidental direct privilege or weakened RLS posture, prepare a new, separately reviewed and authorized containment transaction that re-enables/forces RLS and revokes table privileges from `PUBLIC`, `anon`, `authenticated` and `service_role`. Preserve all table data. Use a forward-fix migration for semantic correction.

### Gate B post-commit semantic mismatch

The minimum emergency stop is to revoke `EXECUTE` on the exact identity `public.b2b_portal_v1(text,uuid,jsonb)` from `PUBLIC`, `anon`, `authenticated` and `service_role`. Do not drop the function or underlying tables, and do not delete saved-list data. This revoke is itself a production mutation and requires an explicit emergency authorization; this package only defines it.

Proposed emergency statement, not executed by this task:

```sql
revoke all on function public.b2b_portal_v1(text, uuid, jsonb)
  from public, anon, authenticated, service_role;
```

After disablement, confirm the role matrix is false for all four roles, retain the function definition and data, diagnose the mismatch, and ship a reviewed forward-fix migration. Re-enable only `authenticated` after a new postflight and new authorization.

## Security advisors

Run fresh security advisors immediately before and after each gate, retaining the complete machine response and comparing findings by stable identity rather than only counts.

The captured baseline has:

- four `INFO rls_enabled_no_policy` findings, three of them the previously accepted `commerce_private` SEC-RLS-1 private-table posture;
- eleven `WARN authenticated_security_definer_function_executable` findings for existing reviewed RPCs;
- one unrelated existing `WARN auth_leaked_password_protection` project setting finding.

Expected Gate A delta: six new `INFO rls_enabled_no_policy` findings, exactly one for each new forced-RLS/no-policy foundation table. They are acceptable only when the Gate A postflight also proves zero policies, zero application-role table grants and forced RLS.

Expected Gate B delta: one new `WARN authenticated_security_definer_function_executable` for exactly `public.b2b_portal_v1(text,uuid,jsonb)`. It is acceptable only when the postflight proves the exact owner/search path, authenticated-only execute posture, internal `auth.uid()` and active-membership checks, and absence of forbidden commerce writes.

Unexpected and therefore STOP findings include any new table without RLS, any additional new SECURITY DEFINER function, any `PUBLIC`/`anon`/`service_role` execute exposure, mutable or missing search path, direct private-table exposure, unexpected policy, or any severity increase/change outside the two exact deltas. A changed pre-existing finding also requires review; do not dismiss it because a similarly named finding was already accepted.

## STOP conditions

Stop immediately when any of the following occurs:

- target project ref, reviewed HEAD, filename, migration name, source version or SHA-256 differs;
- either target name is unexpectedly present in the ledger at its preflight;
- an expected schema, role, relation, column, owner or function is absent or incompatible;
- a target relation, trigger, index or function name collides before its gate;
- any preflight row is `STOP`;
- apply error, timeout or uncertain transaction outcome;
- any Gate A postflight row, FK target, constraint, grant, owner, RLS/policy posture or RPC custody comparison is not green;
- Gate B is requested before Gate A postflight green or without a new separate Founder authorization;
- any Gate B function identity, owner, security mode, search path, grant, membership check or no-mutation assertion differs;
- any fresh advisor delta is not exactly classified;
- runtime smoke exposes another account, returns unauthenticated data, uses a browser service role, mutates an order/payment/inventory record, requires synthetic data, or cannot be completed with existing eligible data;
- evidence cannot establish whether production changed.

## Founder authorization commands

These are distinct commands. Neither is authorized by this readiness PR, and neither authorizes merging this PR.

Gate A only:

```text
AUTORIZO GATE A FOUNDATION APPLY EN wlrfknmrhowldygmvtvn DEL ARTEFACTO 20260823023904_cm_b2b_ops_foundation_1.sql SHA256 68a715a13ac27c59e8d397ccb4f0179556608e84ea8a081929d5132e5fc7cbb0; EJECUTA SOLO GATE A, EXIGE PREFLIGHT GREEN Y DETENTE TRAS SU POSTFLIGHT.
```

Gate B only, and valid only after Gate A postflight green:

```text
AUTORIZO GATE B PORTAL BOUNDARY APPLY EN wlrfknmrhowldygmvtvn DEL ARTEFACTO 20260823040000_cm_b2b_portal_1a_boundary.sql SHA256 130430bf58e80e1af6ba0accf9679f38977c5e65273e33a2670f1102c0d07852; ESTA AUTORIZACION NUEVA SOLO ES VALIDA DESPUES DE GATE A POSTFLIGHT GREEN; EJECUTA SOLO GATE B Y DETENTE SI PREFLIGHT, POSTFLIGHT O RUNTIME SMOKE NO SON GREEN.
```

## Evidence record required from a future window

For each gate retain: authorization text and timestamp, operator, project ref, reviewed HEAD, recomputed checksum, full preflight output, immediate pre/post advisor exports, migration mechanism result, ledger runtime version/name, full postflight output, STOP disposition, and whether emergency disable was required. Gate B additionally retains redacted runtime-smoke structure and confirms no synthetic production data and no order/payment/inventory mutation.
