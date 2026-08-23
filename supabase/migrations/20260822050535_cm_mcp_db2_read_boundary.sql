-- CM-MCP-DB2
-- Canonical database boundary for the read-only CornerMex MCP service.
--
-- This migration creates a private OAuth caller grant store and the nine
-- public read RPCs consumed by the CM-MCP-3 Edge Function. No write MCP tools,
-- OAuth configuration, OAuth clients, Edge deployment, or live grants are
-- activated here.

create table commerce_private.mcp_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  permission text not null,
  active boolean not null default false,
  expires_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id, permission),
  constraint mcp_grants_client_id_valid check (
    client_id = btrim(client_id)
    and char_length(client_id) between 1 and 200
  ),
  constraint mcp_grants_permission_valid check (
    permission in (
      'catalog:read',
      'inventory:read',
      'orders:read',
      'orders:note',
      'orders:transition',
      'b2b:read',
      'b2b:write',
      'ops:read'
    )
  ),
  constraint mcp_grants_expiry_valid check (
    expires_at is null or expires_at > created_at
  )
);

comment on table commerce_private.mcp_grants is
  'CM-MCP OAuth caller grants keyed by authenticated user, OAuth client_id, and permission.';

alter table commerce_private.mcp_grants enable row level security;

revoke all on table commerce_private.mcp_grants
  from public, anon, authenticated, service_role;

create or replace function public.mcp_current_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select g.permission
    from commerce_private.mcp_grants g
   where g.user_id = auth.uid()
     and g.client_id = nullif(btrim(auth.jwt() ->> 'client_id'), '')
     and g.active
     and (g.expires_at is null or g.expires_at > now())
   order by g.permission;
$$;

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
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_q text := nullif(btrim(p_q), '');
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'catalog:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if p_lang not in ('en', 'es', 'ar') then
    raise exception 'CM_MCP_LANG_INVALID';
  end if;
  if p_limit < 1 or p_limit > 50 then
    raise exception 'CM_MCP_LIMIT_INVALID';
  end if;
  if v_q is not null and char_length(v_q) > 120 then
    raise exception 'CM_MCP_QUERY_INVALID';
  end if;

  select coalesce(jsonb_agg(s.item order by s.updated_at desc, s.slug), '[]'::jsonb)
    into v_result
    from (
      select
        p.updated_at,
        p.slug,
        jsonb_build_object(
          'id', p.id,
          'slug', p.slug,
          'name', coalesce(
            (select pt.name from public.product_translations pt where pt.product_id = p.id and pt.lang = p_lang),
            (select pt.name from public.product_translations pt where pt.product_id = p.id and pt.lang = 'en'),
            p.slug
          ),
          'brand', p.brand,
          'category_slug', c.slug,
          'is_halal', p.is_halal,
          'spice_level', p.spice_level,
          'min_price_aed', (
            select min(pv.price_aed)
              from public.product_variants pv
             where pv.product_id = p.id and pv.is_active
          ),
          'max_price_aed', (
            select max(pv.price_aed)
              from public.product_variants pv
             where pv.product_id = p.id and pv.is_active
          ),
          'active_variant_count', (
            select count(*)
              from public.product_variants pv
             where pv.product_id = p.id and pv.is_active
          ),
          'updated_at', p.updated_at
        ) as item
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.status = 'active'
        and exists (
          select 1 from public.product_variants pv
           where pv.product_id = p.id and pv.is_active
        )
        and (
          v_q is null
          or strpos(lower(p.slug), lower(v_q)) > 0
          or strpos(lower(coalesce(p.brand, '')), lower(v_q)) > 0
          or exists (
            select 1
              from public.product_translations pt
             where pt.product_id = p.id
               and strpos(lower(pt.name), lower(v_q)) > 0
          )
        )
      order by p.updated_at desc, p.slug
      limit p_limit
    ) s;

  return v_result;
end;
$$;

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
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_identifier text := btrim(p_identifier);
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'catalog:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if p_lang not in ('en', 'es', 'ar') then
    raise exception 'CM_MCP_LANG_INVALID';
  end if;
  if v_identifier = '' or char_length(v_identifier) > 160 then
    raise exception 'CM_MCP_IDENTIFIER_INVALID';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'name', coalesce(
      (select pt.name from public.product_translations pt where pt.product_id = p.id and pt.lang = p_lang),
      (select pt.name from public.product_translations pt where pt.product_id = p.id and pt.lang = 'en'),
      p.slug
    ),
    'description', coalesce(
      (select pt.description from public.product_translations pt where pt.product_id = p.id and pt.lang = p_lang),
      (select pt.description from public.product_translations pt where pt.product_id = p.id and pt.lang = 'en')
    ),
    'brand', p.brand,
    'category_slug', c.slug,
    'origin_region', p.origin_region,
    'is_halal', p.is_halal,
    'is_bulk', p.is_bulk,
    'spice_level', p.spice_level,
    'variants', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', pv.id,
            'sku', pv.sku,
            'format_label', pv.format_label,
            'weight_grams', pv.weight_grams,
            'price_aed', pv.price_aed,
            'compare_at_price_aed', pv.compare_at_price_aed,
            'is_default', pv.is_default
          ) order by pv.is_default desc, pv.price_aed, pv.id
        ),
        '[]'::jsonb
      )
        from public.product_variants pv
       where pv.product_id = p.id and pv.is_active
    ),
    'updated_at', p.updated_at
  ) into v_result
    from public.products p
    left join public.categories c on c.id = p.category_id
   where p.status = 'active'
     and (p.slug = v_identifier or p.id::text = v_identifier)
     and exists (
       select 1 from public.product_variants pv
        where pv.product_id = p.id and pv.is_active
     )
   limit 1;

  return v_result;
end;
$$;

create or replace function public.mcp_inventory_get_availability(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_identifier text := btrim(p_identifier);
  v_product_id uuid;
  v_variant_id uuid;
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'inventory:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if v_identifier = '' or char_length(v_identifier) > 160 then
    raise exception 'CM_MCP_IDENTIFIER_INVALID';
  end if;

  select p.id into v_product_id
    from public.products p
   where p.status = 'active'
     and (p.slug = v_identifier or p.id::text = v_identifier)
   limit 1;

  if v_product_id is null then
    select pv.id into v_variant_id
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where p.status = 'active'
       and pv.is_active
       and (pv.id::text = v_identifier or pv.sku = v_identifier)
     limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'product_slug', p.slug,
        'variant_id', pv.id,
        'sku', pv.sku,
        'format_label', pv.format_label,
        'available_units', greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0),
        'in_stock', greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0) > 0,
        'updated_at', i.updated_at
      ) order by pv.is_default desc, pv.id
    ),
    '[]'::jsonb
  ) into v_result
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    left join public.inventory i on i.variant_id = pv.id
   where p.status = 'active'
     and pv.is_active
     and (
       (v_product_id is not null and pv.product_id = v_product_id)
       or (v_product_id is null and v_variant_id is not null and pv.id = v_variant_id)
     );

  return v_result;
end;
$$;

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
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'orders:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if p_status is not null and p_status not in (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  ) then
    raise exception 'CM_MCP_ORDER_STATUS_INVALID';
  end if;
  if p_limit < 1 or p_limit > 50 then
    raise exception 'CM_MCP_LIMIT_INVALID';
  end if;

  select coalesce(jsonb_agg(s.item order by s.created_at desc, s.order_number), '[]'::jsonb)
    into v_result
    from (
      select
        o.created_at,
        o.order_number,
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'payment_status', o.payment_status,
          'payment_method', o.payment_method,
          'subtotal_aed', o.subtotal_aed,
          'shipping_aed', o.shipping_aed,
          'tax_aed', o.tax_aed,
          'total_aed', o.total_aed,
          'item_count', (select count(*) from public.order_items oi where oi.order_id = o.id),
          'created_at', o.created_at,
          'updated_at', o.updated_at
        ) as item
      from public.orders o
      where p_status is null or o.status = p_status
      order by o.created_at desc, o.order_number
      limit p_limit
    ) s;

  return v_result;
end;
$$;

create or replace function public.mcp_orders_get(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_identifier text := btrim(p_identifier);
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'orders:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if v_identifier = '' or char_length(v_identifier) > 160 then
    raise exception 'CM_MCP_IDENTIFIER_INVALID';
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
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'variant_label', oi.variant_label,
            'qty', oi.qty,
            'unit_price_aed', oi.unit_price_aed,
            'line_total_aed', oi.line_total_aed,
            'fulfillment_status', oi.fulfillment_status
          ) order by oi.created_at, oi.id
        ),
        '[]'::jsonb
      )
        from public.order_items oi
       where oi.order_id = o.id
    ),
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) into v_result
    from public.orders o
   where o.order_number = v_identifier or o.id::text = v_identifier
   limit 1;

  return v_result;
end;
$$;

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
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'b2b:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  if p_status is not null and p_status not in ('new', 'contacted', 'quoting', 'won', 'lost') then
    raise exception 'CM_MCP_B2B_STATUS_INVALID';
  end if;
  if p_limit < 1 or p_limit > 50 then
    raise exception 'CM_MCP_LIMIT_INVALID';
  end if;

  select coalesce(jsonb_agg(s.item order by s.created_at desc, s.id), '[]'::jsonb)
    into v_result
    from (
      select
        l.id,
        l.created_at,
        jsonb_build_object(
          'id', l.id,
          'company_name', l.company_name,
          'business_type', l.business_type,
          'country_city', l.country_city,
          'products_interest', l.products_interest,
          'estimated_volume', l.estimated_volume,
          'status', l.status,
          'priority', l.priority,
          'qualification_score', l.qualification_score,
          'owner', l.owner,
          'next_action', l.next_action,
          'next_action_at', l.next_action_at,
          'blocker', l.blocker,
          'created_at', l.created_at,
          'updated_at', l.updated_at,
          'last_contact_at', l.last_contact_at
        ) as item
      from public.b2b_leads l
      where p_status is null or l.status = p_status
      order by l.created_at desc, l.id
      limit p_limit
    ) s;

  return v_result;
end;
$$;

create or replace function public.mcp_b2b_get_lead(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
  v_result jsonb;
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'b2b:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  select jsonb_build_object(
    'id', l.id,
    'company_name', l.company_name,
    'business_type', l.business_type,
    'country_city', l.country_city,
    'products_interest', l.products_interest,
    'estimated_volume', l.estimated_volume,
    'status', l.status,
    'priority', l.priority,
    'qualification_score', l.qualification_score,
    'owner', l.owner,
    'next_action', l.next_action,
    'next_action_at', l.next_action_at,
    'blocker', l.blocker,
    'created_at', l.created_at,
    'updated_at', l.updated_at,
    'last_contact_at', l.last_contact_at
  ) into v_result
    from public.b2b_leads l
   where l.id = p_id;

  return v_result;
end;
$$;

create or replace function public.mcp_ops_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_client text := nullif(btrim(auth.jwt() ->> 'client_id'), '');
begin
  if v_actor is null or v_client is null or not exists (
    select 1
      from commerce_private.mcp_grants g
     where g.user_id = v_actor
       and g.client_id = v_client
       and g.permission = 'ops:read'
       and g.active
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'CM_MCP_PERMISSION_REQUIRED';
  end if;

  return jsonb_build_object(
    'catalog', jsonb_build_object(
      'active_products', (select count(*) from public.products p where p.status = 'active'),
      'active_variants', (
        select count(*)
          from public.product_variants pv
          join public.products p on p.id = pv.product_id
         where p.status = 'active' and pv.is_active
      )
    ),
    'inventory', jsonb_build_object(
      'available_units', (
        select coalesce(sum(greatest(i.quantity_on_hand - i.quantity_reserved, 0)), 0)
          from public.inventory i
          join public.product_variants pv on pv.id = i.variant_id
          join public.products p on p.id = pv.product_id
         where p.status = 'active' and pv.is_active
      ),
      'out_of_stock_variants', (
        select count(*)
          from public.product_variants pv
          join public.products p on p.id = pv.product_id
          left join public.inventory i on i.variant_id = pv.id
         where p.status = 'active'
           and pv.is_active
           and greatest(coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0), 0) = 0
      )
    ),
    'orders', jsonb_build_object(
      'total', (select count(*) from public.orders),
      'pending', (select count(*) from public.orders o where o.status = 'pending'),
      'confirmed', (select count(*) from public.orders o where o.status = 'confirmed'),
      'processing', (select count(*) from public.orders o where o.status = 'processing'),
      'shipped', (select count(*) from public.orders o where o.status = 'shipped'),
      'delivered', (select count(*) from public.orders o where o.status = 'delivered'),
      'cancelled', (select count(*) from public.orders o where o.status = 'cancelled'),
      'paid_total_aed', (
        select coalesce(sum(o.total_aed), 0)
          from public.orders o
         where o.payment_status = 'paid'
      )
    ),
    'b2b', jsonb_build_object(
      'total', (select count(*) from public.b2b_leads),
      'new', (select count(*) from public.b2b_leads l where l.status = 'new'),
      'contacted', (select count(*) from public.b2b_leads l where l.status = 'contacted'),
      'quoting', (select count(*) from public.b2b_leads l where l.status = 'quoting'),
      'won', (select count(*) from public.b2b_leads l where l.status = 'won'),
      'lost', (select count(*) from public.b2b_leads l where l.status = 'lost')
    ),
    'generated_at', now()
  );
end;
$$;

comment on function public.mcp_current_permissions() is
  'Return active unexpired CornerMex MCP permissions for auth.uid() and OAuth client_id.';
comment on function public.mcp_catalog_search(text, text, integer) is
  'Read-only active catalogue search for an authorized OAuth MCP caller.';
comment on function public.mcp_catalog_get_product(text, text) is
  'Read-only active product detail for an authorized OAuth MCP caller.';
comment on function public.mcp_inventory_get_availability(text) is
  'Read-only canonical inventory availability for an authorized OAuth MCP caller.';
comment on function public.mcp_orders_list(text, integer) is
  'Read-only minimized order operations list with buyer and shipping PII excluded.';
comment on function public.mcp_orders_get(text) is
  'Read-only minimized order detail with buyer and shipping PII excluded.';
comment on function public.mcp_b2b_list_leads(text, integer) is
  'Read-only minimized B2B pipeline list with direct contact PII excluded.';
comment on function public.mcp_b2b_get_lead(uuid) is
  'Read-only minimized B2B pipeline detail with direct contact PII excluded.';
comment on function public.mcp_ops_summary() is
  'Read-only aggregate operating summary with no customer or lead PII.';

revoke all on function public.mcp_current_permissions()
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_catalog_search(text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_catalog_get_product(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_inventory_get_availability(text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_orders_list(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_orders_get(text)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_b2b_list_leads(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_b2b_get_lead(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mcp_ops_summary()
  from public, anon, authenticated, service_role;

grant execute on function public.mcp_current_permissions() to authenticated;
grant execute on function public.mcp_catalog_search(text, text, integer) to authenticated;
grant execute on function public.mcp_catalog_get_product(text, text) to authenticated;
grant execute on function public.mcp_inventory_get_availability(text) to authenticated;
grant execute on function public.mcp_orders_list(text, integer) to authenticated;
grant execute on function public.mcp_orders_get(text) to authenticated;
grant execute on function public.mcp_b2b_list_leads(text, integer) to authenticated;
grant execute on function public.mcp_b2b_get_lead(uuid) to authenticated;
grant execute on function public.mcp_ops_summary() to authenticated;
