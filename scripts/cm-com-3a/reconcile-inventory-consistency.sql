-- CM-COM-3A.1 — one-time guarded inventory reconciliation.
--
-- ============================================================================
-- DO NOT EXECUTE THIS AGAINST PRODUCTION FROM THIS PR.
-- It is prepared for a later, separately Founder-authorized hotfix rollout and
-- is intentionally NOT wired into any npm script, migration chain or CI step
-- (other than the disposable-PostgreSQL regression tests that execute this exact
-- file to prove its behaviour). Run it against production only under the
-- CM-COM-3A.1 hotfix runbook, AFTER the corrected place_cod_order_v1 function
-- migration has been applied and checkout is OFF.
-- ============================================================================
--
-- Purpose
--   The original place_cod_order_v1 (applied to production) decremented
--   product_variants.stock and recorded a `sale` inventory_movement, but did
--   NOT decrement inventory.quantity_on_hand. The first Founder COD acceptance
--   order left exactly one variant with:
--       product_variants.stock       = 0   (correct, decremented)
--       inventory.quantity_on_hand   = 1   (incorrect, not decremented)
--       one 'sale' movement of -1        (correct)
--   This script brings inventory.quantity_on_hand back into agreement with the
--   already-applied stock decrement, for THAT ONE committed sale only.
--
-- Bounded to the known incident (NOT a general drift auto-repair tool)
--   The target is resolved from the stable business identifier
--   order_number = 'CM-20260810-51E1AC74' (not customer PII) via
--   orders -> order_items -> inventory_movements. No variant UUID is hardcoded.
--   The affected variant is derived from that exact order's single line item.
--
-- Safety properties
--   * Requires exactly one order with the known order_number, in the expected
--     COD/pending shape (order and payment state are never mutated).
--   * Requires exactly one order_items row for that order, with qty = 1.
--   * Requires exactly ONE TOTAL inventory_movements row for that exact
--     order+variant (reference_type='order', reference_id=<order>), regardless of
--     movement_type — then requires that single row to be exactly
--     movement_type='sale', quantity_delta=-1, reason='cod_order'. An extra
--     non-sale movement (adjustment/receipt/correction) on the same order+variant
--     aborts, even if the arithmetic nets to -1. Provenance, not aggregation.
--   * Locks the target product_variants and inventory rows FOR UPDATE before the
--     final validation and mutation.
--   * Requires the target variant to be the ONLY stock/quantity_on_hand drift in
--     the whole catalog (global drift = 1 in the pre-repair state); any other
--     drift aborts the entire transaction.
--   * Changes ONLY inventory.quantity_on_hand (1 -> 0) and inventory.updated_at,
--     guarded by the expected pre-state, and requires exactly one row updated
--     (GET DIAGNOSTICS ROW_COUNT = 1) or aborts.
--   * Creates no inventory_movement, and does not touch orders, order_items,
--     payments or product_variants.stock.
--   * Idempotent: a re-run after success detects the already-reconciled state
--     (quantity_on_hand = 0, global drift = 0) and is a zero-write no-op.
--   * Any unexpected state (wrong cardinality, qty, stock, reserved, on-hand,
--     movement shape, or extra drift) aborts fail-closed with no write.

begin;

do $$
declare
  v_order_number constant text := 'CM-20260810-51E1AC74';
  v_order_id uuid;
  v_payment_method text;
  v_payment_status text;
  v_variant_id uuid;
  v_qty integer;
  v_stock integer;
  v_qoh integer;
  v_reserved integer;
  v_count integer;
  v_movement_type text;
  v_movement_delta integer;
  v_movement_reason text;
  v_global_drift integer;
  v_rowcount integer;
begin
  -- A. Exactly one order with the known order_number.
  select count(*) into v_count from public.orders where order_number = v_order_number;
  if v_count = 0 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_ORDER_NOT_FOUND: order_number=%', v_order_number;
  end if;
  if v_count > 1 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_ORDER_CARDINALITY: order_number=% count=%', v_order_number, v_count;
  end if;
  select id, payment_method, payment_status
    into v_order_id, v_payment_method, v_payment_status
    from public.orders where order_number = v_order_number;

  -- B. Expected acceptance shape. Order/payment state is verified, never mutated.
  if v_payment_method is distinct from 'cod' or v_payment_status is distinct from 'pending' then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_PAYMENT_SHAPE: order=% method=% status=%',
      v_order_id, v_payment_method, v_payment_status;
  end if;

  -- C. Exactly one order_items row for that order. D. Derive the variant, qty = 1.
  select count(*) into v_count from public.order_items where order_id = v_order_id;
  if v_count <> 1 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_ITEM_CARDINALITY: order=% count=%', v_order_id, v_count;
  end if;
  select variant_id, qty into v_variant_id, v_qty
    from public.order_items where order_id = v_order_id;
  if v_qty <> 1 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_ITEM_QTY: order=% variant=% qty=%',
      v_order_id, v_variant_id, v_qty;
  end if;

  -- F. Exactly ONE TOTAL inventory movement for that exact order + variant,
  -- regardless of movement_type. This is incident provenance validation, not
  -- inventory accounting aggregation: the ONLY acceptable movement universe for
  -- the target order+variant is a single row. An extra adjustment/receipt/
  -- correction (even one that nets the arithmetic back to -1) is NOT the known
  -- incident and must abort. The cardinality query deliberately does NOT filter
  -- on movement_type.
  select count(*) into v_count
    from public.inventory_movements
    where reference_type = 'order'
      and reference_id = v_order_id
      and variant_id = v_variant_id;
  if v_count <> 1 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_MOVEMENT_CARDINALITY: order=% variant=% movement_rows=%',
      v_order_id, v_variant_id, v_count;
  end if;

  -- Only after total cardinality = 1, inspect that exact unique row. It must be
  -- exactly sale / -1 / cod_order; any deviation aborts.
  select movement_type, quantity_delta, reason
    into v_movement_type, v_movement_delta, v_movement_reason
    from public.inventory_movements
    where reference_type = 'order'
      and reference_id = v_order_id
      and variant_id = v_variant_id;
  if v_movement_type is distinct from 'sale'
     or v_movement_delta is distinct from -1
     or v_movement_reason is distinct from 'cod_order' then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_MOVEMENT_SHAPE: order=% variant=% type=% delta=% reason=%',
      v_order_id, v_variant_id, v_movement_type, v_movement_delta, v_movement_reason;
  end if;

  -- Lock the exact target rows before final validation and mutation. Variant
  -- first, then inventory, matching the order function's deterministic order.
  perform 1 from public.product_variants where id = v_variant_id for update;

  select quantity_on_hand, quantity_reserved into v_qoh, v_reserved
    from public.inventory where variant_id = v_variant_id for update;
  if not found then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_INVENTORY_NOT_FOUND: variant=%', v_variant_id;
  end if;
  select stock into v_stock from public.product_variants where id = v_variant_id;

  -- G. Stock must already be 0 (the decrement that did commit).
  if v_stock <> 0 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_STOCK: variant=% stock=%', v_variant_id, v_stock;
  end if;
  -- H. Nothing reserved.
  if v_reserved <> 0 then
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_RESERVED: variant=% quantity_reserved=%',
      v_variant_id, v_reserved;
  end if;

  -- Global drift across the whole catalog (product_variants joined inventory).
  select count(*) into v_global_drift
    from public.product_variants pv
    join public.inventory iv on iv.variant_id = pv.id
    where pv.stock <> iv.quantity_on_hand;

  if v_qoh = 1 then
    -- Pre-repair state. The target must be the ONLY drift in the catalog. Since
    -- the target itself (stock 0, on-hand 1) is a drift, global_drift = 1 means
    -- it is the sole drift; any other drift makes this >= 2 and aborts.
    if v_global_drift <> 1 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_GLOBAL_DRIFT: expected exactly 1 drift (the target), found %', v_global_drift;
    end if;

    -- Guarded, single-row update: only the expected pre-state matches.
    update public.inventory
      set quantity_on_hand = 0,
          updated_at = now()
      where variant_id = v_variant_id
        and quantity_on_hand = 1
        and quantity_reserved = 0;
    get diagnostics v_rowcount = row_count;
    if v_rowcount <> 1 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_ROWCOUNT: expected exactly 1 updated row, updated %', v_rowcount;
    end if;

    raise notice 'CM_COM_3A1_RECONCILED: order=% variant=% quantity_on_hand 1 -> 0 (rows=%)',
      v_order_id, v_variant_id, v_rowcount;

  elsif v_qoh = 0 then
    -- Already reconciled: target no longer drifts, and nothing else may drift.
    if v_global_drift <> 0 then
      raise exception 'CM_COM_3A1_RECONCILE_ABORT_GLOBAL_DRIFT: already reconciled but found % residual drift', v_global_drift;
    end if;
    raise notice 'CM_COM_3A1_ALREADY_RECONCILED: order=% variant=% quantity_on_hand already 0 (no-op, 0 writes)',
      v_order_id, v_variant_id;

  else
    -- Any other on-hand value is neither the pre-state (1) nor reconciled (0).
    raise exception 'CM_COM_3A1_RECONCILE_ABORT_UNEXPECTED_QOH: variant=% quantity_on_hand=%', v_variant_id, v_qoh;
  end if;
end $$;

commit;
