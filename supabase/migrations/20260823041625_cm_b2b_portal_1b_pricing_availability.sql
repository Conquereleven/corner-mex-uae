-- CM-B2B-PORTAL-1B
-- Additive replacement of the existing account-scoped portal RPC. The public
-- signature and restrictive grants remain unchanged. Current account pricing
-- is resolved inside the authenticated server/RPC boundary; commerce_private
-- remains unavailable to browser roles.

create or replace function public.b2b_portal_v1(
  p_action text,
  p_account_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_query text;
  v_limit integer;
  v_list_id uuid;
  v_variant_id uuid;
  v_order_id uuid;
  v_name text;
  v_quantity integer;
  v_position integer;
  v_variant_ids jsonb;
  v_expected_count integer;
  v_actual_count integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'CM_B2B_AUTH_REQUIRED';
  end if;

  if v_action = 'accounts' then
    if p_account_id is not null then raise exception 'CM_B2B_INVALID_ACCOUNT_CONTEXT'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'name', coalesce(a.display_name, a.legal_name),
      'role', au.role,
      'currencyCode', a.currency_code
    ) order by coalesce(a.display_name, a.legal_name), a.id), '[]'::jsonb)
      into v_result
      from commerce_private.b2b_account_users au
      join commerce_private.b2b_customer_accounts a on a.id = au.account_id
     where au.user_id = v_actor and au.status = 'active' and a.status = 'active';
    return jsonb_build_object('accounts', v_result);
  end if;

  -- Never trust p_account_id by itself. Every scoped action revalidates the
  -- authenticated actor, active membership and active account server-side.
  if p_account_id is null or not exists (
    select 1
      from commerce_private.b2b_account_users au
      join commerce_private.b2b_customer_accounts a on a.id = au.account_id
     where au.account_id = p_account_id
       and au.user_id = v_actor
       and au.status = 'active'
       and a.status = 'active'
  ) then
    raise exception 'CM_B2B_ACCOUNT_MEMBERSHIP_REQUIRED';
  end if;

  if v_action = 'search' then
    v_query := btrim(coalesce(p_payload ->> 'query', ''));
    if length(v_query) not between 1 and 120 then raise exception 'CM_B2B_INVALID_SEARCH'; end if;
    if coalesce(p_payload ->> 'limit', '20') !~ '^[0-9]{1,2}$' then
      raise exception 'CM_B2B_INVALID_SEARCH_LIMIT';
    end if;
    v_limit := least(greatest((p_payload ->> 'limit')::integer, 1), 25);
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'name'), (row_data ->> 'sku')), '[]'::jsonb)
      into v_result
      from (
        select jsonb_build_object(
          'variantId', pv.id,
          'productId', p.id,
          'name', coalesce(pt.name, p.slug),
          'slug', p.slug,
          'sku', pv.sku,
          'variantLabel', pv.format_label,
          'availableStock', greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0),
          'catalogPriceAed', pv.price_aed,
          'effectivePriceAed', case when price.active_applicable then price.price_aed else pv.price_aed end,
          'priceStatus', case
            when price.active_applicable then 'special_account'
            when price.expired then 'expired_override'
            else 'default'
          end
        ) as row_data
        from public.product_variants pv
        join public.products p on p.id = pv.product_id and p.status = 'active'
        left join lateral (
          select t.name from public.product_translations t
           where t.product_id = p.id
           order by (t.lang = 'en') desc, t.lang asc
           limit 1
        ) pt on true
        left join public.inventory i on i.variant_id = pv.id
        left join lateral (
          select ap.price_aed,
                 (ap.is_active
                  and (ap.valid_from is null or ap.valid_from <= statement_timestamp())
                  and (ap.valid_until is null or ap.valid_until > statement_timestamp())) as active_applicable,
                 ((not ap.is_active)
                  or (ap.valid_until is not null and ap.valid_until <= statement_timestamp())) as expired
            from commerce_private.b2b_account_variant_prices ap
           where ap.account_id = p_account_id and ap.variant_id = pv.id
           limit 1
        ) price on true
        where pv.is_active = true
          and (pv.sku ilike '%' || v_query || '%'
               or coalesce(pt.name, p.slug) ilike '%' || v_query || '%')
        order by coalesce(pt.name, p.slug), pv.sku nulls last, pv.id
        limit v_limit
      ) matches;
    return jsonb_build_object('items', v_result);
  end if;

  if v_action = 'saved_lists' then
    select coalesce(jsonb_agg(list_data order by (list_data ->> 'updatedAt') desc), '[]'::jsonb)
      into v_result
      from (
        select jsonb_build_object(
          'id', l.id, 'name', l.name, 'updatedAt', l.updated_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'variantId', li.variant_id,
              'desiredQuantity', li.desired_quantity,
              'sortPosition', li.sort_position,
              'name', coalesce(pt.name, p.slug),
              'sku', pv.sku,
              'variantLabel', pv.format_label,
              'availableStock', greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0),
              'sellable', (pv.is_active and p.status = 'active'),
              'catalogPriceAed', pv.price_aed,
              'effectivePriceAed', case when price.active_applicable then price.price_aed else pv.price_aed end,
              'priceStatus', case
                when price.active_applicable then 'special_account'
                when price.expired then 'expired_override'
                else 'default'
              end
            ) order by li.sort_position)
            from commerce_private.saved_list_items li
            join public.product_variants pv on pv.id = li.variant_id
            join public.products p on p.id = pv.product_id
            left join lateral (
              select t.name from public.product_translations t where t.product_id = p.id
              order by (t.lang = 'en') desc, t.lang asc limit 1
            ) pt on true
            left join public.inventory i on i.variant_id = pv.id
            left join lateral (
              select ap.price_aed,
                     (ap.is_active
                      and (ap.valid_from is null or ap.valid_from <= statement_timestamp())
                      and (ap.valid_until is null or ap.valid_until > statement_timestamp())) as active_applicable,
                     ((not ap.is_active)
                      or (ap.valid_until is not null and ap.valid_until <= statement_timestamp())) as expired
                from commerce_private.b2b_account_variant_prices ap
               where ap.account_id = p_account_id and ap.variant_id = pv.id
               limit 1
            ) price on true
            where li.saved_list_id = l.id
          ), '[]'::jsonb)
        ) as list_data
        from commerce_private.saved_lists l
        where l.account_id = p_account_id
      ) lists;
    return jsonb_build_object('lists', v_result);
  end if;

  if v_action = 'create_list' then
    v_name := btrim(coalesce(p_payload ->> 'name', ''));
    if length(v_name) not between 1 and 120 then raise exception 'CM_B2B_INVALID_LIST_NAME'; end if;
    insert into commerce_private.saved_lists (account_id, name, created_by)
      values (p_account_id, v_name, v_actor) returning id into v_list_id;
    return jsonb_build_object('id', v_list_id, 'name', v_name);
  end if;

  if v_action in ('rename_list', 'add_item', 'set_quantity', 'remove_item', 'reorder_items') then
    v_list_id := nullif(p_payload ->> 'listId', '')::uuid;
    if v_list_id is null or not exists (
      select 1 from commerce_private.saved_lists where id = v_list_id and account_id = p_account_id
    ) then
      raise exception 'CM_B2B_SAVED_LIST_NOT_FOUND';
    end if;
  end if;

  if v_action = 'rename_list' then
    v_name := btrim(coalesce(p_payload ->> 'name', ''));
    if length(v_name) not between 1 and 120 then raise exception 'CM_B2B_INVALID_LIST_NAME'; end if;
    update commerce_private.saved_lists set name = v_name where id = v_list_id;
    return jsonb_build_object('id', v_list_id, 'name', v_name);
  end if;

  if v_action in ('add_item', 'set_quantity', 'remove_item', 'reorder_items') then
    if v_action = 'reorder_items' then
      v_variant_ids := p_payload -> 'variantIds';
      if jsonb_typeof(v_variant_ids) <> 'array' then raise exception 'CM_B2B_INVALID_LIST_ORDER'; end if;
      select count(*) into v_expected_count from commerce_private.saved_list_items where saved_list_id = v_list_id;
      if jsonb_array_length(v_variant_ids) <> v_expected_count then raise exception 'CM_B2B_INVALID_LIST_ORDER'; end if;
      select count(distinct value::text) into v_actual_count from jsonb_array_elements_text(v_variant_ids);
      if v_actual_count <> v_expected_count then raise exception 'CM_B2B_INVALID_LIST_ORDER'; end if;
      if exists (
        select 1 from jsonb_array_elements_text(v_variant_ids) raw
        where not exists (
          select 1 from commerce_private.saved_list_items li
           where li.saved_list_id = v_list_id and li.variant_id::text = raw.value
        )
      ) then raise exception 'CM_B2B_INVALID_LIST_ORDER'; end if;
      update commerce_private.saved_list_items set sort_position = sort_position + 1000000
       where saved_list_id = v_list_id;
      for v_position, v_variant_id in
        select ordinality - 1, value::uuid from jsonb_array_elements_text(v_variant_ids) with ordinality
      loop
        update commerce_private.saved_list_items set sort_position = v_position
         where saved_list_id = v_list_id and variant_id = v_variant_id;
      end loop;
      return jsonb_build_object('id', v_list_id, 'reordered', true);
    end if;

    v_variant_id := nullif(p_payload ->> 'variantId', '')::uuid;
    if v_variant_id is null then raise exception 'CM_B2B_INVALID_VARIANT'; end if;
    if v_action = 'remove_item' then
      delete from commerce_private.saved_list_items where saved_list_id = v_list_id and variant_id = v_variant_id;
      return jsonb_build_object('id', v_list_id, 'removed', true);
    end if;
    if coalesce(p_payload ->> 'desiredQuantity', '') !~ '^[0-9]{1,6}$' then
      raise exception 'CM_B2B_INVALID_DESIRED_QUANTITY';
    end if;
    v_quantity := (p_payload ->> 'desiredQuantity')::integer;
    if v_quantity not between 1 and 100000 then raise exception 'CM_B2B_INVALID_DESIRED_QUANTITY'; end if;
    if v_action = 'add_item' then
      if not exists (
        select 1 from public.product_variants pv join public.products p on p.id = pv.product_id
         where pv.id = v_variant_id and pv.is_active = true and p.status = 'active'
      ) then raise exception 'CM_B2B_VARIANT_NOT_SELLABLE'; end if;
      select coalesce(max(sort_position), -1) + 1 into v_position
        from commerce_private.saved_list_items where saved_list_id = v_list_id;
      insert into commerce_private.saved_list_items (saved_list_id, variant_id, desired_quantity, sort_position)
        values (v_list_id, v_variant_id, v_quantity, v_position)
      on conflict (saved_list_id, variant_id) do update
        set desired_quantity = least(100000, commerce_private.saved_list_items.desired_quantity + excluded.desired_quantity);
      return jsonb_build_object('id', v_list_id, 'variantId', v_variant_id, 'behavior', 'increment_existing');
    end if;
    update commerce_private.saved_list_items set desired_quantity = v_quantity
     where saved_list_id = v_list_id and variant_id = v_variant_id;
    if not found then raise exception 'CM_B2B_SAVED_LIST_ITEM_NOT_FOUND'; end if;
    return jsonb_build_object('id', v_list_id, 'variantId', v_variant_id, 'desiredQuantity', v_quantity);
  end if;

  if v_action = 'orders' then
    select coalesce(jsonb_agg(order_data order by (order_data ->> 'createdAt') desc), '[]'::jsonb)
      into v_result from (
        select jsonb_build_object('id', o.id, 'orderNumber', o.order_number,
          'createdAt', o.created_at, 'status', o.status,
          'itemCount', (select count(*) from public.order_items oi where oi.order_id = o.id)) as order_data
        from public.orders o where o.buyer_id = v_actor order by o.created_at desc limit 20
      ) orders;
    return jsonb_build_object('orders', v_result);
  end if;

  if v_action = 'reorder_draft' then
    v_order_id := nullif(p_payload ->> 'orderId', '')::uuid;
    if v_order_id is null or not exists (
      select 1 from public.orders where id = v_order_id and buyer_id = v_actor
    ) then raise exception 'CM_B2B_REORDER_NOT_FOUND'; end if;
    select coalesce(jsonb_agg(line_data order by (line_data ->> 'name')), '[]'::jsonb)
      into v_result from (
        select jsonb_build_object(
          'variantId', oi.variant_id,
          'name', coalesce(pt.name, oi.product_name),
          'sku', pv.sku,
          'variantLabel', coalesce(pv.format_label, oi.variant_label),
          'quantity', oi.qty,
          'availableStock', greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0),
          'eligible', (pv.id is not null and pv.is_active and p.status = 'active'
                       and greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0) > 0),
          'reason', case
            when pv.id is null or p.status is distinct from 'active' or pv.is_active is not true then 'inactive'
            when greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0) <= 0 then 'unavailable'
            else null end,
          'catalogPriceAed', pv.price_aed,
          'effectivePriceAed', case
            when pv.id is null then null
            when price.active_applicable then price.price_aed
            else pv.price_aed
          end,
          'priceStatus', case
            when pv.id is null then null
            when price.active_applicable then 'special_account'
            when price.expired then 'expired_override'
            else 'default'
          end
        ) as line_data
        from public.order_items oi
        left join public.product_variants pv on pv.id = oi.variant_id
        left join public.products p on p.id = pv.product_id
        left join lateral (
          select t.name from public.product_translations t where t.product_id = p.id
          order by (t.lang = 'en') desc, t.lang asc limit 1
        ) pt on true
        left join public.inventory i on i.variant_id = pv.id
        left join lateral (
          select ap.price_aed,
                 (ap.is_active
                  and (ap.valid_from is null or ap.valid_from <= statement_timestamp())
                  and (ap.valid_until is null or ap.valid_until > statement_timestamp())) as active_applicable,
                 ((not ap.is_active)
                  or (ap.valid_until is not null and ap.valid_until <= statement_timestamp())) as expired
            from commerce_private.b2b_account_variant_prices ap
           where ap.account_id = p_account_id and ap.variant_id = pv.id
           limit 1
        ) price on true
        where oi.order_id = v_order_id
      ) lines;
    return jsonb_build_object(
      'orderId', v_order_id,
      'lines', v_result,
      'notice', 'Current account price, sellability and public.inventory availability are shown. Historical price and stock are never reused as current values.'
    );
  end if;

  raise exception 'CM_B2B_PORTAL_ACTION_INVALID';
end;
$$;

revoke all on function public.b2b_portal_v1(text, uuid, jsonb) from public, anon, service_role;
grant execute on function public.b2b_portal_v1(text, uuid, jsonb) to authenticated;

comment on function public.b2b_portal_v1(text, uuid, jsonb) is
  'CM-B2B-PORTAL-1B account-scoped pricing and availability boundary. Effective price precedence is an active applicable exact account/variant override, then the canonical product_variants.price_aed. No zero fallback or historical price is used. Membership is revalidated for every scoped action; no order, payment or inventory mutation is performed.';
