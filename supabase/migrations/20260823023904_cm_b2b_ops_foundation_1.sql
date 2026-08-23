-- CM-B2B-OPS-FOUNDATION-1
-- Private, additive contracts for B2B accounts, saved lists, exact variant
-- pricing and deterministic inventory policy inputs.
--
-- Canonical authorities intentionally reused:
--   public.products / public.product_variants  catalog and sell price
--   public.inventory                           on-hand and reserved stock
--   public.orders / public.order_items         order history
--   auth.users / public.profiles                human identity
--
-- This migration creates no RPCs, grants, public views, purchase orders,
-- supplier mutations, recommendation snapshots or automatic ordering path.

create table commerce_private.b2b_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (length(btrim(legal_name)) between 1 and 200),
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'inactive')),
  currency_code text not null default 'AED' check (currency_code = 'AED'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table commerce_private.b2b_account_users (
  account_id uuid not null references commerce_private.b2b_customer_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'account_admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table commerce_private.b2b_account_variant_prices (
  account_id uuid not null references commerce_private.b2b_customer_accounts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price_aed numeric(12,2) not null check (price_aed >= 0),
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, variant_id),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table commerce_private.saved_lists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references commerce_private.b2b_customer_accounts(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table commerce_private.saved_list_items (
  id uuid primary key default gen_random_uuid(),
  saved_list_id uuid not null references commerce_private.saved_lists(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  desired_quantity integer not null check (desired_quantity between 1 and 100000),
  sort_position integer not null check (sort_position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (saved_list_id, variant_id),
  unique (saved_list_id, sort_position)
);

create table commerce_private.inventory_policies (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  minimum_order_quantity integer check (minimum_order_quantity is null or minimum_order_quantity > 0),
  case_pack integer check (case_pack is null or case_pack > 0),
  safety_stock integer check (safety_stock is null or safety_stock >= 0),
  reorder_point integer check (reorder_point is null or reorder_point >= 0),
  target_stock integer check (target_stock is null or target_stock >= 0),
  service_level_target numeric(5,4)
    check (service_level_target is null or service_level_target between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_stock is null or reorder_point is null or target_stock >= reorder_point)
);

create index b2b_account_users_user_idx
  on commerce_private.b2b_account_users(user_id, status, account_id);
create index saved_lists_account_updated_idx
  on commerce_private.saved_lists(account_id, updated_at desc);
create index saved_list_items_list_order_idx
  on commerce_private.saved_list_items(saved_list_id, sort_position);

create trigger b2b_customer_accounts_set_updated_at
before update on commerce_private.b2b_customer_accounts
for each row execute function public.set_updated_at();
create trigger b2b_account_users_set_updated_at
before update on commerce_private.b2b_account_users
for each row execute function public.set_updated_at();
create trigger b2b_account_variant_prices_set_updated_at
before update on commerce_private.b2b_account_variant_prices
for each row execute function public.set_updated_at();
create trigger saved_lists_set_updated_at
before update on commerce_private.saved_lists
for each row execute function public.set_updated_at();
create trigger saved_list_items_set_updated_at
before update on commerce_private.saved_list_items
for each row execute function public.set_updated_at();
create trigger inventory_policies_set_updated_at
before update on commerce_private.inventory_policies
for each row execute function public.set_updated_at();

alter table commerce_private.b2b_customer_accounts enable row level security;
alter table commerce_private.b2b_customer_accounts force row level security;
alter table commerce_private.b2b_account_users enable row level security;
alter table commerce_private.b2b_account_users force row level security;
alter table commerce_private.b2b_account_variant_prices enable row level security;
alter table commerce_private.b2b_account_variant_prices force row level security;
alter table commerce_private.saved_lists enable row level security;
alter table commerce_private.saved_lists force row level security;
alter table commerce_private.saved_list_items enable row level security;
alter table commerce_private.saved_list_items force row level security;
alter table commerce_private.inventory_policies enable row level security;
alter table commerce_private.inventory_policies force row level security;

-- Private by default: no row policies and no direct application-role grants.
-- A later PR must add reviewed account-scoped server/RPC access before runtime use.
revoke all on table commerce_private.b2b_customer_accounts
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.b2b_account_users
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.b2b_account_variant_prices
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.saved_lists
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.saved_list_items
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.inventory_policies
  from public, anon, authenticated, service_role;

comment on table commerce_private.b2b_account_variant_prices is
  'Exact account plus canonical variant AED override. Runtime precedence: active applicable override, then canonical product_variants.price_aed; never zero by omission.';
comment on table commerce_private.inventory_policies is
  'Manual deterministic policy inputs only. avg_daily_demand is deliberately not stored or fabricated here.';
comment on table commerce_private.saved_lists is
  'Account-owned planning convenience only; saved lists never create orders automatically.';
