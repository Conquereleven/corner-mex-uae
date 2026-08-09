# CM-COM-3A — Commercial Active Activation Runbook

Prepared, **not executed**. This sprint performed no production write, no
deployment, no migration application and no catalog load.

Every step below requires explicit Founder authorization at the time it is run.

## Sequence

1. Verify the reviewed, merged `main` exact SHA and that CI is green on it.
2. Fresh **read-only** production schema and runtime preflight (tables, row
   counts, health, current serving commit).
3. Apply the exact reviewed COD transactional migration
   (`supabase/pending-canonical/20260809010000_place_cod_order_v1.sql`).
4. Load the exact approved 5–10 SKU manifest using the validated activation
   plan (`npm run validate:cm-com-3a:manifest -- <manifest.json> --plan`).
5. Verify rows, stock and read policies: products active, variants active with
   the intended stock, public read works anonymously.
6. Configure COD commercial environment on the production service:
   `CORNERMEX_COD_SHIPPING_AED`, `CORNERMEX_COD_SUPPORTED_EMIRATES`,
   `CORNERMEX_VAT_RATE` (0 unless VAT registration evidence is supplied).
7. Deploy the reviewed `main` with **`CHECKOUT_ENABLED` still false**.
8. Smoke the read-only surfaces: `/shop`, a product page, cart, login,
   `/checkout` (must still refuse to execute).
9. Set **`CORNERMEX_CHECKOUT_ENABLED=true` LAST**, after every step above.
10. Founder places one real COD test order.
11. Verify: order row, order items, stock decrement, totals, confirmation page.
12. Declare `COMMERCIAL_ACTIVE`.

## Rollback

Roll back in this order:

1. **`CORNERMEX_CHECKOUT_ENABLED=false` first** — this alone stops all order
   execution immediately and is the fastest, lowest-risk lever.
2. Then, only if required: revert the deployment to the previous reviewed SHA.
3. Then, only if required: deactivate the loaded catalog rows (set products to
   `draft`) rather than deleting them, so evidence is preserved.
4. The COD function may remain installed; it cannot execute while checkout is
   disabled.

Do not begin any deeper rollback before checkout execution is disabled.

## Not authorized by this runbook

Stripe, bank transfer, Tabby/Tamara, external email or messaging, A3.2b, the
full 149-product catalogue, domain cutover (CM-COM-2B1 remains on hold), and
any Supabase write outside the reviewed migration and approved manifest.
