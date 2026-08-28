-- CM-PAY-STRIPE-1 — Stripe Checkout payment authority foundation.
--
-- PENDING CANONICAL: repository preparation only.  This migration is NOT
-- applied to any environment by this change.  Production application requires
-- a separate Founder production gate and a reviewed Stripe endpoint setup.
--
-- The private event ledger intentionally stores identifiers and state only:
-- never webhook payloads, card data, or Stripe secrets.

create schema if not exists commerce_private;

create table commerce_private.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'stripe'),
  provider_event_id text not null,
  event_type text not null check (event_type in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
    'charge.refunded'
  )),
  provider_object_id text not null,
  payment_id uuid not null references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  provider_created_at timestamptz,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table commerce_private.payment_webhook_events enable row level security;
alter table commerce_private.payment_webhook_events force row level security;
revoke all on commerce_private.payment_webhook_events from public, anon, authenticated;
grant select, insert on commerce_private.payment_webhook_events to service_role;

create unique index payments_stripe_checkout_session_unique_idx
  on public.payments(provider, provider_reference)
  where provider = 'stripe'
    and provider_reference is not null
    and provider_reference not like 'stripe-attempt:%';

-- Server-only: creates (or safely resumes) one local payment attempt before a
-- Checkout Session is created. The stable attempt UUID is used as Stripe's
-- idempotency key, so an ambiguous provider timeout retries the same attempt.
create function public.cm_pay_create_stripe_attempt_v1(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_order_id is null then raise exception 'CM_PAY_ORDER_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'CM_PAY_ORDER_NOT_FOUND'; end if;
  if v_order.payment_method <> 'card' then raise exception 'CM_PAY_CARD_REQUIRED'; end if;
  if v_order.status <> 'pending' then raise exception 'CM_PAY_ORDER_NOT_PENDING'; end if;
  if v_order.payment_status not in ('pending', 'failed') then
    raise exception 'CM_PAY_ORDER_NOT_PAYABLE';
  end if;

  select * into v_payment
    from public.payments
   where order_id = p_order_id
     and provider = 'stripe'
     and status in ('pending', 'under_review')
   order by created_at desc
   limit 1
   for update;

  if not found then
    insert into public.payments (order_id, provider, provider_reference, status, amount_aed, metadata)
    values (
      p_order_id,
      'stripe',
      'stripe-attempt:' || gen_random_uuid()::text,
      'pending',
      v_order.total_aed,
      jsonb_build_object('attempt_state', 'created')
    )
    returning * into v_payment;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'amount_aed', v_payment.amount_aed,
    'provider_reference', v_payment.provider_reference
  );
end;
$$;

-- Server-only: binds the trusted local attempt to the Checkout Session. The
-- webhook independently validates the same signed metadata before mutation.
create function public.cm_pay_bind_stripe_checkout_session_v1(
  p_payment_id uuid,
  p_session_id text,
  p_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_payment public.payments%rowtype;
begin
  if p_payment_id is null or p_session_id !~ '^cs_' then
    raise exception 'CM_PAY_STRIPE_SESSION_INVALID';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.provider <> 'stripe' then raise exception 'CM_PAY_ATTEMPT_NOT_FOUND'; end if;
  if v_payment.status not in ('pending', 'under_review') then
    raise exception 'CM_PAY_ATTEMPT_NOT_BINDABLE';
  end if;
  if v_payment.provider_reference !~ '^stripe-attempt:' and v_payment.provider_reference <> p_session_id then
    raise exception 'CM_PAY_SESSION_LINK_CONFLICT';
  end if;
  update public.payments
     set provider_reference = p_session_id,
         metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
           'attempt_state', 'checkout_created',
           'stripe_payment_intent_id', p_payment_intent_id
         )),
         updated_at = now()
   where id = p_payment_id;
  return jsonb_build_object('ok', true, 'payment_id', p_payment_id, 'session_id', p_session_id);
end;
$$;

-- Server-only: records a verified Stripe event exactly once and changes only
-- the matching attempt/order in the same database transaction. A late failure
-- or expiry cannot overwrite paid truth; partial refunds remain paid because
-- the existing public order enum intentionally has no partial_refunded state.
create function public.cm_pay_process_stripe_webhook_v1(
  p_event_id text,
  p_event_type text,
  p_provider_object_id text,
  p_payment_id uuid,
  p_order_id uuid,
  p_currency text,
  p_amount_aed numeric,
  p_provider_created_at timestamptz default null,
  p_payment_status text default null,
  p_payment_intent_id text default null,
  p_refunded_amount_aed numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, commerce_private
as $$
declare
  v_event_id uuid;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_next text;
  v_refunded numeric(12,2);
  v_changed boolean := false;
begin
  if p_event_id is null or p_event_id !~ '^evt_' or p_payment_id is null or p_order_id is null
     or p_provider_object_id is null or p_currency <> 'aed' or p_amount_aed is null or p_amount_aed < 0 then
    raise exception 'CM_PAY_WEBHOOK_INPUT_INVALID';
  end if;
  if p_event_type not in (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'checkout.session.expired', 'charge.refunded'
  ) then raise exception 'CM_PAY_WEBHOOK_EVENT_UNSUPPORTED'; end if;

  insert into commerce_private.payment_webhook_events (
    provider, provider_event_id, event_type, provider_object_id, payment_id, order_id, provider_created_at
  ) values ('stripe', p_event_id, p_event_type, p_provider_object_id, p_payment_id, p_order_id, p_provider_created_at)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'mutated', false);
  end if;

  select * into v_payment
    from public.payments
   where id = p_payment_id and order_id = p_order_id
   for update;
  if not found or v_payment.provider <> 'stripe' then raise exception 'CM_PAY_WEBHOOK_LINK_INVALID'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then raise exception 'CM_PAY_WEBHOOK_LINK_INVALID'; end if;
  if v_payment.amount_aed <> p_amount_aed or v_order.total_aed <> p_amount_aed then
    raise exception 'CM_PAY_WEBHOOK_AMOUNT_MISMATCH';
  end if;

  if p_event_type = 'charge.refunded' then
    if coalesce(v_payment.metadata->>'stripe_payment_intent_id', '') <> coalesce(p_payment_intent_id, '') then
      raise exception 'CM_PAY_WEBHOOK_PAYMENT_INTENT_MISMATCH';
    end if;
    v_refunded := least(p_amount_aed, greatest(0, coalesce(p_refunded_amount_aed, 0)));
    v_next := case when v_refunded >= p_amount_aed then 'refunded' else 'paid' end;
  else
    if p_provider_object_id !~ '^cs_' then raise exception 'CM_PAY_WEBHOOK_SESSION_INVALID'; end if;
    if v_payment.provider_reference ~ '^stripe-attempt:' then
      update public.payments
         set provider_reference = p_provider_object_id,
             metadata = metadata || jsonb_strip_nulls(jsonb_build_object('stripe_payment_intent_id', p_payment_intent_id)),
             updated_at = now()
       where id = v_payment.id;
      v_payment.provider_reference := p_provider_object_id;
    elsif v_payment.provider_reference <> p_provider_object_id then
      raise exception 'CM_PAY_WEBHOOK_SESSION_LINK_MISMATCH';
    end if;
    v_next := case
      when p_event_type = 'checkout.session.completed' and p_payment_status = 'paid' then 'paid'
      when p_event_type = 'checkout.session.completed' and p_payment_status = 'unpaid' then 'under_review'
      when p_event_type = 'checkout.session.async_payment_succeeded' then 'paid'
      when p_event_type = 'checkout.session.async_payment_failed' then 'failed'
      when p_event_type = 'checkout.session.expired' then 'cancelled'
      else null
    end;
    if v_next is null then raise exception 'CM_PAY_WEBHOOK_STATUS_INVALID'; end if;
  end if;

  -- Monotonic protection against delayed/out-of-order provider delivery.
  if v_payment.status = 'refunded' or (v_payment.status = 'paid' and v_next in ('failed', 'cancelled', 'under_review')) then
    return jsonb_build_object('ok', true, 'duplicate', false, 'mutated', false, 'ignored_as_stale', true);
  end if;

  update public.payments
     set status = v_next,
         metadata = metadata || jsonb_strip_nulls(jsonb_build_object('refunded_amount_aed', v_refunded)),
         updated_at = now()
   where id = v_payment.id
     and (status <> v_next or coalesce((metadata->>'refunded_amount_aed')::numeric, -1) <> coalesce(v_refunded, -1));
  v_changed := found;

  -- CornerMex remains order authority. Payment events only change payment
  -- state; they do not fulfill, invoice, or call Zoho from this function.
  if v_next = 'paid' then
    update public.orders set payment_status = 'paid', updated_at = now()
     where id = v_order.id and payment_status <> 'paid';
  elsif v_next = 'refunded' then
    update public.orders set payment_status = 'refunded', updated_at = now()
     where id = v_order.id and payment_status <> 'refunded';
  elsif v_next in ('failed', 'cancelled') and v_order.payment_status <> 'paid' then
    update public.orders set payment_status = v_next, updated_at = now()
     where id = v_order.id and payment_status <> v_next;
  elsif v_next = 'under_review' and v_order.payment_status = 'pending' then
    update public.orders set payment_status = 'under_review', updated_at = now()
     where id = v_order.id;
  end if;
  return jsonb_build_object('ok', true, 'duplicate', false, 'mutated', v_changed, 'payment_status', v_next);
end;
$$;

create function public.cm_pay_note_stripe_attempt_degraded_v1(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.provider <> 'stripe' then raise exception 'CM_PAY_ATTEMPT_NOT_FOUND'; end if;
  if v_payment.status in ('pending', 'under_review') then
    -- A network timeout is ambiguous: Stripe may have created the Checkout
    -- Session even when this server did not receive it. Keep the same attempt
    -- pending so a retry reuses its idempotency key rather than making a new
    -- potentially chargeable attempt.
    update public.payments set metadata = metadata || jsonb_build_object('attempt_state', 'provider_unavailable'), updated_at = now()
      where id = p_payment_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cm_pay_create_stripe_attempt_v1(uuid) from public, anon, authenticated;
revoke all on function public.cm_pay_bind_stripe_checkout_session_v1(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cm_pay_process_stripe_webhook_v1(text, text, text, uuid, uuid, text, numeric, timestamptz, text, text, numeric) from public, anon, authenticated;
revoke all on function public.cm_pay_note_stripe_attempt_degraded_v1(uuid) from public, anon, authenticated;
grant execute on function public.cm_pay_create_stripe_attempt_v1(uuid) to service_role;
grant execute on function public.cm_pay_bind_stripe_checkout_session_v1(uuid, text, text) to service_role;
grant execute on function public.cm_pay_process_stripe_webhook_v1(text, text, text, uuid, uuid, text, numeric, timestamptz, text, text, numeric) to service_role;
grant execute on function public.cm_pay_note_stripe_attempt_degraded_v1(uuid) to service_role;

comment on table commerce_private.payment_webhook_events is
  'CM-PAY-STRIPE-1 private idempotency ledger. Stores no raw payment data or webhook payloads.';
