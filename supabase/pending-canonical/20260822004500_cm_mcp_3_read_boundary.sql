-- CM-MCP-3
-- Canonical but intentionally UNAPPLIED until a separately authorized database gate.
-- This migration creates a least-privilege MCP grant store and read-only RPC surface.

create table if not exists commerce_private.mcp_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (char_length(btrim(client_id)) between 1 and 255),
  permission text not null check (
    permission = any (
      array[
        'catalog:read'::text,
        'inventory:read'::text,
        'orders:read'::text,
        'orders:note'::text,
        'orders:transition'::text,
        'b2b:read'::text,
        'b2b:write'::text,
        'ops:read'::text
      ]
    )
  ),
  active boolean not null default false,
  expires_at timestamptz,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id, permission)
);

alter table commerce_private.mcp_grants enable row level security;
revoke all on table commerce_private.mcp_grants from public, anon, authenticated;

create or replace function commerce_private.mcp_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and nullif(auth.jwt() ->> 'client_id', '') is not null
    and exists (
      select 1
      from commerce_private.mcp_grants g
      where g.user_id = auth.uid()
        and g.client_id = auth.jwt() ->> 'client_id'
        and g.permission = p_permission
        and g.active = true
        and (g.expires_at is null or g.expires_at > now())
    );
$$;

revoke all on function commerce_private.mcp_has_permission(text) from public, anon, authenticated;

create or replace function public.mcp_current_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(g.permission order by g.permission), array[]::text[])
  from commerce_private.mcp_grants g
  where auth.uid() is not null
    and nullif(auth.jwt() ->> 'client_id', '') is not null
    and g.user_id = auth.uid()
    and g.client_id = auth.jwt() ->> 'client_id'
    and g.active = true
    and (g.expires_at is null or g.expires_at > now());
$$;

revoke all on function public.mcp_current_permissions() from public, anon;
grant execute on function public.mcp_current_permissions() to authenticated;

create or replace function public.mcp_catalog_search(
  p_q text default null,
  p_lang text default 'en',
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('catalog:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_lang not in ('en', 'es', 'ar') or p_limit < 1 or p_limit > 50 then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into result
  from (
    select
      p.id,
      p.slug,
      p.brand,
      tr.name,
      tr.description,
      p.origin_region,
      p.spice_level,
      p.is_halal,
      p.is_bulk,
      v.id as variant_id,
      v.sku,
      v.format_label,
      v.weight_grams,
      v.price_aed,
      greatest(coalesce(i.quantity_on_hand, v.stock, 0) - coalesce(i.quantity_reserved, 0), 0) as available_quantity
    from public.products p
    join lateral (
      select pv.*
      from public.product_variants pv
      where pv.product_id = p.id and pv.is_active = true
      order by pv.is_default desc, pv.created_at asc
      limit 1
    ) v on true
    left join public.inventory i on i.variant_id = v.id
    left join lateral (
      select pt.name, pt.description
      from public.product_translations pt
      where pt.product_id = p.id
      order by (pt.lang = p_lang) desc, (pt.lang = 'en') desc, pt.lang asc
      limit 1
    ) tr on true
    where p.status = 'active'
      and v.price_aed > 0
      and (
        p_q is null
        or btrim(p_q) = ''
        or p.slug ilike '%' || btrim(p_q) || '%'
        or coalesce(p.brand, '') ilike '%' || btrim(p_q) || '%'
        or coalesce(tr.name, '') ilike '%' || btrim(p_q) || '%'
      )
    order by p.created_at desc, p.id desc
    limit p_limit
  ) row_data;

  return jsonb_build_object('items', result);
end;
$$;

revoke all on function public.mcp_catalog_search(text, text, integer) from public, anon;
grant execute on function public.mcp_catalog_search(text, text, integer) to authenticated;

create or replace function public.mcp_catalog_get_product(
  p_identifier text,
  p_lang text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('catalog:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_identifier is null or btrim(p_identifier) = '' or p_lang not in ('en', 'es', 'ar') then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'brand', p.brand,
    'name', tr.name,
    'description', tr.description,
    'origin_region', p.origin_region,
    'spice_level', p.spice_level,
    'is_halal', p.is_halal,
    'is_bulk', p.is_bulk,
    'variants', coalesce(variants.items, '[]'::jsonb)
  )
  into result
  from public.products p
  left join lateral (
    select pt.name, pt.description
    from public.product_translations pt
    where pt.product_id = p.id
    order by (pt.lang = p_lang) desc, (pt.lang = 'en') desc, pt.lang asc
    limit 1
  ) tr on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'sku', pv.sku,
        'format_label', pv.format_label,
        'weight_grams', pv.weight_grams,
        'price_aed', pv.price_aed,
        'is_default', pv.is_default,
        'available_quantity', greatest(
          coalesce(inv.quantity_on_hand, pv.stock, 0) - coalesce(inv.quantity_reserved, 0),
          0
        )
      )
      order by pv.is_default desc, pv.created_at asc
    ) as items
    from public.product_variants pv
    left join public.inventory inv on inv.variant_id = pv.id
    where pv.product_id = p.id and pv.is_active = true and pv.price_aed > 0
  ) variants on true
  where p.status = 'active'
    and (p.id::text = btrim(p_identifier) or p.slug = btrim(p_identifier))
  limit 1;

  return result;
end;
$$;

revoke all on function public.mcp_catalog_get_product(text, text) from public, anon;
grant execute on function public.mcp_catalog_get_product(text, text) to authenticated;

create or replace function public.mcp_inventory_get_availability(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('inventory:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_identifier is null or btrim(p_identifier) = '' then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'items',
    coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  )
  into result
  from (
    select
      p.id as product_id,
      p.slug,
      pv.id as variant_id,
      pv.sku,
      pv.format_label,
      greatest(coalesce(i.quantity_on_hand, pv.stock, 0) - coalesce(i.quantity_reserved, 0), 0) as available_quantity,
      coalesce(i.quantity_reserved, 0) as reserved_quantity,
      i.reorder_point,
      coalesce(i.updated_at, pv.updated_at) as updated_at
    from public.products p
    join public.product_variants pv on pv.product_id = p.id
    left join public.inventory i on i.variant_id = pv.id
    where p.status = 'active'
      and pv.is_active = true
      and pv.price_aed > 0
      and (
        p.id::text = btrim(p_identifier)
        or p.slug = btrim(p_identifier)
        or pv.id::text = btrim(p_identifier)
        or pv.sku = btrim(p_identifier)
      )
    order by pv.is_default desc, pv.created_at asc
  ) row_data;

  return result;
end;
$$;

revoke all on function public.mcp_inventory_get_availability(text) from public, anon;
grant execute on function public.mcp_inventory_get_availability(text) to authenticated;

create or replace function public.mcp_orders_list(
  p_status text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('orders:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 50 or (
    p_status is not null and p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
  ) then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb))
  into result
  from (
    select
      o.id,
      o.order_number,
      o.status,
      o.payment_status,
      o.payment_method,
      o.subtotal_aed,
      o.shipping_aed,
      o.tax_aed,
      o.total_aed,
      o.created_at,
      o.updated_at
    from public.orders o
    where p_status is null or o.status = p_status
    order by o.created_at desc, o.id desc
    limit p_limit
  ) row_data;

  return result;
end;
$$;

revoke all on function public.mcp_orders_list(text, integer) from public, anon;
grant execute on function public.mcp_orders_list(text, integer) to authenticated;

create or replace function public.mcp_orders_get(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('orders:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_identifier is null or btrim(p_identifier) = '' then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'subtotal_aed', o.subtotal_aed,
    'shipping_aed', o.shipping_aed,
    'tax_aed', o.tax_aed,
    'total_aed', o.total_aed,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'items', coalesce(items.value, '[]'::jsonb)
  )
  into result
  from public.orders o
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'product_name', oi.product_name,
        'variant_label', oi.variant_label,
        'qty', oi.qty,
        'unit_price_aed', oi.unit_price_aed,
        'line_total_aed', oi.line_total_aed,
        'fulfillment_status', oi.fulfillment_status
      )
      order by oi.created_at asc
    ) as value
    from public.order_items oi
    where oi.order_id = o.id
  ) items on true
  where o.id::text = btrim(p_identifier) or o.order_number = btrim(p_identifier)
  limit 1;

  return result;
end;
$$;

revoke all on function public.mcp_orders_get(text) from public, anon;
grant execute on function public.mcp_orders_get(text) to authenticated;

create or replace function public.mcp_b2b_list_leads(
  p_status text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('b2b:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 50 or (
    p_status is not null and p_status not in ('new', 'contacted', 'quoting', 'won', 'lost')
  ) then
    raise exception 'MCP_INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb))
  into result
  from (
    select
      l.id,
      l.company_name,
      l.business_type,
      l.status,
      l.priority,
      l.country_city,
      l.products_interest,
      l.estimated_volume,
      l.owner,
      l.next_action,
      l.next_action_at,
      l.blocker,
      l.created_at,
      l.updated_at
    from public.b2b_leads l
    where p_status is null or l.status = p_status
    order by l.created_at desc, l.id desc
    limit p_limit
  ) row_data;

  return result;
end;
$$;

revoke all on function public.mcp_b2b_list_leads(text, integer) from public, anon;
grant execute on function public.mcp_b2b_list_leads(text, integer) to authenticated;

create or replace function public.mcp_b2b_get_lead(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('b2b:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', l.id,
    'company_name', l.company_name,
    'business_type', l.business_type,
    'status', l.status,
    'priority', l.priority,
    'country_city', l.country_city,
    'contact_role', l.contact_role,
    'products_interest', l.products_interest,
    'estimated_volume', l.estimated_volume,
    'contact_preference', l.contact_preference,
    'qualification_score', l.qualification_score,
    'owner', l.owner,
    'last_contact_at', l.last_contact_at,
    'next_action', l.next_action,
    'next_action_at', l.next_action_at,
    'blocker', l.blocker,
    'created_at', l.created_at,
    'updated_at', l.updated_at
  )
  into result
  from public.b2b_leads l
  where l.id = p_id;

  return result;
end;
$$;

revoke all on function public.mcp_b2b_get_lead(uuid) from public, anon;
grant execute on function public.mcp_b2b_get_lead(uuid) to authenticated;

create or replace function public.mcp_ops_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not commerce_private.mcp_has_permission('ops:read') then
    raise exception 'MCP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'active_products', (select count(*) from public.products p where p.status = 'active'),
    'sellable_variants', (
      select count(*)
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where p.status = 'active' and pv.is_active = true and pv.price_aed > 0
    ),
    'low_stock_variants', (
      select count(*)
      from public.inventory i
      join public.product_variants pv on pv.id = i.variant_id
      join public.products p on p.id = pv.product_id
      where p.status = 'active'
        and pv.is_active = true
        and greatest(i.quantity_on_hand - i.quantity_reserved, 0) <= coalesce(i.reorder_point, 5)
    ),
    'orders_30d', (
      select count(*) from public.orders o where o.created_at >= now() - interval '30 days'
    ),
    'gmv_30d_aed', (
      select coalesce(sum(o.total_aed), 0) from public.orders o where o.created_at >= now() - interval '30 days'
    ),
    'open_orders', (
      select count(*) from public.orders o where o.status in ('pending', 'confirmed', 'processing', 'shipped')
    ),
    'open_b2b_leads', (
      select count(*) from public.b2b_leads l where l.status in ('new', 'contacted', 'quoting')
    ),
    'generated_at', now()
  )
  into result;

  return result;
end;
$$;

revoke all on function public.mcp_ops_summary() from public, anon;
grant execute on function public.mcp_ops_summary() to authenticated;
