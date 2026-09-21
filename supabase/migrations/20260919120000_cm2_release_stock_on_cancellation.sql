-- CornerMex 2.0 launch hardening: restore stock when an order is cancelled.
--
-- Before this migration no code path returned stock: an admin cancellation only
-- changed the order status, so every cancelled or refused COD order silently
-- lowered sellable stock. See docs/cornermex-2/LAUNCH-READINESS-PLAN.md §3.5.
--
-- cm_release_order_stock_v1 returns exactly what the order's own 'sale' ledger
-- rows took, so it is correct for any order created by place_cod_order_v1 and a
-- no-op for orders that never decremented stock. It:
--   * locks variants by id, then inventory by variant_id -- the same global lock
--     order place_cod_order_v1 uses, so it cannot deadlock against checkout;
--   * increments product_variants.stock and inventory.quantity_on_hand together
--     and writes one 'release' ledger row per variant (vocabulary already allowed
--     by inventory_movements_movement_type_check);
--   * is idempotent: an order that already has a 'release' row is not released
--     again;
--   * fails closed (whole transaction, including the cancellation, rolls back)
--     if an inventory row is missing, rather than creating drift.
--
-- admin_transition_order_lifecycle_v1 is re-created verbatim from
-- 20260812180442_cm_com_4a_post_order_lifecycle.sql plus one guarded call. Its
-- production definition was verified to be identical to that file apart from
-- two comment lines (pg_get_functiondef compared line by line, 2026-09-19).
-- Signature, SECURITY DEFINER, search_path and grants are unchanged.

create or replace function public.cm_release_order_stock_v1(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_rows integer;
  v_units integer := 0;
begin
  if p_order_id is null then
    raise exception 'STOCK_RELEASE_ORDER_REQUIRED';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 100 then
    raise exception 'STOCK_RELEASE_REASON_REQUIRED';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'STOCK_RELEASE_ORDER_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.inventory_movements
    where reference_type = 'order' and reference_id = p_order_id and movement_type = 'release'
  ) then
    return jsonb_build_object('released', false, 'units', 0, 'reason', 'already_released');
  end if;

  perform 1 from public.product_variants v
  where v.id in (
    select m.variant_id from public.inventory_movements m
    where m.reference_type = 'order' and m.reference_id = p_order_id and m.movement_type = 'sale'
  )
  order by v.id
  for update;

  perform 1 from public.inventory i
  where i.variant_id in (
    select m.variant_id from public.inventory_movements m
    where m.reference_type = 'order' and m.reference_id = p_order_id and m.movement_type = 'sale'
  )
  order by i.variant_id
  for update;

  for v_item in
    select m.variant_id, (-sum(m.quantity_delta))::integer as qty
    from public.inventory_movements m
    where m.reference_type = 'order' and m.reference_id = p_order_id and m.movement_type = 'sale'
    group by m.variant_id
    having -sum(m.quantity_delta) > 0
    order by m.variant_id
  loop
    update public.product_variants
    set stock = stock + v_item.qty, updated_at = now()
    where id = v_item.variant_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'STOCK_RELEASE_VARIANT_NOT_FOUND: %', v_item.variant_id;
    end if;

    update public.inventory
    set quantity_on_hand = quantity_on_hand + v_item.qty, updated_at = now()
    where variant_id = v_item.variant_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'STOCK_RELEASE_INVENTORY_NOT_FOUND: %', v_item.variant_id;
    end if;

    insert into public.inventory_movements (
      variant_id, movement_type, quantity_delta, reference_type, reference_id, reason
    ) values (
      v_item.variant_id, 'release', v_item.qty, 'order', p_order_id, btrim(p_reason)
    );
    v_units := v_units + v_item.qty;
  end loop;

  return jsonb_build_object('released', v_units > 0, 'units', v_units);
end;
$$;

revoke all on function public.cm_release_order_stock_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cm_release_order_stock_v1(uuid, text)
  to service_role;

comment on function public.cm_release_order_stock_v1(uuid, text) is
  'CornerMex 2.0: idempotently returns the stock an order took (its sale ledger rows) to product_variants.stock and inventory.quantity_on_hand, with release ledger rows. Service-role only; called by admin_transition_order_lifecycle_v1 on cancellation.';

create or replace function public.admin_transition_order_lifecycle_v1(
  p_order_id uuid,
  p_transition_type text,
  p_expected_from text,
  p_to text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_current text;
  v_allowed boolean := false;
  v_result_order_status text;
  v_result_payment_status text;
  v_pair_allowed boolean := false;
  v_event_id uuid;
begin
  if v_actor is null then
    raise exception 'CM_COM_4A_UNAUTHENTICATED';
  end if;
  if not commerce_private.is_admin(v_actor) then
    raise exception 'CM_COM_4A_ADMIN_REQUIRED';
  end if;
  if p_order_id is null or p_transition_type is null or p_expected_from is null or p_to is null then
    raise exception 'CM_COM_4A_TRANSITION_INPUT_INVALID';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'CM_COM_4A_ORDER_NOT_FOUND';
  end if;

  if p_transition_type = 'order_status' then
    v_current := v_order.status;
    if p_expected_from not in ('pending','confirmed','processing','shipped','delivered','cancelled')
       or p_to not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
      raise exception 'CM_COM_4A_ORDER_STATE_INVALID';
    end if;
    v_allowed := case p_expected_from
      when 'pending' then p_to in ('confirmed','cancelled')
      when 'confirmed' then p_to in ('processing','cancelled')
      when 'processing' then p_to in ('shipped','cancelled')
      when 'shipped' then p_to = 'delivered'
      else false
    end;
  elsif p_transition_type = 'payment_status' then
    if v_order.payment_method <> 'cod' then
      raise exception 'CM_COM_4A_PAYMENT_METHOD_UNSUPPORTED';
    end if;
    v_current := v_order.payment_status;
    if p_expected_from not in ('pending','under_review','paid','failed','refunded','cancelled')
       or p_to not in ('pending','under_review','paid','failed','refunded','cancelled') then
      raise exception 'CM_COM_4A_PAYMENT_STATE_INVALID';
    end if;
    v_allowed := case p_expected_from
      when 'pending' then p_to in ('under_review','paid','failed','cancelled')
      when 'under_review' then p_to in ('paid','failed','cancelled')
      when 'paid' then p_to = 'refunded'
      when 'failed' then p_to in ('under_review','cancelled')
      else false
    end;
  else
    raise exception 'CM_COM_4A_TRANSITION_TYPE_INVALID';
  end if;

  if v_current <> p_expected_from then
    raise exception 'CM_COM_4A_STALE_STATE';
  end if;
  if not v_allowed then
    raise exception 'CM_COM_4A_TRANSITION_NOT_ALLOWED';
  end if;

  v_result_order_status := case
    when p_transition_type = 'order_status' then p_to
    else v_order.status
  end;
  v_result_payment_status := case
    when p_transition_type = 'payment_status' then p_to
    else v_order.payment_status
  end;

  -- COD combined-state compatibility authority. This executes while the order
  -- row is locked and before either the state row or audit log is mutated.
  v_pair_allowed := case v_result_order_status
    when 'pending' then v_result_payment_status in ('pending','under_review','failed','cancelled')
    when 'confirmed' then v_result_payment_status in ('pending','under_review','paid')
    when 'processing' then v_result_payment_status in ('pending','under_review','paid')
    when 'shipped' then v_result_payment_status in ('pending','under_review','paid')
    when 'delivered' then v_result_payment_status in ('paid','refunded')
    when 'cancelled' then v_result_payment_status in ('pending','failed','refunded','cancelled')
    else false
  end;
  if not v_pair_allowed then
    raise exception 'CM_COM_4A_COMBINED_STATE_INCOMPATIBLE';
  end if;

  if p_transition_type = 'order_status' then
    update public.orders
    set status = p_to, updated_at = now()
    where id = p_order_id;
    -- CornerMex 2.0 launch hardening: a cancelled order returns the stock it
    -- took, in this same transaction. Cancellation is only reachable from
    -- pending, confirmed or processing (never after shipping), so the goods
    -- never left the warehouse.
    if p_to = 'cancelled' then
      perform public.cm_release_order_stock_v1(p_order_id, 'order_cancelled');
    end if;
  else
    update public.orders
    set payment_status = p_to, updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.order_lifecycle_events (
    order_id, transition_type, previous_value, new_value, actor_id
  ) values (
    p_order_id, p_transition_type, v_current, p_to, v_actor
  ) returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'transition_type', p_transition_type,
    'previous_value', v_current,
    'new_value', p_to,
    'event_id', v_event_id
  );
end;
$$;
