-- CornerMex A2 clean single-merchant commerce foundation.
-- Empty target only. This migration intentionally contains no business data.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  locale text not null default 'en' check (locale in ('en','es','ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  emirate text not null,
  area text not null,
  street text not null,
  building text,
  floor_apt text,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_es text,
  name_ar text,
  description text,
  image_url text,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  brand text,
  status text not null default 'draft' check (status in ('draft','active','inactive','archived')),
  origin_region text,
  spice_level integer check (spice_level between 0 and 4),
  is_halal boolean not null default false,
  is_bulk boolean not null default false,
  attrs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_translations (
  product_id uuid not null references public.products(id) on delete cascade,
  lang text not null check (lang in ('en','es','ar')),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, lang)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  format_label text,
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  price_aed numeric(12,2) not null check (price_aed >= 0),
  compare_at_price_aed numeric(12,2) check (compare_at_price_aed is null or compare_at_price_aed >= price_aed),
  stock integer not null default 0 check (stock >= 0),
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_variants_one_default_idx on public.product_variants(product_id) where is_default;

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0 and quantity_reserved <= quantity_on_hand),
  reorder_point integer check (reorder_point is null or reorder_point >= 0),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt','reservation','release','sale','return','adjustment')),
  quantity_delta integer not null check (quantity_delta <> 0),
  reference_type text,
  reference_id uuid,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index carts_one_active_per_user_idx on public.carts(user_id) where status = 'active';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','under_review','paid','failed','refunded','cancelled')),
  payment_method text check (payment_method in ('card','bank_transfer','cod')),
  subtotal_aed numeric(12,2) not null check (subtotal_aed >= 0),
  shipping_aed numeric(12,2) not null default 0 check (shipping_aed >= 0),
  tax_aed numeric(12,2) not null default 0 check (tax_aed >= 0),
  total_aed numeric(12,2) not null check (total_aed >= 0),
  shipping_address jsonb not null,
  legal_acceptance jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  qty integer not null check (qty > 0),
  unit_price_aed numeric(12,2) not null check (unit_price_aed >= 0),
  line_total_aed numeric(12,2) not null check (line_total_aed >= 0),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending','processing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','under_review','authorized','paid','failed','refunded','cancelled')),
  amount_aed numeric(12,2) not null check (amount_aed >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('fixed','percentage')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_aed numeric(12,2) check (minimum_order_aed is null or minimum_order_aed >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  discount_aed numeric(12,2) not null check (discount_aed >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table public.catalog_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  product_id uuid references public.products(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  session_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.b2b_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  business_type text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_public_catalog_idx on public.products(status, category_id, created_at desc);
create index product_translations_language_idx on public.product_translations(lang, product_id);
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);
create index inventory_movements_variant_created_idx on public.inventory_movements(variant_id, created_at desc);
create index orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index payments_order_idx on public.payments(order_id);
create index product_reviews_public_idx on public.product_reviews(product_id, status, created_at desc);
create index catalog_events_created_idx on public.catalog_events(event_type, created_at desc);
create index b2b_leads_status_created_idx on public.b2b_leads(status, created_at desc);

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','addresses','categories','products','product_translations','product_variants','inventory','carts','cart_items','orders','payments','product_reviews','b2b_leads']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_roles','addresses','categories','products','product_translations','product_images',
    'product_variants','inventory','inventory_movements','carts','cart_items','orders','order_items',
    'payments','product_reviews','coupons','coupon_redemptions','catalog_events','b2b_leads'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy roles_select_own on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy addresses_own on public.addresses for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin_all on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select to anon, authenticated using (status = 'active' or public.is_admin());
create policy products_admin_all on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy translations_public_read on public.product_translations for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or public.is_admin());
create policy translations_admin_all on public.product_translations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy images_public_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or public.is_admin());
create policy images_admin_all on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_public_read on public.product_variants for select to anon, authenticated using ((is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')) or public.is_admin());
create policy variants_admin_all on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy inventory_admin_only on public.inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy inventory_movements_admin_only on public.inventory_movements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy carts_own on public.carts for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy cart_items_own on public.cart_items for all to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())));
create policy orders_own_read on public.orders for select to authenticated using (buyer_id = auth.uid() or public.is_admin());
create policy orders_admin_all on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_own_read on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or public.is_admin())));
create policy order_items_admin_all on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_own_read on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or public.is_admin())));
create policy payments_admin_all on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reviews_public_approved on public.product_reviews for select to anon, authenticated using (status = 'approved' or buyer_id = auth.uid() or public.is_admin());
create policy reviews_customer_insert on public.product_reviews for insert to authenticated with check (buyer_id = auth.uid() and verified_purchase = false and status = 'pending');
create policy reviews_customer_update_pending on public.product_reviews for update to authenticated using (buyer_id = auth.uid() and status = 'pending') with check (buyer_id = auth.uid() and status = 'pending' and verified_purchase = false);
create policy reviews_admin_all on public.product_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupons_public_valid_read on public.coupons for select to anon, authenticated using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) or public.is_admin());
create policy coupons_admin_all on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_own_read on public.coupon_redemptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy coupon_redemptions_admin_all on public.coupon_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy catalog_events_admin_read on public.catalog_events for select to authenticated using (public.is_admin());
create policy catalog_events_bounded_insert on public.catalog_events for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy b2b_leads_admin_only on public.b2b_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy b2b_leads_public_intake on public.b2b_leads for insert to anon, authenticated with check (status = 'new');

revoke all on all tables in schema public from public, anon, authenticated;
grant select on public.categories, public.products, public.product_translations, public.product_images, public.product_variants, public.product_reviews, public.coupons to anon, authenticated;
grant insert on public.catalog_events, public.b2b_leads to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.addresses, public.carts, public.cart_items, public.product_reviews to authenticated;
grant select on public.user_roles, public.orders, public.order_items, public.payments, public.coupon_redemptions to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

comment on schema public is 'CornerMex A2 single-merchant commerce foundation; no seller marketplace entities.';
