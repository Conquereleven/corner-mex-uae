# Migration Hygiene — Proposal

**Date:** 2026-09-20 · **Canonical DB2:** `wlrfknmrhowldygmvtvn`
**Nothing in this document has been applied to any database.** Items 1 and 2 are
done in the repository; items 3–5 need Founder approval before execution.

---

## 1. `cm_mcp_db2_read_boundary` moved out of the active path — DONE (repo only)

`20260822050535_cm_mcp_db2_read_boundary.sql` sat in `supabase/migrations/`, so a
routine `supabase db push` would have applied it, although
`docs/mcp/CM-MCP-3-DB-PROPOSAL.md` states it is "not applied to production".

Verified read-only on 2026-09-19: `commerce_private.mcp_grants` **does not
exist** in DB2, confirming it was never applied.

Moved to `supabase/pending-canonical/` (the existing home for merged-but-
unauthorised canonical work), with the ownership contract, the active-extension
contract and `REQUIRED_PENDING` in `validate-migration-ownership.mjs` updated in
the same change. All schema-authority validators pass.

**If it is ever approved**, its version (`20260822050535`) predates applied
migrations, so it must be re-timestamped after the newest applied version rather
than applied out of order.

## 2. New launch-hardening migrations declared as unapplied — DONE (repo only)

`20260919120000_cm2_release_stock_on_cancellation.sql` and
`20260919121000_cm2_cod_order_idempotency.sql` are declared in
`contracts/canonical-active-migration-extensions-v1.json` with
`productionApplied: false` and a Founder production gate. See §5 for how to
apply them.

## 3. The inventory-consistency hotfix has no ledger row — PROPOSAL

`20260810120000_place_cod_order_v1_inventory_consistency.sql` is in the
repository and its function body **is live in DB2**, but
`supabase_migrations.schema_migrations` has no row for it: it was applied
out-of-band under `docs/program/CM-COM-3A1_HOTFIX_RUNBOOK.md`.

Evidence that the repository file and production agree, gathered 2026-09-19:
replaying every repository migration into a disposable PostgreSQL and comparing
`md5(pg_get_functiondef(...))` with production gives **an exact match** for
`place_cod_order_v1` (`abc6581882992ed5693257d9cb5c4fe6`).

**Proposed, in order:**

1. Re-run the comparison above and record the digest as evidence.
2. Insert the missing ledger row inside a transaction that first asserts it is
   absent. This executes **no DDL** — it only records what is already true:

   ```sql
   begin;
   do $$
   begin
     if exists (select 1 from supabase_migrations.schema_migrations
                where version = '20260810120000') then
       raise exception 'LEDGER_ROW_ALREADY_PRESENT';
     end if;
   end $$;
   insert into supabase_migrations.schema_migrations (version, name, statements)
   values ('20260810120000', 'place_cod_order_v1_inventory_consistency',
           array[ <the file's contents, verbatim> ]);
   commit;
   ```

3. Re-run `npm run test:canonical-migration-replay` against a fresh disposable
   PostgreSQL.

**Lower-risk alternative:** leave DB2 untouched and record the out-of-band
application in the extension contract (`appliedOutOfBand: true` plus an evidence
pointer). Replay tooling that trusts the ledger would still see the gap.

## 4. Seven applied migrations are recorded as unapplied — PROPOSAL

`contracts/canonical-active-migration-extensions-v1.json` marks these
`productionApplied: false`, but DB2's ledger shows all seven applied. Versions
read directly from `supabase_migrations.schema_migrations` (2026-09-19, and
re-read 2026-09-20):

| File                                                           | Applied version in DB2 |
| -------------------------------------------------------------- | ---------------------- |
| `20260823023904_cm_b2b_ops_foundation_1.sql`                   | 20260912110525         |
| `20260823040000_cm_b2b_portal_1a_boundary.sql`                 | 20260912181132         |
| `20260823041625_cm_b2b_portal_1b_pricing_availability.sql`     | 20260912181756         |
| `20260828170741_cm_int_zoho_1_zero_touch_order_invoice.sql`    | 20260912183600         |
| `20260828180000_cm_pay_stripe_1_payment_foundation.sql`        | 20260912184118         |
| `20260912080845_intermex_go_live_2_operational_boundaries.sql` | 20260912185327         |
| `20260914114744_intermex_po_automation_1.sql`                  | 20260914133036         |

`validate:migration-ownership` passes today because it never compares the
contract with the database; it only cross-checks a hard-coded allowlist
(`EXPECTED_EXTENSION_PRODUCTION_MIGRATIONS`) that also omits these seven.

**Not changed here on purpose.** Marking them applied means adding them to that
allowlist, which asserts "verified in production" inside a governance control.
That assertion should carry Founder sign-off rather than an agent's read.

**Proposed:** update the contract entries with the versions above and add the
same seven to the validator allowlist, in one reviewed change; then add an
opt-in `--against-db` mode that reads `schema_migrations` read-only and fails on
any contract ↔ ledger mismatch, so this class of drift cannot recur silently.

## 5. Applying the two launch-hardening migrations — PROPOSAL

Both are additive: they create `cm_release_order_stock_v1` and
`cm_create_cod_order_v2`, and re-create `admin_transition_order_lifecycle_v1`
with one added call. No table, column or existing function is dropped or
altered, and `place_cod_order_v1` is untouched.

`admin_transition_order_lifecycle_v1` is re-created verbatim from
`20260812180442_cm_com_4a_post_order_lifecycle.sql` plus the guarded call. Its
production definition was compared with that file line by line and differs only
in **two comment lines** (production carries none); the executable code is
identical, so replacing it changes behaviour only by the added call.

**Order matters:**

1. Apply `20260919120000` then `20260919121000` to DB2 (additive; safe while the
   currently deployed code keeps calling `place_cod_order_v1`).
2. Verify: `select count(*) from public.product_variants v join public.inventory i
on i.variant_id = v.id where v.stock <> i.quantity_on_hand;` must return `0`,
   and both new functions must be `service_role`-only.
3. Only then deploy the application. **Deploying the code first would break COD
   checkout**, because it calls `cm_create_cod_order_v2`.

Both are proven against a disposable PostgreSQL by
`npm run test:cm2:sql` (32 assertions, including a two-session concurrency test),
negative-controlled, and run in CI.
