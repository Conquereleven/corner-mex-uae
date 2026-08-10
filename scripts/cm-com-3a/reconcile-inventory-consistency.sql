-- CM-COM-3A.1 — one-time guarded inventory reconciliation.
--
-- ============================================================================
-- DO NOT EXECUTE THIS AGAINST PRODUCTION FROM THIS PR.
-- It is prepared for a later, separately Founder-authorized hotfix rollout and
-- is intentionally NOT wired into any npm script, migration chain or CI step.
-- Run it only under the CM-COM-3A.1 hotfix runbook, AFTER the corrected
-- place_cod_order_v1 function migration has been applied and checkout is OFF.
-- ============================================================================
--
-- Purpose
--   The original place_cod_order_v1 (applied to production) decremented
--   product_variants.stock and recorded a `sale` inventory_movement, but did
--   NOT decrement inventory.quantity_on_hand. The first Founder COD acceptance
--   order therefore left exactly one variant with:
--       product_variants.stock       = 0   (correct, decremented)
--       inventory.quantity_on_hand   = 1   (incorrect, not decremented)
--       one 'sale' movement of -1        (correct)
--   This script brings inventory.quantity_on_hand back into agreement with the
--   already-applied stock decrement, for that committed sale only.
--
-- Safety properties
--   * Identifies the affected variant(s) from committed order/movement facts,
--     not from any hardcoded variant UUID.
--   * Verifies, per affected variant, the exact expected incident shape and
--     ABORTS the whole transaction if anything differs (fail-closed).
--   * Changes ONLY inventory.quantity_on_hand (and inventory.updated_at).
--   * Creates no inventory_movement, and does not touch orders, order_items,
--     payments or product_variants.stock.
--   * Idempotent: once quantity_on_hand mirrors stock again, the affected set is
--     empty and a re-run subtracts nothing.

begin;

do $$
declare
  v_row record;
  v_reconciled integer := 0;
begin
  -- Affected set: variants whose inventory quantity_on_hand disagrees with the
  -- already-applied product_variants.stock. On a healthy CM-COM-3A catalog these
  -- two mirror each other, so a difference is exactly the un-applied sale.
  for v_row in
    select
      v.id                                   as variant_id,
      v.stock                                as stock,
      i.quantity_on_hand                     as quantity_on_hand,
      i.quantity_reserved                    as quantity_reserved,
      coalesce(m.sale_units, 0)              as sale_units
    from public.product_variants v
    join public.inventory i on i.variant_id = v.id
    left join (
      select variant_id, -sum(quantity_delta) as sale_units
      from public.inventory_movements
      where movement_type = 'sale'
        and reference_type = 'order'
        and reason = 'cod_order'
      group by variant_id
    ) m on m.variant_id = v.id
    where i.quantity_on_hand <> v.stock
    order by v.id
  loop
    -- Fail-closed shape verification for the first Founder COD acceptance order
    -- (exactly one unit sold, stock already 0, on-hand still 1, nothing
    -- reserved). Any deviation means an unexpected state this reviewed artifact
    -- is not authorized to repair, so abort and change nothing.
    if v_row.sale_units <> 1 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_SALE_UNITS: variant=% sale_units=%',
        v_row.variant_id, v_row.sale_units;
    end if;
    if v_row.stock <> 0 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_STOCK: variant=% stock=%',
        v_row.variant_id, v_row.stock;
    end if;
    if v_row.quantity_on_hand <> 1 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_QOH: variant=% quantity_on_hand=%',
        v_row.variant_id, v_row.quantity_on_hand;
    end if;
    if v_row.quantity_reserved <> 0 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_RESERVED: variant=% quantity_reserved=%',
        v_row.variant_id, v_row.quantity_reserved;
    end if;
    -- The drift must be explained exactly by the committed-but-unapplied sale.
    if (v_row.quantity_on_hand - v_row.stock) <> v_row.sale_units then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_DRIFT_MISMATCH: variant=% drift=% sale_units=%',
        v_row.variant_id, v_row.quantity_on_hand - v_row.stock, v_row.sale_units;
    end if;

    -- Apply ONLY the missing quantity_on_hand decrement (1 -> 0), mirroring the
    -- stock already committed. The optimistic guard ensures we never subtract
    -- twice if the row moved between the read and the write.
    update public.inventory
    set quantity_on_hand = v_row.stock,          -- 1 -> 0, i.e. quantity_on_hand - sale_units
        updated_at = now()
    where variant_id = v_row.variant_id
      and quantity_on_hand = v_row.quantity_on_hand
      and quantity_reserved = v_row.quantity_reserved;

    v_reconciled := v_reconciled + 1;
  end loop;

  raise notice 'CM-COM-3A.1 reconciliation complete: % variant(s) reconciled (0 means already consistent / already reconciled)', v_reconciled;
end $$;

commit;
