-- CM-COM-3A.1 — Inventory Consistency Hotfix for the COD order function.
--
-- PENDING CANONICAL: merged in Git, NOT applied to any database by this sprint.
-- Application requires a separate Founder authorization (see the CM-COM-3A.1
-- hotfix runbook). This is a NEW forward migration; the original
-- 20260809010000_place_cod_order_v1.sql is left exactly as applied to
-- production and is NOT rewritten.
--
-- Defect fixed (discovered by the first Founder COD acceptance order):
--   the original place_cod_order_v1 decremented public.product_variants.stock
--   and recorded a `sale` inventory_movement, but did NOT decrement
--   public.inventory.quantity_on_hand. product_variants.stock and
--   inventory.quantity_on_hand therefore drifted out of consistency.
--
-- Correctness contract (unchanged behaviour is preserved verbatim):
--   * one PostgreSQL function call = one transaction;
--   * service-role only, security definer, pinned search_path;
--   * buyer required, valid shipping address, COD only;
--   * price, subtotal, tax and total computed from database values only;
--   * duplicate requested lines are normalised to one decrement per variant;
--   * variant rows are locked FOR UPDATE before validation;
--   * product/variant active validation;
--   * order + items + stock mutation + inventory mutation in one transaction;
--   * unique order-number retry;
--   * exactly one `sale` inventory_movement per variant;
--   * any failure raises and rolls back: no partial order, no partial stock,
--     no partial inventory, no orphan movement.
--
-- Inventory consistency invariant added by this hotfix:
--   for every ordered variant with quantity N, one successful COD transaction
--   commits, atomically:
--     product_variants.stock          := old_stock - N
--     inventory.quantity_on_hand      := old_quantity_on_hand - N
--     inventory_movements             += one 'sale' row with quantity_delta = -N
--   All three describe the SAME committed sale. If inventory cannot be safely
--   decremented, the ENTIRE order transaction fails and rolls back.
--
-- Fail-closed inventory validation (A2 semantics: product_variants.stock and
-- inventory.quantity_on_hand mirror sellable stock; quantity_reserved is the
-- reserved-but-on-hand portion, default 0, and A2 enforces
-- quantity_reserved <= quantity_on_hand and quantity_on_hand >= 0):
--   * the inventory row must exist            -> COD_ORDER_INVENTORY_NOT_FOUND
--   * available = quantity_on_hand - quantity_reserved must cover the request
--                                             -> COD_ORDER_INVENTORY_INSUFFICIENT
--   * stock must already mirror available (no silent repair inside an order)
--                                             -> COD_ORDER_INVENTORY_DRIFT
--   Requiring available >= N also guarantees quantity_on_hand - N >=
--   quantity_reserved, so the A2 quantity_reserved <= quantity_on_hand check
--   cannot be violated and quantity_on_hand can never become negative.

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
  v_inventory record;
  v_available integer;
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

  -- Lock the matching inventory rows in the SAME deterministic variant_id order,
  -- in the same transaction, before order insertion. Locking variants by id and
  -- then inventory by variant_id (both ascending over the same uuid values) gives
  -- every transaction one global lock order, so concurrent COD orders that touch
  -- overlapping variants cannot deadlock.
  perform 1
  from public.inventory i
  where i.variant_id in (
    select x.variant_id from jsonb_to_recordset(v_norm) as x(variant_id uuid, qty integer)
  )
  order by i.variant_id
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

    -- Inventory consistency (CM-COM-3A.1). The inventory row is already locked
    -- above; validate it before any write so the whole order fails closed if the
    -- inventory store cannot back this sale.
    select i.quantity_on_hand, i.quantity_reserved
    into v_inventory
    from public.inventory i
    where i.variant_id = v_item.variant_id;

    if not found then
      raise exception 'COD_ORDER_INVENTORY_NOT_FOUND: %', v_item.variant_id;
    end if;

    v_available := v_inventory.quantity_on_hand - v_inventory.quantity_reserved;

    -- product_variants.stock and inventory.quantity_on_hand mirror sellable stock
    -- in CM-COM-3A (no reservation flow exists, so quantity_reserved is expected
    -- to be 0). A sale is not the place to silently repair a drift, so refuse
    -- rather than compound it. This is exactly the production defect's signature
    -- (stock decremented, quantity_on_hand not) caught fail-closed.
    if v_variant.stock <> v_inventory.quantity_on_hand then
      raise exception 'COD_ORDER_INVENTORY_DRIFT: %', v_item.variant_id;
    end if;

    -- Sufficiency independently respects any reservation: requiring
    -- available (on hand minus reserved) >= qty guarantees the decrement leaves
    -- quantity_on_hand - qty >= quantity_reserved (so the A2
    -- quantity_reserved <= quantity_on_hand check holds) and never negative.
    if v_available < v_item.qty then
      raise exception 'COD_ORDER_INVENTORY_INSUFFICIENT: %', v_item.variant_id;
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

  -- Order items, stock decrement and inventory decrement, in the same
  -- transaction as the order. All three stores move together or none do.
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

    -- Inventory consistency: mirror the stock decrement. `check
    -- (quantity_on_hand >= 0)` and `check (quantity_reserved <= quantity_on_hand)`
    -- make any residual inconsistency abort the whole transaction. updated_at is
    -- set explicitly (the A2 set_updated_at trigger would also refresh it).
    update public.inventory
    set quantity_on_hand = quantity_on_hand - v_item.qty,
        updated_at = now()
    where variant_id = v_item.variant_id;

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
  'CM-COM-3A single-merchant COD order execution (CM-COM-3A.1 inventory-consistent). Locks variants and inventory FOR UPDATE in deterministic variant_id order, uses database prices only, and inserts order + items + stock decrement + inventory.quantity_on_hand decrement + one sale movement in one transaction. Fails closed on missing/insufficient/drifted inventory. Service-role only.';
