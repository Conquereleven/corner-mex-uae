# CM-COM-3A.1 — Inventory Consistency Hotfix Runbook

This runbook records the reviewed rollout sequence for the CM-COM-3A.1 inventory
consistency hotfix. **It authorizes nothing.** Every production action below
requires separate, explicit Founder authorization at execution time, exactly as
the CM-COM-3A activation did. No production write, Railway change, migration,
Supabase write, deployment or checkout flag change is performed by this PR.

## Defect

The first Founder COD acceptance order (the "first Founder COD acceptance
order") surfaced a production defect in the applied `public.place_cod_order_v1`:

| Store                              | Behaviour on the committed order | Correct? |
| ---------------------------------- | -------------------------------- | -------- |
| `orders` / `order_items`           | created                          | yes      |
| `payment_method` / `payment_status`| `cod` / `pending`                | yes      |
| `product_variants.stock`           | `1 -> 0`                         | yes      |
| `inventory_movements`              | one `sale` of `-1`               | yes      |
| `inventory.quantity_on_hand`       | `1 -> 1` (not decremented)       | **no**   |

`product_variants.stock` and `inventory.quantity_on_hand` therefore drifted out
of consistency for the ordered variant.

## Fix (in this PR — repository only)

1. **Forward function migration** —
   `supabase/pending-canonical/20260810120000_place_cod_order_v1_inventory_consistency.sql`
   `create or replace`s `public.place_cod_order_v1` (identical signature) so a
   successful COD transaction atomically decrements **both**
   `product_variants.stock` and `inventory.quantity_on_hand`, records exactly one
   `sale` movement, and fails closed (whole transaction rollback) on missing,
   insufficient or drifted inventory. The original applied migration
   `20260809010000_place_cod_order_v1.sql` is **not** rewritten.

2. **Guarded reconciliation artifact (NOT executed here)** —
   `scripts/cm-com-3a/reconcile-inventory-consistency.sql` brings the one
   already-committed order's `inventory.quantity_on_hand` back into agreement
   with the already-applied stock decrement. It is idempotent and fail-closed,
   is not wired into any npm script or CI step, and must only be run under this
   runbook.

3. **Regression proof** — `scripts/cm-com-3a/test-cod-order-sql.mjs`
   (`npm run test:cm-com-3a:sql`) executes the corrected function against a
   disposable PostgreSQL and asserts the production-defect scenario plus the A–H
   failure/rollback matrix.

## Correctness contract added

For every ordered variant with quantity `N`, one successful COD transaction
commits, atomically:

```
product_variants.stock       := old_stock - N
inventory.quantity_on_hand   := old_quantity_on_hand - N
inventory_movements          += one 'sale' row, quantity_delta = -N
```

If inventory cannot be safely decremented the entire order rolls back: no order,
no items, no stock decrement, no inventory decrement, no movement. Deterministic
errors: `COD_ORDER_INVENTORY_NOT_FOUND`, `COD_ORDER_INVENTORY_INSUFFICIENT`,
`COD_ORDER_INVENTORY_DRIFT` (all fail-closed).

## Future production rollout sequence (authorizes nothing)

Execute only after this PR is reviewed by Codex, merged, and Founder-authorized
for production at that time.

1. Confirm the exact reviewed hotfix SHA and green CI.
2. Obtain explicit Founder production authorization for CM-COM-3A.1.
3. Turn **checkout OFF** first (`CORNERMEX_CHECKOUT_ENABLED=false`,
   `VITE_CORNERMEX_CHECKOUT_ENABLED=false`) and redeploy the current SHA if
   necessary so no order can be placed during the hotfix.
4. Verify the current production incident state (read-only): the affected
   variant shows `stock = 0`, `quantity_on_hand = 1`, exactly one `sale` of `-1`.
5. Apply **only** the reviewed function migration
   `20260810120000_place_cod_order_v1_inventory_consistency.sql`.
6. Execute **only** the reviewed guarded reconciliation
   `scripts/cm-com-3a/reconcile-inventory-consistency.sql`.
7. Verify globally that no CM-COM-3A stock/`quantity_on_hand` drift remains:
   `select count(*) from public.product_variants v join public.inventory i on i.variant_id = v.id where v.stock <> i.quantity_on_hand;` must return `0`.
8. Deploy the exact reviewed hotfix SHA with checkout still OFF; wait for
   SUCCESS and verify the deployed commit.
9. Non-writing smoke (`/api/health`, `/api/ready`, `/shop`, a product page,
   `/cart`, `/login`, `/checkout`); checkout must remain disabled.
10. Turn **checkout ON last** (`CORNERMEX_CHECKOUT_ENABLED=true`,
    `VITE_CORNERMEX_CHECKOUT_ENABLED=true`) and redeploy the same SHA.
11. Founder places a second controlled COD acceptance order.
12. Verify on that order: order created; items correct; `cod`/`pending`; totals
    correct; `product_variants.stock` decremented; `inventory.quantity_on_hand`
    decremented by the same amount; exactly one `sale` movement.
13. Only then close CM-COM-3A.1 acceptance.

## Reconciliation preconditions and behaviour

The reconciliation targets variants whose `inventory.quantity_on_hand` disagrees
with `product_variants.stock`, and per affected variant requires the exact
incident shape (`sale_units = 1`, `stock = 0`, `quantity_on_hand = 1`,
`quantity_reserved = 0`, and `quantity_on_hand - stock = sale_units`). It then
changes only `quantity_on_hand` (`1 -> 0`) and `updated_at`. It creates no
movement and does not touch orders, payments or stock. Any deviation aborts the
whole transaction (fail-closed); a re-run after reconciliation subtracts nothing
(idempotent). This was verified on a disposable database by reproducing the
incident with the original function, running the artifact (`quantity_on_hand`
`1 -> 0`), re-running it (no change), and confirming an unexpected drift shape
aborts without any write.

## Explicitly out of scope

No email implementation or send, no payment provider (Stripe / bank transfer /
Tabby / Tamara) activation, no DNS/domain change, no A3.2b change, no
modification of the real order or its payment state, and no PII in any artifact.
