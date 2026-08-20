-- CM-LAUNCH-1-L3P
-- Canonical single-merchant Admin Product Management transactions.
-- No seller authority. Authenticated admins only.

create or replace function public.admin_upsert_product_v1(
  p_product_id uuid,
  p_slug text,
  p_name_en text,
  p_name_es text,
  p_name_ar text,
  p_description_en text,
  p_description_es text,
  p_description_ar text,
  p_brand text,
  p_origin_region text,
  p_spice_level integer,
  p_is_bulk boolean,
  p_is_halal boolean,
  p_status text,
  p_category_id uuid,
  p_attrs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_id uuid := p_product_id;
  v_effective_status text := p_status;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles
    where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'CM_ADMIN_PRODUCT_INVALID_STATUS';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'CM_ADMIN_PRODUCT_INVALID_SLUG';
  end if;
  if p_name_en is null or length(trim(p_name_en)) = 0 then
    raise exception 'CM_ADMIN_PRODUCT_NAME_REQUIRED';
  end if;
  if p_spice_level is not null and (p_spice_level < 0 or p_spice_level > 5) then
    raise exception 'CM_ADMIN_PRODUCT_INVALID_SPICE_LEVEL';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories where id = p_category_id and is_active = true
  ) then
    raise exception 'CM_ADMIN_PRODUCT_CATEGORY_INVALID';
  end if;

  if v_product_id is null then
    v_effective_status := 'draft';
    insert into public.products (
      slug, brand, origin_region, spice_level, is_bulk, is_halal,
      status, category_id, attrs
    ) values (
      p_slug, nullif(trim(p_brand), ''), nullif(trim(p_origin_region), ''),
      p_spice_level, p_is_bulk, p_is_halal, v_effective_status,
      p_category_id, coalesce(p_attrs, '{}'::jsonb)
    ) returning id into v_product_id;
  else
    if not exists (select 1 from public.products where id = v_product_id) then
      raise exception 'CM_ADMIN_PRODUCT_NOT_FOUND';
    end if;
    if v_effective_status = 'active' and not exists (
      select 1 from public.product_variants
      where product_id = v_product_id and is_active = true and price_aed > 0
    ) then
      raise exception 'CM_ADMIN_PRODUCT_ACTIVE_VARIANT_REQUIRED';
    end if;
    update public.products
       set slug = p_slug,
           brand = nullif(trim(p_brand), ''),
           origin_region = nullif(trim(p_origin_region), ''),
           spice_level = p_spice_level,
           is_bulk = p_is_bulk,
           is_halal = p_is_halal,
           status = v_effective_status,
           category_id = p_category_id,
           attrs = coalesce(p_attrs, '{}'::jsonb),
           updated_at = now()
     where id = v_product_id;
  end if;

  delete from public.product_translations where product_id = v_product_id;
  insert into public.product_translations (product_id, lang, name, description)
  values (v_product_id, 'en', trim(p_name_en), nullif(p_description_en, ''));
  if nullif(trim(p_name_es), '') is not null then
    insert into public.product_translations (product_id, lang, name, description)
    values (v_product_id, 'es', trim(p_name_es), nullif(p_description_es, ''));
  end if;
  if nullif(trim(p_name_ar), '') is not null then
    insert into public.product_translations (product_id, lang, name, description)
    values (v_product_id, 'ar', trim(p_name_ar), nullif(p_description_ar, ''));
  end if;

  return v_product_id;
exception
  when unique_violation then
    raise exception 'CM_ADMIN_PRODUCT_SLUG_CONFLICT';
end;
$$;

revoke all on function public.admin_upsert_product_v1(uuid, text, text, text, text, text, text, text, text, text, integer, boolean, boolean, text, uuid, jsonb) from public, anon, service_role;
grant execute on function public.admin_upsert_product_v1(uuid, text, text, text, text, text, text, text, text, text, integer, boolean, boolean, text, uuid, jsonb) to authenticated;

create or replace function public.admin_upsert_product_variant_v1(
  p_product_id uuid,
  p_variant_id uuid default null,
  p_sku text default null,
  p_format_label text default null,
  p_weight_grams integer default null,
  p_price_aed numeric default 0,
  p_compare_at_price_aed numeric default null,
  p_stock integer default 0,
  p_is_default boolean default false,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_variant_id uuid;
  v_reserved integer := 0;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles
    where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  if p_stock < 0 then raise exception 'CM_ADMIN_PRODUCT_INVALID_STOCK'; end if;
  if p_price_aed < 0 then raise exception 'CM_ADMIN_PRODUCT_INVALID_PRICE'; end if;
  if p_compare_at_price_aed is not null and p_compare_at_price_aed < 0 then
    raise exception 'CM_ADMIN_PRODUCT_INVALID_COMPARE_PRICE';
  end if;
  if p_weight_grams is not null and p_weight_grams < 0 then
    raise exception 'CM_ADMIN_PRODUCT_INVALID_WEIGHT';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'CM_ADMIN_PRODUCT_NOT_FOUND';
  end if;

  if p_variant_id is not null then
    select coalesce(i.quantity_reserved, 0)
      into v_reserved
      from public.product_variants v
      left join public.inventory i on i.variant_id = v.id
     where v.id = p_variant_id and v.product_id = p_product_id;
    if not found then raise exception 'CM_ADMIN_VARIANT_NOT_FOUND'; end if;
    if p_stock < v_reserved then raise exception 'CM_ADMIN_PRODUCT_STOCK_BELOW_RESERVED'; end if;
  end if;

  if p_variant_id is null then
    insert into public.product_variants (
      product_id, sku, format_label, weight_grams, price_aed,
      compare_at_price_aed, stock, is_default, is_active
    ) values (
      p_product_id, nullif(trim(p_sku), ''), nullif(trim(p_format_label), ''),
      p_weight_grams, p_price_aed, p_compare_at_price_aed, p_stock,
      p_is_default, p_is_active
    ) returning id into v_variant_id;
  else
    update public.product_variants
       set sku = nullif(trim(p_sku), ''),
           format_label = nullif(trim(p_format_label), ''),
           weight_grams = p_weight_grams,
           price_aed = p_price_aed,
           compare_at_price_aed = p_compare_at_price_aed,
           stock = p_stock,
           is_default = p_is_default,
           is_active = p_is_active,
           updated_at = now()
     where id = p_variant_id and product_id = p_product_id
     returning id into v_variant_id;
  end if;

  if p_is_default then
    update public.product_variants
       set is_default = false, updated_at = now()
     where product_id = p_product_id and id <> v_variant_id and is_default = true;
  end if;

  insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved, updated_at)
  values (v_variant_id, p_stock, 0, now())
  on conflict (variant_id) do update
    set quantity_on_hand = excluded.quantity_on_hand,
        updated_at = now();

  return v_variant_id;
end;
$$;

revoke all on function public.admin_upsert_product_variant_v1(uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, boolean) from public, anon, service_role;
grant execute on function public.admin_upsert_product_variant_v1(uuid, uuid, text, text, integer, numeric, numeric, integer, boolean, boolean) to authenticated;

create or replace function public.admin_import_product_row_v1(
  p_slug text,
  p_name_en text,
  p_name_es text,
  p_name_ar text,
  p_description_en text,
  p_brand text,
  p_origin_region text,
  p_spice_level integer,
  p_is_bulk boolean,
  p_is_halal boolean,
  p_status text,
  p_category_slug text,
  p_sku text,
  p_format_label text,
  p_weight_grams integer,
  p_price_aed numeric,
  p_compare_at_price_aed numeric,
  p_stock integer,
  p_image_urls jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_product_id uuid;
  v_variant_id uuid;
  v_category_id uuid;
  v_created boolean := false;
  v_image_url text;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles
    where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  if p_category_slug is not null and length(trim(p_category_slug)) > 0 then
    select id into v_category_id
      from public.categories
     where slug = p_category_slug and is_active = true;
    if v_category_id is null then raise exception 'CM_ADMIN_PRODUCT_CATEGORY_INVALID'; end if;
  end if;

  select id into v_product_id from public.products where slug = p_slug;
  if v_product_id is null then
    v_created := true;
    v_product_id := public.admin_upsert_product_v1(
      null, p_slug, p_name_en, p_name_es, p_name_ar,
      p_description_en, null, null, p_brand, p_origin_region,
      p_spice_level, p_is_bulk, p_is_halal, 'draft', v_category_id, '{}'::jsonb
    );
  end if;

  select id into v_variant_id
    from public.product_variants
   where product_id = v_product_id
   order by is_default desc, created_at asc
   limit 1;

  perform public.admin_upsert_product_variant_v1(
    v_product_id, v_variant_id, p_sku, p_format_label, p_weight_grams,
    p_price_aed, p_compare_at_price_aed, p_stock, true, true
  );

  perform public.admin_upsert_product_v1(
    v_product_id, p_slug, p_name_en, p_name_es, p_name_ar,
    p_description_en, null, null, p_brand, p_origin_region,
    p_spice_level, p_is_bulk, p_is_halal, p_status, v_category_id, '{}'::jsonb
  );

  if p_image_urls is not null and jsonb_typeof(p_image_urls) <> 'array' then
    raise exception 'CM_ADMIN_PRODUCT_IMAGES_INVALID';
  end if;
  if p_image_urls is not null and jsonb_array_length(p_image_urls) > 8 then
    raise exception 'CM_ADMIN_PRODUCT_IMAGE_LIMIT';
  end if;
  if p_image_urls is not null and jsonb_array_length(p_image_urls) > 0 then
    delete from public.product_images where product_id = v_product_id;
    for v_image_url in select jsonb_array_elements_text(p_image_urls)
    loop
      if v_image_url !~ '^https?://' then raise exception 'CM_ADMIN_PRODUCT_IMAGE_URL_INVALID'; end if;
      insert into public.product_images (product_id, url, sort_order)
      values (
        v_product_id,
        v_image_url,
        (select count(*) from public.product_images where product_id = v_product_id)
      );
    end loop;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'created', v_created,
    'effective_status', p_status
  );
end;
$$;

revoke all on function public.admin_import_product_row_v1(text, text, text, text, text, text, text, integer, boolean, boolean, text, text, text, text, integer, numeric, numeric, integer, jsonb) from public, anon, service_role;
grant execute on function public.admin_import_product_row_v1(text, text, text, text, text, text, text, integer, boolean, boolean, text, text, text, text, integer, numeric, numeric, integer, jsonb) to authenticated;
