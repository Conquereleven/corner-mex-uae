-- CornerMex MX 1 — Mexico market foundation.
--
-- Applies ONLY to a Mexico database, after the canonical migrations in
-- supabase/migrations have been replayed on an empty project
-- (docs/cornermex-mx/DATABASE-BOOTSTRAP.md). It must never be applied to the UAE
-- database: the first statement refuses a database that already holds orders.
--
-- What it adds, on top of the reused canonical schema:
--   1. market identity      — the database states that it is Mexico / MXN
--   2. launch assortment    — a variant is sellable only when it is launch-ACTIVE
--   3. procurement          — suppliers; one SKU, many suppliers, one preferred
--   4. payments             — provider-neutral payment attempts (Mercado Pago, Clip)
--   5. webhook ledger       — replay protection for payment and shipping events
--   6. shipments            — one label per order, bought only after payment
--
-- Money columns inherited from the canonical schema are named *_aed. In this
-- database they hold MXN; the name is historical. New columns here are neutral.

do $$
begin
  if exists (select 1 from public.orders limit 1) then
    raise exception 'MX_BOOTSTRAP_REFUSES_NON_EMPTY_DATABASE';
  end if;
  if exists (select 1 from public.product_variants limit 1) then
    raise exception 'MX_BOOTSTRAP_REFUSES_EXISTING_CATALOGUE';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Market identity
-- ─────────────────────────────────────────────────────────────────────────────

create table commerce_private.market_identity (
  singleton boolean primary key default true check (singleton),
  market text not null check (market = 'MX'),
  currency text not null check (currency = 'MXN'),
  created_at timestamptz not null default now()
);
insert into commerce_private.market_identity (market, currency) values ('MX', 'MXN');

alter table commerce_private.market_identity enable row level security;
alter table commerce_private.market_identity force row level security;
revoke all on table commerce_private.market_identity from public, anon, authenticated, service_role;

-- The application calls this before it prices or places anything. A database
-- without this function is not a Mexico database, and the application refuses it.
create function public.cm_market_identity_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('market', market, 'currency', currency)
  from commerce_private.market_identity
$$;
revoke all on function public.cm_market_identity_v1() from public, anon, authenticated;
grant execute on function public.cm_market_identity_v1() to service_role;

-- Mexico payment methods. Card-through-Stripe and bank transfer stay in the
-- vocabulary only because the canonical functions reference them.
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('card', 'bank_transfer', 'cod', 'mercado_pago', 'clip'));

-- B2B customer accounts were constrained to AED. This database is empty and MXN.
alter table commerce_private.b2b_customer_accounts
  drop constraint b2b_customer_accounts_currency_code_check;
alter table commerce_private.b2b_customer_accounts
  alter column currency_code set default 'MXN';
alter table commerce_private.b2b_customer_accounts
  add constraint b2b_customer_accounts_currency_code_check check (currency_code = 'MXN');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Launch assortment
-- ─────────────────────────────────────────────────────────────────────────────
-- Lead time, minimum order quantity, case pack and reorder point already live in
-- commerce_private.inventory_policies and are reused, not duplicated.

create table commerce_private.variant_launch_profiles (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  launch_status text not null default 'DRAFT'
    check (launch_status in ('DRAFT', 'SOURCING', 'READY', 'ACTIVE', 'PAUSED')),
  b2b_price numeric(12,2) check (b2b_price is null or b2b_price >= 0),
  length_cm numeric(8,2) check (length_cm is null or length_cm > 0),
  width_cm numeric(8,2) check (width_cm is null or width_cm > 0),
  height_cm numeric(8,2) check (height_cm is null or height_cm > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index variant_launch_profiles_status_idx
  on commerce_private.variant_launch_profiles(launch_status);
create trigger variant_launch_profiles_set_updated_at
before update on commerce_private.variant_launch_profiles
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Procurement
-- ─────────────────────────────────────────────────────────────────────────────

create table commerce_private.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 160),
  contact_name text,
  phone text,
  email text,
  location text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger suppliers_set_updated_at
before update on commerce_private.suppliers
for each row execute function public.set_updated_at();

-- One SKU, many suppliers. There is still exactly one product truth: this table
-- holds only what is specific to buying a variant from a supplier.
create table commerce_private.variant_suppliers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  supplier_id uuid not null references commerce_private.suppliers(id) on delete restrict,
  supplier_sku text,
  supplier_cost numeric(12,2) not null check (supplier_cost >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  last_purchase_cost numeric(12,2) check (last_purchase_cost is null or last_purchase_cost >= 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  minimum_purchase_quantity integer not null default 1 check (minimum_purchase_quantity > 0),
  case_pack integer check (case_pack is null or case_pack > 0),
  supplier_availability text not null default 'UNKNOWN'
    check (supplier_availability in ('AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN')),
  last_cost_update timestamptz,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, supplier_id)
);
-- At most one preferred supplier per variant, enforced by the database.
create unique index variant_suppliers_one_preferred_idx
  on commerce_private.variant_suppliers(variant_id) where is_preferred;
create index variant_suppliers_supplier_idx on commerce_private.variant_suppliers(supplier_id);
create trigger variant_suppliers_set_updated_at
before update on commerce_private.variant_suppliers
for each row execute function public.set_updated_at();

-- What a variant still lacks before it may be sold. An empty array means ready.
create function commerce_private.variant_launch_gaps(p_variant_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when v.sku is null or btrim(v.sku) = '' then 'sku' end,
    case when v.price_aed is null or v.price_aed <= 0 then 'retail_price' end,
    case when v.weight_grams is null then 'weight' end,
    case when lp.length_cm is null or lp.width_cm is null or lp.height_cm is null then 'dimensions' end,
    case when lp.b2b_price is null then 'b2b_price' end,
    case when i.variant_id is null then 'inventory_record' end,
    case when ip.case_pack is null then 'case_pack' end,
    case when ip.minimum_order_quantity is null then 'minimum_order_quantity' end,
    case when ps.id is null then 'preferred_supplier' end,
    case when ps.id is not null and ps.lead_time_days is null then 'supplier_lead_time' end,
    case when p.status = 'archived' then 'product_archived' end
  ], null)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join commerce_private.variant_launch_profiles lp on lp.variant_id = v.id
  left join public.inventory i on i.variant_id = v.id
  left join commerce_private.inventory_policies ip on ip.variant_id = v.id
  left join commerce_private.variant_suppliers ps on ps.variant_id = v.id and ps.is_preferred
  where v.id = p_variant_id
$$;
revoke all on function commerce_private.variant_launch_gaps(uuid) from public, anon, authenticated;

-- A variant cannot be switched on behind the launch gate's back.
create function commerce_private.enforce_variant_launch_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and not exists (
    select 1 from commerce_private.variant_launch_profiles lp
    where lp.variant_id = new.id and lp.launch_status = 'ACTIVE'
  ) then
    raise exception 'MX_VARIANT_NOT_LAUNCH_ACTIVE: %', new.id;
  end if;
  return new;
end $$;
create trigger product_variants_launch_gate
before insert or update of is_active on public.product_variants
for each row execute function commerce_private.enforce_variant_launch_gate();

-- The only way a variant changes launch status. READY and ACTIVE are refused
-- while any required commercial or shipping datum is missing.
create function public.cm_mx_set_launch_status_v1(p_variant_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gaps text[];
  v_product uuid;
begin
  if p_status is null or p_status not in ('DRAFT', 'SOURCING', 'READY', 'ACTIVE', 'PAUSED') then
    raise exception 'MX_LAUNCH_STATUS_INVALID';
  end if;
  select product_id into v_product from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'MX_LAUNCH_VARIANT_NOT_FOUND';
  end if;

  if p_status in ('READY', 'ACTIVE') then
    v_gaps := commerce_private.variant_launch_gaps(p_variant_id);
    if coalesce(array_length(v_gaps, 1), 0) > 0 then
      raise exception 'MX_LAUNCH_NOT_READY: %', array_to_string(v_gaps, ',');
    end if;
  end if;

  insert into commerce_private.variant_launch_profiles (variant_id, launch_status)
  values (p_variant_id, p_status)
  on conflict (variant_id) do update set launch_status = excluded.launch_status;

  update public.product_variants
  set is_active = (p_status = 'ACTIVE'), updated_at = now()
  where id = p_variant_id;

  -- A product is listed exactly while it has a launch-ACTIVE variant.
  update public.products p
  set status = case
        when exists (
          select 1 from public.product_variants v
          join commerce_private.variant_launch_profiles lp on lp.variant_id = v.id
          where v.product_id = p.id and lp.launch_status = 'ACTIVE'
        ) then 'active'
        else 'inactive'
      end,
      updated_at = now()
  where p.id = v_product and p.status <> 'archived';

  return jsonb_build_object('variant_id', p_variant_id, 'launch_status', p_status);
end $$;
revoke all on function public.cm_mx_set_launch_status_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.cm_mx_set_launch_status_v1(uuid, text) to service_role;

-- Launch assortment and replenishment view for the admin: every variant with
-- what it still lacks, its stock position and its preferred supplier.
create function public.cm_mx_launch_assortment_v1()
returns table (
  variant_id uuid,
  sku text,
  product_slug text,
  launch_status text,
  gaps text[],
  retail_price numeric,
  b2b_price numeric,
  weight_grams integer,
  on_hand integer,
  reserved integer,
  available integer,
  reorder_point integer,
  case_pack integer,
  minimum_order_quantity integer,
  preferred_supplier text,
  supplier_cost numeric,
  last_purchase_cost numeric,
  lead_time_days integer,
  units_sold_30d bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id, v.sku, p.slug,
    coalesce(lp.launch_status, 'DRAFT'),
    commerce_private.variant_launch_gaps(v.id),
    v.price_aed, lp.b2b_price, v.weight_grams,
    coalesce(i.quantity_on_hand, 0),
    coalesce(i.quantity_reserved, 0),
    coalesce(i.quantity_on_hand, 0) - coalesce(i.quantity_reserved, 0),
    ip.reorder_point, ip.case_pack, ip.minimum_order_quantity,
    s.name, ps.supplier_cost, ps.last_purchase_cost,
    coalesce(ps.lead_time_days, ip.lead_time_days),
    -- A plain trailing count of units sold. Not a forecast.
    coalesce((
      select sum(-m.quantity_delta)
      from public.inventory_movements m
      where m.variant_id = v.id and m.movement_type = 'sale'
        and m.created_at >= now() - interval '30 days'
    ), 0)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join commerce_private.variant_launch_profiles lp on lp.variant_id = v.id
  left join public.inventory i on i.variant_id = v.id
  left join commerce_private.inventory_policies ip on ip.variant_id = v.id
  left join commerce_private.variant_suppliers ps on ps.variant_id = v.id and ps.is_preferred
  left join commerce_private.suppliers s on s.id = ps.supplier_id
  order by p.slug, v.sku
$$;
revoke all on function public.cm_mx_launch_assortment_v1() from public, anon, authenticated;
grant execute on function public.cm_mx_launch_assortment_v1() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Payments
-- ─────────────────────────────────────────────────────────────────────────────
-- Statuses are the canonical ones from public.payments. The normalised states
-- the application uses (CREATED … PARTIALLY_REFUNDED) are a view over them:
-- PARTIALLY_REFUNDED is `paid` with 0 < refunded_amount < amount.

create table commerce_private.mx_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('mercado_pago', 'clip')),
  idempotency_key uuid not null unique,
  provider_payment_id text,
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'authorized', 'paid', 'failed', 'refunded', 'cancelled')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  refunded_amount numeric(12,2) not null default 0,
  raw_status text,
  raw_status_detail text,
  redirect_url text,
  attention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount >= 0 and refunded_amount <= amount),
  unique (provider, provider_payment_id)
);
create index mx_payment_attempts_order_idx on commerce_private.mx_payment_attempts(order_id);
-- An order can be paid at most once.
create unique index mx_payment_attempts_one_paid_idx
  on commerce_private.mx_payment_attempts(order_id) where status = 'paid';
create trigger mx_payment_attempts_set_updated_at
before update on commerce_private.mx_payment_attempts
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Webhook ledger (payments and shipping)
-- ─────────────────────────────────────────────────────────────────────────────

create table commerce_private.integration_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('mercado_pago', 'clip', 'skydropx', 'solo_envios')),
  external_event_id text not null,
  payload_hash text not null,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  unique (provider, external_event_id)
);

-- True when the caller now owns the event: it is new, or its only earlier
-- attempt failed. False for an event being processed or already processed.
create function public.cm_mx_claim_webhook_event_v1(
  p_provider text, p_external_event_id text, p_payload_hash text, p_raw_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into commerce_private.integration_webhook_events
    (provider, external_event_id, payload_hash, raw_payload)
  values (p_provider, p_external_event_id, p_payload_hash, p_raw_payload)
  on conflict (provider, external_event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    return true;
  end if;

  update commerce_private.integration_webhook_events
  set processing_status = 'processing', processed_at = null, received_at = now()
  where provider = p_provider and external_event_id = p_external_event_id
    and processing_status = 'failed';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create function public.cm_mx_complete_webhook_event_v1(
  p_provider text, p_external_event_id text, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('processed', 'ignored', 'failed') then
    raise exception 'MX_WEBHOOK_STATUS_INVALID';
  end if;
  update commerce_private.integration_webhook_events
  set processing_status = p_status, processed_at = now()
  where provider = p_provider and external_event_id = p_external_event_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Order creation and payment application
-- ─────────────────────────────────────────────────────────────────────────────

-- Wraps the canonical idempotent order transaction. It adds two Mexico rules
-- and reimplements nothing: every item must be launch-ACTIVE, and the order
-- records the payment method the customer chose. Stock is taken when the order
-- is created and returned if the payment fails.
create function public.cm_mx_create_order_v1(
  p_buyer_id uuid,
  p_guest_email text,
  p_operation_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_shipping numeric,
  p_tax_rate numeric,
  p_legal_acceptance jsonb,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_current text;
begin
  if p_payment_method is null or p_payment_method not in ('mercado_pago', 'clip', 'cod') then
    raise exception 'MX_ORDER_PAYMENT_METHOD_INVALID';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'COD_ITEMS_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join commerce_private.variant_launch_profiles lp
      on lp.variant_id = (e->>'variant_id')::uuid
    where lp.launch_status is distinct from 'ACTIVE'
  ) then
    raise exception 'MX_ORDER_VARIANT_NOT_ACTIVE';
  end if;

  v_result := public.cm_create_cod_order_v2(
    p_buyer_id, p_guest_email, p_operation_id, p_items,
    p_shipping_address, p_shipping, p_tax_rate, p_legal_acceptance
  );
  v_order_id := (v_result->>'order_id')::uuid;

  select payment_method into v_current from public.orders where id = v_order_id for update;
  if (v_result->>'replayed')::boolean then
    -- The same operation cannot come back asking for a different method.
    if v_current is distinct from p_payment_method then
      raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT';
    end if;
  else
    update public.orders set payment_method = p_payment_method, updated_at = now()
    where id = v_order_id;
  end if;

  return v_result || jsonb_build_object('payment_method', p_payment_method);
end $$;

-- Opens (or returns) the payment attempt for an order. The amount is read from
-- the order row: the caller cannot supply one.
create function public.cm_mx_start_payment_attempt_v1(
  p_order_id uuid, p_provider text, p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_attempt commerce_private.mx_payment_attempts%rowtype;
begin
  if p_idempotency_key is null then
    raise exception 'MX_PAYMENT_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'MX_PAYMENT_ORDER_NOT_FOUND';
  end if;
  if v_order.payment_method is distinct from p_provider then
    raise exception 'MX_PAYMENT_PROVIDER_MISMATCH';
  end if;

  select * into v_attempt from commerce_private.mx_payment_attempts
  where idempotency_key = p_idempotency_key;
  if found then
    if v_attempt.order_id <> p_order_id or v_attempt.provider <> p_provider then
      raise exception 'MX_PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;
  else
    if v_order.status <> 'pending' or v_order.payment_status <> 'pending' then
      raise exception 'MX_PAYMENT_ORDER_NOT_PAYABLE';
    end if;
    insert into commerce_private.mx_payment_attempts (order_id, provider, idempotency_key, amount)
    values (p_order_id, p_provider, p_idempotency_key, v_order.total_aed)
    returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'order_number', v_order.order_number,
    'amount', v_attempt.amount,
    'currency', v_attempt.currency,
    'status', v_attempt.status,
    'provider_payment_id', v_attempt.provider_payment_id,
    'redirect_url', v_attempt.redirect_url
  );
end $$;

-- Records the provider's id for an attempt, once.
create function public.cm_mx_bind_payment_attempt_v1(
  p_attempt_id uuid, p_provider_payment_id text, p_raw_status text,
  p_raw_status_detail text, p_redirect_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
    raise exception 'MX_PAYMENT_PROVIDER_ID_REQUIRED';
  end if;
  select provider_payment_id into v_existing from commerce_private.mx_payment_attempts
  where id = p_attempt_id for update;
  if not found then
    raise exception 'MX_PAYMENT_ATTEMPT_NOT_FOUND';
  end if;
  if v_existing is not null and v_existing <> p_provider_payment_id then
    raise exception 'MX_PAYMENT_ATTEMPT_ALREADY_BOUND';
  end if;
  update commerce_private.mx_payment_attempts
  set provider_payment_id = p_provider_payment_id,
      raw_status = p_raw_status,
      raw_status_detail = p_raw_status_detail,
      redirect_url = p_redirect_url
  where id = p_attempt_id;
end $$;

create function public.cm_mx_payment_attempt_v1(p_provider text, p_provider_payment_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'order_id', a.order_id,
    'order_number', o.order_number,
    'provider', a.provider,
    'provider_payment_id', a.provider_payment_id,
    'amount', a.amount,
    'currency', a.currency,
    'status', a.status,
    'refunded_amount', a.refunded_amount
  )
  from commerce_private.mx_payment_attempts a
  join public.orders o on o.id = a.order_id
  where a.provider = p_provider and a.provider_payment_id = p_provider_payment_id
$$;

-- The live attempt for an order, for the return page and for reconciliation.
create function public.cm_mx_order_payment_attempt_v1(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'attempt_id', a.id,
    'order_id', a.order_id,
    'order_number', o.order_number,
    'provider', a.provider,
    'provider_payment_id', a.provider_payment_id,
    'amount', a.amount,
    'currency', a.currency,
    'status', a.status,
    'refunded_amount', a.refunded_amount
  )
  from commerce_private.mx_payment_attempts a
  join public.orders o on o.id = a.order_id
  where a.order_id = p_order_id and a.provider_payment_id is not null
  order by a.created_at desc
  limit 1
$$;

-- Applies a payment status the application READ from the provider. Everything
-- the order needs happens in this one transaction: the attempt, the order's
-- payment status, confirmation, or cancellation with stock release.
create function public.cm_mx_apply_payment_state_v1(
  p_provider text,
  p_provider_payment_id text,
  p_status text,
  p_amount numeric,
  p_refunded_amount numeric,
  p_raw_status text,
  p_raw_status_detail text,
  p_late_capture boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt commerce_private.mx_payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_fulfillment boolean := false;
  v_released boolean := false;
begin
  if p_status is null or p_status not in
     ('pending', 'under_review', 'authorized', 'paid', 'failed', 'refunded', 'cancelled') then
    raise exception 'MX_PAYMENT_STATUS_INVALID';
  end if;

  select * into v_attempt from commerce_private.mx_payment_attempts
  where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then
    raise exception 'MX_PAYMENT_ATTEMPT_NOT_FOUND';
  end if;
  select * into v_order from public.orders where id = v_attempt.order_id for update;

  -- Defence in depth: the application already compared amounts, and the database
  -- refuses to record money for an amount other than the order's.
  if p_status in ('paid', 'authorized') and p_amount is distinct from v_attempt.amount then
    update commerce_private.mx_payment_attempts
    set attention = 'AMOUNT_MISMATCH', raw_status = p_raw_status, raw_status_detail = p_raw_status_detail
    where id = v_attempt.id;
    update public.orders set payment_status = 'under_review', updated_at = now()
    where id = v_order.id and payment_status = 'pending';
    return jsonb_build_object('applied', false, 'reason', 'AMOUNT_MISMATCH');
  end if;
  if coalesce(p_refunded_amount, 0) < 0 or coalesce(p_refunded_amount, 0) > v_attempt.amount then
    raise exception 'MX_PAYMENT_REFUND_AMOUNT_INVALID';
  end if;

  update commerce_private.mx_payment_attempts
  set status = p_status,
      refunded_amount = coalesce(p_refunded_amount, refunded_amount),
      raw_status = p_raw_status,
      raw_status_detail = p_raw_status_detail,
      attention = case when p_late_capture then 'CAPTURE_ON_CANCELLED_ORDER' else attention end
  where id = v_attempt.id;

  if p_status = 'paid' then
    if p_late_capture or v_order.status = 'cancelled' then
      -- Real money on an order that was already cancelled: a person decides
      -- whether to refund or re-open. Nothing ships automatically.
      update public.orders set payment_status = 'under_review', updated_at = now()
      where id = v_order.id;
    else
      update public.orders
      set payment_status = 'paid',
          status = case when status = 'pending' then 'confirmed' else status end,
          updated_at = now()
      where id = v_order.id;
      v_fulfillment := true;
    end if;
  elsif p_status in ('failed', 'cancelled') then
    -- Only when no other attempt for the order is still alive or paid.
    if not exists (
      select 1 from commerce_private.mx_payment_attempts a
      where a.order_id = v_order.id and a.id <> v_attempt.id
        and a.status in ('pending', 'under_review', 'authorized', 'paid')
    ) and v_order.status = 'pending' then
      update public.orders
      set payment_status = p_status, status = 'cancelled', updated_at = now()
      where id = v_order.id;
      perform public.cm_release_order_stock_v1(v_order.id, 'mx_payment_' || p_status);
      v_released := true;
    end if;
  elsif p_status = 'refunded' then
    update public.orders set payment_status = 'refunded', updated_at = now()
    where id = v_order.id;
  elsif p_status = 'under_review' then
    update public.orders set payment_status = 'under_review', updated_at = now()
    where id = v_order.id and payment_status = 'pending';
  end if;

  return jsonb_build_object(
    'applied', true,
    'order_id', v_order.id,
    'fulfillment_eligible', v_fulfillment,
    'stock_released', v_released
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Shipments
-- ─────────────────────────────────────────────────────────────────────────────

create table commerce_private.shipments (
  id uuid primary key default gen_random_uuid(),
  -- One label per order: the unique constraint is the duplicate-label guard.
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null check (provider in ('skydropx', 'solo_envios', 'manual')),
  provider_rate_id text not null,
  provider_shipment_id text,
  reservation_state text not null default 'RESERVED'
    check (reservation_state in ('RESERVED', 'PURCHASED', 'AMBIGUOUS', 'FAILED')),
  status text not null default 'LABEL_PENDING'
    check (status in ('QUOTE_CREATED', 'LABEL_PENDING', 'LABEL_CREATED', 'READY_FOR_PICKUP',
                      'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED', 'RETURNED')),
  raw_status text,
  carrier text,
  master_tracking_number text,
  tracking_url text,
  label_url text,
  cost numeric(12,2) check (cost is null or cost >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipments_set_updated_at
before update on commerce_private.shipments
for each row execute function public.set_updated_at();

create table commerce_private.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references commerce_private.shipments(id) on delete cascade,
  status text,
  raw_status text,
  description text,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);
create index shipment_events_shipment_idx on commerce_private.shipment_events(shipment_id, created_at);

-- Reserves the order's single label slot. Refused until payment is confirmed
-- (or, for a cash-on-delivery order, until an operator has confirmed the order).
-- True when the caller now holds the reservation; false when one already exists.
create function public.cm_mx_reserve_label_v1(p_order_id uuid, p_provider text, p_provider_rate_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_rows integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'MX_LABEL_ORDER_NOT_FOUND';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'MX_LABEL_ORDER_CANCELLED';
  end if;
  if not (
    v_order.payment_status = 'paid'
    or (v_order.payment_method = 'cod' and v_order.status in ('confirmed', 'processing'))
  ) then
    raise exception 'MX_LABEL_REQUIRES_CONFIRMED_PAYMENT';
  end if;

  insert into commerce_private.shipments (order_id, provider, provider_rate_id)
  values (p_order_id, p_provider, p_provider_rate_id)
  on conflict (order_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- Applies a carrier status to the order's shipment. The application has already
-- authenticated the event and mapped the provider status; this function makes
-- the change monotonic (a late or replayed event never moves a shipment
-- backwards or out of a terminal state) and records every event, mapped or not.
create function public.cm_mx_apply_shipment_event_v1(
  p_provider text,
  p_provider_shipment_id text,
  p_status text,
  p_raw_status text,
  p_tracking_number text,
  p_tracking_url text,
  p_label_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipment commerce_private.shipments%rowtype;
  v_rank constant jsonb := '{"QUOTE_CREATED":0,"LABEL_PENDING":1,"LABEL_CREATED":2,"READY_FOR_PICKUP":3,
    "IN_TRANSIT":4,"OUT_FOR_DELIVERY":5,"EXCEPTION":5,"DELIVERED":9,"RETURNED":9,"CANCELLED":9}'::jsonb;
  v_next text;
begin
  if p_status is not null and not (v_rank ? p_status) then
    raise exception 'MX_SHIPMENT_STATUS_INVALID';
  end if;
  select * into v_shipment from commerce_private.shipments
  where provider = p_provider and provider_shipment_id = p_provider_shipment_id for update;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'UNKNOWN_SHIPMENT');
  end if;

  insert into commerce_private.shipment_events (shipment_id, status, raw_status, occurred_at)
  values (v_shipment.id, p_status, p_raw_status, now());

  v_next := v_shipment.status;
  if p_status is not null and p_status <> v_shipment.status
     and v_shipment.status not in ('DELIVERED', 'RETURNED', 'CANCELLED') then
    if v_shipment.status = 'EXCEPTION' or p_status = 'EXCEPTION'
       or (v_rank->>p_status)::int >= (v_rank->>v_shipment.status)::int then
      v_next := p_status;
    end if;
  end if;

  update commerce_private.shipments
  set status = v_next,
      raw_status = coalesce(p_raw_status, raw_status),
      master_tracking_number = coalesce(p_tracking_number, master_tracking_number),
      tracking_url = coalesce(p_tracking_url, tracking_url),
      label_url = coalesce(nullif(p_label_url, ''), label_url)
  where id = v_shipment.id;

  -- The order follows its shipment forward, never backward.
  if v_next = 'DELIVERED' then
    update public.orders set status = 'delivered', updated_at = now()
    where id = v_shipment.order_id and status in ('confirmed', 'processing', 'shipped');
  elsif v_next in ('IN_TRANSIT', 'OUT_FOR_DELIVERY') then
    update public.orders set status = 'shipped', updated_at = now()
    where id = v_shipment.order_id and status in ('confirmed', 'processing');
  end if;

  return jsonb_build_object(
    'applied', true, 'order_id', v_shipment.order_id,
    'status', v_next, 'changed', v_next <> v_shipment.status
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Access: private tables are reachable only through the functions above, and
-- the functions only by the service role.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  f text;
begin
  foreach t in array array[
    'variant_launch_profiles', 'suppliers', 'variant_suppliers', 'mx_payment_attempts',
    'integration_webhook_events', 'shipments', 'shipment_events'
  ] loop
    execute format('alter table commerce_private.%I enable row level security', t);
    execute format('alter table commerce_private.%I force row level security', t);
    execute format('revoke all on table commerce_private.%I from public, anon, authenticated', t);
  end loop;
  -- Operators manage suppliers and launch data through the service role.
  foreach t in array array['variant_launch_profiles', 'suppliers', 'variant_suppliers'] loop
    execute format('grant select, insert, update, delete on table commerce_private.%I to service_role', t);
  end loop;
  foreach t in array array['mx_payment_attempts', 'integration_webhook_events', 'shipments', 'shipment_events'] loop
    execute format('grant select on table commerce_private.%I to service_role', t);
  end loop;

  for f in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'cm_mx_claim_webhook_event_v1', 'cm_mx_complete_webhook_event_v1', 'cm_mx_create_order_v1',
      'cm_mx_start_payment_attempt_v1', 'cm_mx_bind_payment_attempt_v1', 'cm_mx_payment_attempt_v1',
      'cm_mx_order_payment_attempt_v1',
      'cm_mx_apply_payment_state_v1', 'cm_mx_reserve_label_v1', 'cm_mx_apply_shipment_event_v1'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
