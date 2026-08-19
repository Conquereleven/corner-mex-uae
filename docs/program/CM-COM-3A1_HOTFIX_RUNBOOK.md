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

1. **Applied forward function correction** —
   `supabase/migrations/20260810120000_place_cod_order_v1_inventory_consistency.sql`
   `create or replace`s `public.place_cod_order_v1` (identical signature) so a
   successful COD transaction atomically decrements **both**
   `product_variants.stock` and `inventory.quantity_on_hand`, records exactly one
   `sale` movement, and fails closed (whole transaction rollback) on missing,
   insufficient or drifted inventory. The original applied migration
   `20260809010000_place_cod_order_v1.sql` is **not** rewritten.

2. **Guarded reconciliation artifact (NOT executed here)** —
   `scripts/cm-com-3a/reconcile-inventory-consistency.sql` brings the one
   already-committed order's `inventory.quantity_on_hand` back into agreement
   with the already-applied stock decrement. It is bounded to the known
   incident, idempotent and fail-closed, and is run only under this runbook
   (its behaviour is otherwise exercised only by the disposable-PostgreSQL
   regression tests that execute the file).

3. **Regression proof** — `scripts/cm-com-3a/test-cod-order-sql.mjs`
   (`npm run test:cm-com-3a:sql`) executes, against a disposable PostgreSQL, the
   corrected function (production-defect scenario plus the A–H failure/rollback
   matrix) **and the actual reconciliation artifact from disk** (scenarios
   R1–R12 below).

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

The reconciliation is **bound to the single known incident**, not a
general-purpose drift auto-repair tool. It:

- resolves the target from the stable business identifier
  `order_number = 'CM-20260810-51E1AC74'` (not customer PII) via
  `orders → order_items → inventory_movements`; the affected **variant is
  derived, never hardcoded**;
- requires **exactly one** order with that number, in the expected COD /
  `pending` shape (order and payment state are verified, never mutated);
- requires **exactly one** `order_items` row for that order, with `qty = 1`;
- requires **exactly one TOTAL** `inventory_movements` row for that exact order +
  variant (`reference_type='order'`, `reference_id=<order>`) — regardless of
  `movement_type` — and then requires that single row to be exactly
  `movement_type='sale'`, `quantity_delta=-1`, `reason='cod_order'`. An extra
  non-sale movement (adjustment/receipt/correction) on the same order+variant
  aborts even if the arithmetic nets to `-1`; this is incident provenance
  validation, not accounting aggregation;
- **locks** the target `product_variants` and `inventory` rows `FOR UPDATE`
  before the final validation and mutation;
- requires the target to be the **only** stock/`quantity_on_hand` drift in the
  catalog (global drift `= 1` in the pre-repair state); any unrelated drift
  **aborts** and repairs nothing;
- changes only `inventory.quantity_on_hand` (`1 → 0`) and `updated_at`, guarded
  by the expected pre-state, and requires **exactly one row updated**
  (`GET DIAGNOSTICS … = ROW_COUNT`, `ROW_COUNT = 1`) or aborts; it creates no
  movement and does not touch orders, order items, payments or
  `product_variants.stock`;
- is an **idempotent no-op** on re-run: the already-reconciled state
  (`quantity_on_hand = 0`, global drift `= 0`) reports `ALREADY_RECONCILED` with
  zero writes;
- **aborts fail-closed** on any deviation (wrong cardinality, qty, stock,
  reserved, on-hand, movement shape, or extra drift).

The **actual artifact file** is executed by the automated disposable-PostgreSQL
regression suite (`npm run test:cm-com-3a:sql`, scenarios R1–R12 incl. R4B):
exact incident reconciled (`quantity_on_hand 1 → 0`), idempotent rerun no-op, an
unrelated second matching drift aborts and repairs nothing, wrong/missing sale
movement cardinality aborts, an extra non-sale movement on the same order+variant
aborts on total-movement cardinality (R4B, even when the arithmetic nets to
`-1`), wrong item cardinality/qty aborts, unexpected stock/on-hand/reserved
aborts, the `ROW_COUNT = 1` invariant is present and enforced, and the
write-boundary check confirms only `quantity_on_hand` (+ `updated_at`) changes on
success.

## Explicitly out of scope

No email implementation or send, no payment provider (Stripe / bank transfer /
Tabby / Tamara) activation, no DNS/domain change, no A3.2b change, no
modification of the real order or its payment state, and no PII in any artifact.
