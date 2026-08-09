-- CM-COM-3A — transactional single-merchant COD order execution.
--
-- PENDING CANONICAL: merged in Git, NOT applied to any database by this sprint.
-- Application requires a separate Founder authorization (see the CM-COM-3A
-- activation runbook).
--
-- Scope: CornerMex is the single merchant. This function deliberately contains
-- no seller, commission, coupon, loyalty, shipping-zone or provider-payment
-- logic, and touches only the verified A2 canonical schema.
--
-- Correctness contract:
--   * one PostgreSQL function call = one transaction;
--   * variant rows are locked FOR UPDATE before validation;
--   * price, subtotal, tax and total are computed from database values only —
--     the client never supplies a price;
--   * stock is decremented in the same transaction, and product_variants.stock
--     carries `check (stock >= 0)`, so overselling aborts the whole order;
--   * any failure raises and rolls back: no partial order, no partial stock.

create or replace function public.place_cod_order_v1(
  p_buyer_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_shipping_aed numeric,
  p_tax_rate numeric,
  p_legal_acceptance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_variant record;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_line numeric(12,2);
  v_attempt integer := 0;
  v_norm jsonb;
begin
  if p_buyer_id is null then
    raise exception 'COD_ORDER_BUYER_REQUIRED';
  end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' then
    raise exception 'COD_ORDER_SHIPPING_ADDRESS_REQUIRED';
  end if;
  if p_shipping_aed is null or p_shipping_aed < 0 then
    raise exception 'COD_ORDER_SHIPPING_INVALID';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 1 then
    raise exception 'COD_ORDER_TAX_RATE_INVALID';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'COD_ORDER_ITEMS_REQUIRED';
  end if;

  -- Normalise the requested lines once, collapsing duplicate variant rows so a
  -- single variant cannot be locked and decremented twice in one order.
  select jsonb_agg(jsonb_build_object('variant_id', t.variant_id, 'qty', t.qty) order by t.variant_id)
  into v_norm
  from (
    select (elem->>'variant_id')::uuid as variant_id,
           sum((elem->>'qty')::integer) as qty
    from jsonb_array_elements(p_items) as elem
    group by (elem->>'variant_id')::uuid
  ) t;

  if v_norm is null or jsonb_array_length(v_norm) = 0 then
    raise exception 'COD_ORDER_ITEMS_REQUIRED';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_norm) as x(variant_id uuid, qty integer)
    where x.qty is null or x.qty <= 0 or x.variant_id is null
  ) then
    raise exception 'COD_ORDER_QTY_INVALID';
  end if;

  -- Lock every requested variant before any validation so concurrent orders
  -- serialise on the same rows and cannot both pass the stock check.
  perform 1
  from public.product_variants v
  where v.id in (
    select x.variant_id from jsonb_to_recordset(v_norm) as x(variant_id uuid, qty integer)
  )
  order by v.id
  for update;

  for v_item in select x.variant_id, x.qty from jsonb_to_recordset(v_norm) as x(variant_id uuid, qty integer) order by x.variant_id loop
    select
      v.id,
      v.product_id,
      v.price_aed,
      v.stock,
      v.is_active,
      v.format_label,
      p.status as product_status,
      coalesce(pt.name, p.slug) as product_name
    into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_translations pt
      on pt.product_id = p.id and pt.lang = 'en'
    where v.id = v_item.variant_id;

    if not found then
      raise exception 'COD_ORDER_VARIANT_NOT_FOUND: %', v_item.variant_id;
    end if;
    if v_variant.product_status <> 'active' then
      raise exception 'COD_ORDER_PRODUCT_NOT_ACTIVE: %', v_item.variant_id;
    end if;
    if not v_variant.is_active then
      raise exception 'COD_ORDER_VARIANT_NOT_ACTIVE: %', v_item.variant_id;
    end if;
    if v_variant.stock < v_item.qty then
      raise exception 'COD_ORDER_INSUFFICIENT_STOCK: %', v_item.variant_id;
    end if;

    v_line := round(v_variant.price_aed * v_item.qty, 2);
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_tax := round(v_subtotal * p_tax_rate, 2);
  v_total := round(v_subtotal + p_shipping_aed + v_tax, 2);

  -- orders.order_number is NOT NULL UNIQUE with no default and no trigger, so
  -- it is generated here and retried on the unique constraint.
  loop
    v_attempt := v_attempt + 1;
    v_order_number :=
      'CM-' || to_char(now() at time zone 'utc', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.orders (
        order_number, buyer_id, status, payment_status, payment_method,
        subtotal_aed, shipping_aed, tax_aed, total_aed,
        shipping_address, legal_acceptance
      ) values (
        v_order_number, p_buyer_id, 'pending', 'pending', 'cod',
        v_subtotal, p_shipping_aed, v_tax, v_total,
        p_shipping_address, p_legal_acceptance
      )
      returning id into v_order_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'COD_ORDER_NUMBER_GENERATION_FAILED';
      end if;
    end;
  end loop;

  -- Order items and stock decrement, in the same transaction as the order.
  for v_item in select x.variant_id, x.qty from jsonb_to_recordset(v_norm) as x(variant_id uuid, qty integer) order by x.variant_id loop
    select
      v.id, v.product_id, v.price_aed, v.format_label,
      coalesce(pt.name, p.slug) as product_name
    into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_translations pt
      on pt.product_id = p.id and pt.lang = 'en'
    where v.id = v_item.variant_id;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_label,
      qty, unit_price_aed, line_total_aed
    ) values (
      v_order_id, v_variant.product_id, v_variant.id,
      v_variant.product_name, v_variant.format_label,
      v_item.qty, v_variant.price_aed,
      round(v_variant.price_aed * v_item.qty, 2)
    );

    -- `check (stock >= 0)` makes an oversell abort the entire transaction.
    update public.product_variants
    set stock = stock - v_item.qty,
        updated_at = now()
    where id = v_item.variant_id;

    insert into public.inventory_movements (
      variant_id, movement_type, quantity_delta, reference_type, reference_id, reason
    ) values (
      v_item.variant_id, 'sale', -v_item.qty, 'order', v_order_id, 'cod_order'
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal_aed', v_subtotal,
    'shipping_aed', p_shipping_aed,
    'tax_aed', v_tax,
    'total_aed', v_total
  );
end;
$$;

-- Server-only execution. The browser must never be able to place an order
-- directly; the application calls this with the service role.
revoke all on function public.place_cod_order_v1(uuid, jsonb, jsonb, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.place_cod_order_v1(uuid, jsonb, jsonb, numeric, numeric, jsonb)
  to service_role;

comment on function public.place_cod_order_v1(uuid, jsonb, jsonb, numeric, numeric, jsonb) is
  'CM-COM-3A single-merchant COD order execution. Locks variants FOR UPDATE, uses database prices only, and inserts order + items + stock decrement in one transaction. Service-role only.';
