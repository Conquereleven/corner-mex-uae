# CM-COM-3A — Commercial Active Activation Runbook

Prepared, **not executed**. This sprint performed no production write, no
deployment, no migration application and no catalog load.

Every step below requires explicit Founder authorization at the time it is run.
The repository is ready for commercial activation; production is **not**
commercially active.

## Founder-attested configuration used by this sequence

- Legal selling entity: **RodMor TradeCo LLC**; VAT registered; TRN
  `105514792800001`; VAT rate **5%**.
- COD delivery rates (AED): Dubai 15, Abu Dhabi 15, Sharjah 20, Ajman 20,
  Umm Al Quwain 20, Ras Al Khaimah 20, Fujairah 20 — all seven emirates.
- Opening stock policy: source `AVAILABLE` → `1`, `SOLD_OUT` → `0`,
  `UNKNOWN` → `0`. No quantity above 1 is ever invented.
- CornerMex price mirrors the current public effective Intermex price, no markup.

## Sequence

1. Verify the reviewed, merged `main` exact SHA and that CI is green on it.
2. Fresh **read-only** production schema and runtime preflight (tables, row
   counts, health, current serving commit).
3. Apply the exact reviewed COD transactional migration
   (`supabase/pending-canonical/20260809010000_place_cod_order_v1.sql`), then
   move it into `supabase/migrations/` and update the migration-ownership
   contract in the same authorized change.
4. Re-crawl the Intermex public catalog and regenerate the manifest
   (`node scripts/cm-com-3a/ingest-intermex-catalog.mjs --report`) so prices and
   availability are current at load time, not at review time.
5. Validate the manifest and produce the dry-run plan
   (`npm run validate:cm-com-3a:manifest -- <manifest.json> --plan`). The
   validator rejects any `initial_stock` outside the Founder policy.
6. Load the approved plan. Products are created `active`; variants carry the
   policy stock (1 for available, 0 otherwise).
7. Verify rows, stock and read policies: products active, variants active with
   the intended stock, public read works anonymously.
8. Configure the COD commercial environment on the production service:
   `CORNERMEX_COMMERCE_ACTIVE_MODE=cod`,
   `CORNERMEX_COD_SUPPORTED_EMIRATES=DU,AD,SH,AJ,UQ,RK,FU`,
   `CORNERMEX_VAT_RATE=0.05`, `CORNERMEX_VAT_TRN=105514792800001`, and
   `CORNERMEX_COD_SHIPPING_RATES_JSON` only if the Founder-approved defaults are
   being overridden. Any incomplete rate table fails closed.
9. Deploy the reviewed `main` with **`CHECKOUT_ENABLED` still false** (both
   `CORNERMEX_CHECKOUT_ENABLED` and `VITE_CORNERMEX_CHECKOUT_ENABLED`).
10. Smoke the read-only surfaces: `/shop`, a product page, cart, login,
    `/checkout` (must still refuse to execute).
11. Confirm `/api/ready` still reports checkout execution disabled.
12. Set **`CORNERMEX_CHECKOUT_ENABLED=true` and
    `VITE_CORNERMEX_CHECKOUT_ENABLED=true` LAST**, after every step above, and
    redeploy so the client flag takes effect.
13. Founder places one real COD test order in one emirate.
14. Verify: order row, order items, `payment_method=cod` / `payment_status=pending`,
    stock decrement, inventory movement, per-emirate shipping, 5% VAT, total, and
    the confirmation page.
15. Declare `COMMERCIAL_ACTIVE` and record the exact deployed SHA in
    `CURRENT_STATE.json` and `DEPLOYMENT_REGISTRY.json`.

## Rollback

Roll back in this order:

1. **`CORNERMEX_CHECKOUT_ENABLED=false` first** — this alone stops all order
   execution immediately and is the fastest, lowest-risk lever. Set
   `VITE_CORNERMEX_CHECKOUT_ENABLED=false` with it.
2. Then, only if required: revert the deployment to the previous reviewed SHA.
3. Then, only if required: deactivate the loaded catalog rows (set products to
   `draft`) rather than deleting them, so evidence is preserved.
4. The COD function may remain installed; it cannot execute while checkout is
   disabled, and it is executable by `service_role` only.

Do not begin any deeper rollback before checkout execution is disabled.

## Not authorized by this runbook

Stripe, bank transfer, Tabby/Tamara, Apple Pay, Google Pay, external email or
messaging, A3.2b, domain cutover (CM-COM-2B1 remains on hold), and any Supabase
write outside the reviewed migration and the approved manifest load.
