-- CornerMex 2.0 launch hardening: idempotent COD order creation.
--
-- place_cod_order_v1 takes no operation id, so a network retry, a second tab or
-- a replayed request created a second order, decrementing stock twice. The only
-- protection was a disabled button in the browser. See
-- docs/cornermex-2/LAUNCH-READINESS-PLAN.md §3.1.
--
-- This mirrors cm_create_card_order_v2, which already solved the same problem
-- for card: the request is fingerprinted into
-- commerce_private.card_checkout_operations and the (buyer_id, operation_id)
-- row is locked, so concurrent callers serialise and the second one observes
-- the order the first created. The fingerprint starts with the literal 'cod' so
-- a COD and a card operation can never be confused for one another even if they
-- somehow shared an operation id.
--
-- place_cod_order_v1 is unchanged and still carries all pricing, stock and
-- ledger authority; this function only decides whether to call it or to replay
-- the order it already created.

create or replace function public.cm_create_cod_order_v2(
  p_buyer_id uuid,
  p_operation_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_shipping_aed numeric,
  p_tax_rate numeric,
  p_legal_acceptance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_operation commerce_private.card_checkout_operations%rowtype;
  v_norm jsonb;
  v_result jsonb;
  v_order public.orders%rowtype;
begin
  if p_buyer_id is null or p_operation_id is null then
    raise exception 'CHECKOUT_IDENTITY_REQUIRED';
  end if;
  if p_legal_acceptance is null
     or not (p_legal_acceptance @> '{"terms":true,"privacy":true,"returns":true}')
  then
    raise exception 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50
  then
    raise exception 'COD_ITEMS_INVALID';
  end if;

  -- Same normalisation the order function performs, so the fingerprint is taken
  -- over the canonical request rather than over incidental client ordering.
  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'qty', qty) order by variant_id)
  into v_norm
  from (
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'qty')::integer) as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) q;
  if exists (
    select 1 from jsonb_to_recordset(v_norm) x(variant_id uuid, qty integer)
    where x.qty is null or x.qty not between 1 and 500 or x.variant_id is null
  ) then
    raise exception 'COD_QTY_INVALID';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        'cod', v_norm, p_shipping_address, p_shipping_aed, p_tax_rate, p_legal_acceptance
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into commerce_private.card_checkout_operations (buyer_id, operation_id, fingerprint)
  values (p_buyer_id, p_operation_id, v_fingerprint)
  on conflict do nothing;

  select * into v_operation
  from commerce_private.card_checkout_operations
  where buyer_id = p_buyer_id and operation_id = p_operation_id
  for update;

  if v_operation.fingerprint <> v_fingerprint then
    raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT';
  end if;

  if v_operation.order_id is null then
    v_result := public.place_cod_order_v1(
      p_buyer_id, v_norm, p_shipping_address, p_shipping_aed, p_tax_rate, p_legal_acceptance
    );
    update commerce_private.card_checkout_operations
    set order_id = (v_result->>'order_id')::uuid
    where buyer_id = p_buyer_id and operation_id = p_operation_id;
    return v_result || jsonb_build_object('replayed', false);
  end if;

  -- Replay: return the order this operation already created, never a new one.
  select * into v_order from public.orders where id = v_operation.order_id;
  if not found then
    raise exception 'CHECKOUT_OPERATION_ORDER_MISSING';
  end if;
  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'subtotal_aed', v_order.subtotal_aed,
    'shipping_aed', v_order.shipping_aed,
    'tax_aed', v_order.tax_aed,
    'total_aed', v_order.total_aed,
    'replayed', true
  );
end;
$$;

revoke all on function public.cm_create_cod_order_v2(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.cm_create_cod_order_v2(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb)
  to service_role;

comment on function public.cm_create_cod_order_v2(uuid, uuid, jsonb, jsonb, numeric, numeric, jsonb) is
  'CornerMex 2.0: idempotent COD order creation. Fingerprints the normalised request into commerce_private.card_checkout_operations and delegates to place_cod_order_v1; a replay returns the same order instead of creating another. Service-role only.';
