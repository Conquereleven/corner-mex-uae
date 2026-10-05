-- CornerMex MX — launch assortment import.
--
-- One SKU of a validated launch sheet (docs/cornermex-mx/LAUNCH-CATALOG.md) is
-- written in one call: product, variant, stock, purchasing policy, shipping
-- dimensions, B2B price and suppliers. The call is idempotent on the SKU.
--
-- What it never does:
--   * change a launch status — a new SKU is DRAFT and not sellable; moving it to
--     READY or ACTIVE stays with cm_mx_set_launch_status_v1 and its gap check;
--   * invent a value — a field absent from the sheet is left unknown and shows
--     up as a launch gap; on a re-import an absent field leaves the stored value
--     alone;
--   * take stock below what is already reserved for orders.

create function public.cm_mx_import_launch_sku_v1(p_sku jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sku text := nullif(btrim(p_sku->>'sku'), '');
  v_name text := nullif(btrim(p_sku->>'name'), '');
  v_brand text := nullif(btrim(p_sku->>'brand'), '');
  v_retail numeric := nullif(p_sku->>'retail_price', '')::numeric;
  v_b2b numeric := nullif(p_sku->>'b2b_price', '')::numeric;
  v_weight integer := nullif(p_sku->>'weight_g', '')::integer;
  v_length numeric := nullif(p_sku->>'length_cm', '')::numeric;
  v_width numeric := nullif(p_sku->>'width_cm', '')::numeric;
  v_height numeric := nullif(p_sku->>'height_cm', '')::numeric;
  v_stock integer := nullif(p_sku->>'stock', '')::integer;
  v_case_pack integer := nullif(p_sku->>'case_pack', '')::integer;
  v_moq integer := nullif(p_sku->>'moq', '')::integer;
  v_suppliers jsonb := coalesce(p_sku->'suppliers', '[]'::jsonb);
  v_supplier jsonb;
  v_supplier_id uuid;
  v_supplier_name text;
  v_preferred_count integer;
  v_variant uuid;
  v_product uuid;
  v_slug text;
  v_created boolean := false;
  v_on_hand integer;
  v_reserved integer;
begin
  if v_sku is null or v_sku !~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,47}$' then
    raise exception 'MX_IMPORT_SKU_INVALID';
  end if;
  if v_name is null or char_length(v_name) > 200 then
    raise exception 'MX_IMPORT_NAME_INVALID: %', v_sku;
  end if;
  if (v_retail is not null and v_retail <= 0) or (v_b2b is not null and v_b2b <= 0) then
    raise exception 'MX_IMPORT_PRICE_INVALID: %', v_sku;
  end if;
  if v_stock is not null and v_stock < 0 then
    raise exception 'MX_IMPORT_STOCK_INVALID: %', v_sku;
  end if;
  if jsonb_typeof(v_suppliers) <> 'array' then
    raise exception 'MX_IMPORT_SUPPLIERS_INVALID: %', v_sku;
  end if;
  select count(*) into v_preferred_count
  from jsonb_array_elements(v_suppliers) s
  where coalesce((s->>'preferred')::boolean, false);
  if v_preferred_count > 1 then
    raise exception 'MX_IMPORT_MULTIPLE_PREFERRED_SUPPLIERS: %', v_sku;
  end if;

  select v.id, v.product_id into v_variant, v_product
  from public.product_variants v
  where v.sku = v_sku
  for update;

  if v_variant is null then
    v_created := true;
    v_slug := btrim(regexp_replace(lower(v_sku), '[^a-z0-9]+', '-', 'g'), '-');
    if exists (select 1 from public.products p where p.slug = v_slug) then
      raise exception 'MX_IMPORT_SLUG_TAKEN: %', v_slug;
    end if;
    insert into public.products (slug, brand, status)
    values (v_slug, v_brand, 'inactive')
    returning id into v_product;
    insert into public.product_translations (product_id, lang, name)
    values (v_product, 'es', v_name);
    -- price_aed is the unit-less price column; in this database it holds MXN.
    -- Zero means "not priced yet" and is reported as the retail_price gap.
    insert into public.product_variants
      (product_id, sku, weight_grams, price_aed, stock, is_default, is_active)
    values (v_product, v_sku, v_weight, coalesce(v_retail, 0), 0, true, false)
    returning id into v_variant;
    insert into commerce_private.variant_launch_profiles (variant_id, launch_status)
    values (v_variant, 'DRAFT');
  else
    update public.products
    set brand = coalesce(v_brand, brand)
    where id = v_product;
    insert into public.product_translations (product_id, lang, name)
    values (v_product, 'es', v_name)
    on conflict (product_id, lang) do update set name = excluded.name, updated_at = now();
    update public.product_variants
    set weight_grams = coalesce(v_weight, weight_grams),
        price_aed = coalesce(v_retail, price_aed)
    where id = v_variant;
    insert into commerce_private.variant_launch_profiles (variant_id)
    values (v_variant)
    on conflict (variant_id) do nothing;
  end if;

  update commerce_private.variant_launch_profiles
  set b2b_price = coalesce(v_b2b, b2b_price),
      length_cm = coalesce(v_length, length_cm),
      width_cm = coalesce(v_width, width_cm),
      height_cm = coalesce(v_height, height_cm)
  where variant_id = v_variant;

  if v_case_pack is not null or v_moq is not null then
    insert into commerce_private.inventory_policies (variant_id, case_pack, minimum_order_quantity)
    values (v_variant, v_case_pack, v_moq)
    on conflict (variant_id) do update
      set case_pack = coalesce(excluded.case_pack, commerce_private.inventory_policies.case_pack),
          minimum_order_quantity = coalesce(
            excluded.minimum_order_quantity,
            commerce_private.inventory_policies.minimum_order_quantity
          );
  end if;

  -- Stock: the sheet states a count on hand. Every change is a ledger movement.
  if v_stock is not null then
    select i.quantity_on_hand, i.quantity_reserved into v_on_hand, v_reserved
    from public.inventory i
    where i.variant_id = v_variant
    for update;
    if not found then
      insert into public.inventory (variant_id, quantity_on_hand) values (v_variant, v_stock);
      v_on_hand := 0;
      v_reserved := 0;
    elsif v_stock < v_reserved then
      raise exception 'MX_IMPORT_STOCK_BELOW_RESERVED: % (reserved %)', v_sku, v_reserved;
    else
      update public.inventory set quantity_on_hand = v_stock where variant_id = v_variant;
    end if;
    update public.product_variants set stock = v_stock where id = v_variant;
    if v_stock <> v_on_hand then
      insert into public.inventory_movements
        (variant_id, movement_type, quantity_delta, reference_type, reason)
      values (
        v_variant,
        case when v_on_hand = 0 and v_created then 'receipt' else 'adjustment' end,
        v_stock - v_on_hand,
        'launch_import',
        'Launch assortment import'
      );
    end if;
  end if;

  -- Suppliers named in the sheet. A supplier absent from a re-import is kept:
  -- removing a purchasing source is a decision, not a side effect.
  if v_preferred_count = 1 then
    update commerce_private.variant_suppliers
    set is_preferred = false
    where variant_id = v_variant and is_preferred;
  end if;
  for v_supplier in select * from jsonb_array_elements(v_suppliers) loop
    v_supplier_name := nullif(btrim(v_supplier->>'supplier'), '');
    if v_supplier_name is null or nullif(v_supplier->>'cost', '') is null then
      raise exception 'MX_IMPORT_SUPPLIER_INCOMPLETE: %', v_sku;
    end if;
    select s.id into v_supplier_id
    from commerce_private.suppliers s
    where lower(s.name) = lower(v_supplier_name);
    if v_supplier_id is null then
      insert into commerce_private.suppliers (name)
      values (v_supplier_name)
      returning id into v_supplier_id;
    end if;
    insert into commerce_private.variant_suppliers
      (variant_id, supplier_id, supplier_sku, supplier_cost, lead_time_days, case_pack,
       minimum_purchase_quantity, is_preferred, last_cost_update)
    values (
      v_variant,
      v_supplier_id,
      nullif(btrim(v_supplier->>'supplier_sku'), ''),
      (v_supplier->>'cost')::numeric,
      nullif(v_supplier->>'lead_time_days', '')::integer,
      v_case_pack,
      coalesce(v_moq, 1),
      coalesce((v_supplier->>'preferred')::boolean, false),
      now()
    )
    on conflict (variant_id, supplier_id) do update
      set supplier_sku = coalesce(excluded.supplier_sku, commerce_private.variant_suppliers.supplier_sku),
          supplier_cost = excluded.supplier_cost,
          lead_time_days = coalesce(excluded.lead_time_days, commerce_private.variant_suppliers.lead_time_days),
          case_pack = coalesce(excluded.case_pack, commerce_private.variant_suppliers.case_pack),
          minimum_purchase_quantity = excluded.minimum_purchase_quantity,
          is_preferred = excluded.is_preferred,
          last_cost_update = now(),
          updated_at = now();
  end loop;

  return jsonb_build_object(
    'sku', v_sku,
    'variant_id', v_variant,
    'created', v_created,
    'launch_status', (
      select lp.launch_status from commerce_private.variant_launch_profiles lp
      where lp.variant_id = v_variant
    ),
    'gaps', to_jsonb(commerce_private.variant_launch_gaps(v_variant))
  );
end;
$$;

revoke all on function public.cm_mx_import_launch_sku_v1(jsonb) from public, anon, authenticated;
grant execute on function public.cm_mx_import_launch_sku_v1(jsonb) to service_role;
