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

Catalog validity is proved BEFORE the COD migration is applied, so an unusable
catalog is discovered while the database is still untouched.

1. Verify the reviewed, merged `main` exact SHA and that CI is green on it.
2. Fresh **read-only** production schema and runtime preflight (tables, row
   counts, health, current serving commit).
3. Fresh Intermex public crawl and canonical manifest generation:
   `node scripts/cm-com-3a/ingest-intermex-catalog.mjs --out <manifest.json>`
   so prices and availability are current at load time, not at review time.
4. Validate the canonical manifest:
   `npm run validate:cm-com-3a:manifest -- <manifest.json>`. The validator
   rejects any markup, any `initial_stock` outside the Founder policy, and any
   loss of product or variant provenance.
5. Generate the deterministic activation plan and its SQL artifact, still
   without writing anything:
   `node scripts/cm-com-3a/load-activation-plan.mjs <manifest.json> --sql <plan.sql>`.
6. Founder reviews the activation evidence: counts, excluded rows and their
   stated reasons, sampled prices against the public source.
7. The reviewed COD transactional migration is now applied and retained at
   `supabase/migrations/20260809010000_place_cod_order_v1.sql`; verify its
   production migration-history record before any activation operation.
8. Execute the exact reviewed loader against the canonical manifest:
   `CORNERMEX_ACTIVATION_DATABASE_URL=… node scripts/cm-com-3a/load-activation-plan.mjs <manifest.json> --execute`.
   It applies in ONE transaction; a failure leaves no partial catalog.
   `initial_stock` seeds only newly created variants. Re-running the loader may
   refresh approved catalog metadata and prices, but it never changes existing
   `product_variants.stock` or `inventory.quantity_on_hand`. Restocking is a
   separate, explicitly authorized and auditable inventory operation.
9. Verify catalog and inventory: products active, variants active and bound to
   the right product, stock 1 for available rows and 0 otherwise, inventory
   rows matching, public read works anonymously.
10. Configure the COD commercial runtime on the production service:
    `CORNERMEX_COMMERCE_ACTIVE_MODE=cod`,
    `CORNERMEX_COD_SUPPORTED_EMIRATES=DU,AD,SH,AJ,UQ,RK,FU`,
    `CORNERMEX_VAT_RATE=0.05`, `CORNERMEX_VAT_TRN=105514792800001`, and
    `CORNERMEX_COD_SHIPPING_RATES_JSON` only if the Founder-approved defaults
    are being overridden. Any incomplete rate table fails closed.
11. Deploy the reviewed `main` with **`CHECKOUT_ENABLED` still false** (both
    `CORNERMEX_CHECKOUT_ENABLED` and `VITE_CORNERMEX_CHECKOUT_ENABLED`).
12. Smoke the read-only surfaces: `/shop`, a product page, cart, login,
    `/checkout` (must still refuse to execute), and confirm `/api/ready` still
    reports checkout execution disabled.
13. Set **`CORNERMEX_CHECKOUT_ENABLED=true` and
    `VITE_CORNERMEX_CHECKOUT_ENABLED=true` LAST**, after every step above, and
    redeploy so the client flag takes effect.
14. Founder places one real COD test order in one emirate.
15. Verify the transaction: order row, order items, `payment_method=cod` /
    `payment_status=pending`, stock decrement, inventory movement, per-emirate
    shipping, 5% VAT, total, and the confirmation page.
16. Declare `COMMERCIAL_ACTIVE` and record the exact deployed SHA in
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

## Known non-blocking debt

`CM-COM-3A-P3-CONFIRMATION-GATE` — `getOrderForConfirmation` currently depends
on checkout-enabled state, so disabling checkout during a rollback would also
make existing order confirmations unavailable. Recorded as debt; not changed in
this sprint.

## Not authorized by this runbook

Stripe, bank transfer, Tabby/Tamara, Apple Pay, Google Pay, external email or
messaging, A3.2b, domain cutover (CM-COM-2B1 remains on hold), and any Supabase
write outside the reviewed migration and the approved manifest load.
