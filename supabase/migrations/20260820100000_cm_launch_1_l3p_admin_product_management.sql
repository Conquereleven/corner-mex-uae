-- CM-LAUNCH-1-L3P
-- Canonical single-merchant Admin Product Management inventory transaction.
-- No seller authority. Authenticated admins only.

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
    if v_variant_id is null then raise exception 'CM_ADMIN_VARIANT_NOT_FOUND'; end if;
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
