-- CM-COM-4A — Post-order lifecycle foundation.
--
-- PENDING CANONICAL: repository preparation only. This migration MUST NOT be
-- applied without a separate Founder-authorized production rollout.

create table public.order_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  transition_type text not null check (transition_type in ('order_status', 'payment_status')),
  previous_value text not null,
  new_value text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (previous_value <> new_value)
);

create index order_lifecycle_events_order_created_idx
  on public.order_lifecycle_events(order_id, created_at desc);

alter table public.order_lifecycle_events enable row level security;
alter table public.order_lifecycle_events force row level security;

create policy order_lifecycle_events_admin_read
  on public.order_lifecycle_events
  for select
  to authenticated
  using (commerce_private.is_admin((select auth.uid())));

revoke all on public.order_lifecycle_events from public, anon, authenticated, service_role;
grant select on public.order_lifecycle_events to authenticated;
-- The server order-detail path uses its service-role client only after its own
-- authenticated admin check. Grant only the read capability that path needs;
-- no table write privilege is granted to any API role.
grant select on public.order_lifecycle_events to service_role;

-- Read-only capability probe. The UI calls this before enabling privileged
-- controls; when the migration is absent, the missing RPC makes controls fail
-- closed rather than fabricating availability.
create function public.cm_com_4a_order_lifecycle_capability()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select commerce_private.is_admin((select auth.uid()));
$$;

revoke all on function public.cm_com_4a_order_lifecycle_capability()
  from public, anon, service_role;
grant execute on function public.cm_com_4a_order_lifecycle_capability()
  to authenticated;

-- One transaction owns row locking, stale-state detection, transition
-- validation, the state update and its append-only audit event.
create function public.admin_transition_order_lifecycle_v1(
  p_order_id uuid,
  p_transition_type text,
  p_expected_from text,
  p_to text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_current text;
  v_allowed boolean := false;
  v_result_order_status text;
  v_result_payment_status text;
  v_pair_allowed boolean := false;
  v_event_id uuid;
begin
  if v_actor is null then
    raise exception 'CM_COM_4A_UNAUTHENTICATED';
  end if;
  if not commerce_private.is_admin(v_actor) then
    raise exception 'CM_COM_4A_ADMIN_REQUIRED';
  end if;
  if p_order_id is null or p_transition_type is null or p_expected_from is null or p_to is null then
    raise exception 'CM_COM_4A_TRANSITION_INPUT_INVALID';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'CM_COM_4A_ORDER_NOT_FOUND';
  end if;

  if p_transition_type = 'order_status' then
    v_current := v_order.status;
    if p_expected_from not in ('pending','confirmed','processing','shipped','delivered','cancelled')
       or p_to not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
      raise exception 'CM_COM_4A_ORDER_STATE_INVALID';
    end if;
    v_allowed := case p_expected_from
      when 'pending' then p_to in ('confirmed','cancelled')
      when 'confirmed' then p_to in ('processing','cancelled')
      when 'processing' then p_to in ('shipped','cancelled')
      when 'shipped' then p_to = 'delivered'
      else false
    end;
  elsif p_transition_type = 'payment_status' then
    if v_order.payment_method <> 'cod' then
      raise exception 'CM_COM_4A_PAYMENT_METHOD_UNSUPPORTED';
    end if;
    v_current := v_order.payment_status;
    if p_expected_from not in ('pending','under_review','paid','failed','refunded','cancelled')
       or p_to not in ('pending','under_review','paid','failed','refunded','cancelled') then
      raise exception 'CM_COM_4A_PAYMENT_STATE_INVALID';
    end if;
    v_allowed := case p_expected_from
      when 'pending' then p_to in ('under_review','paid','failed','cancelled')
      when 'under_review' then p_to in ('paid','failed','cancelled')
      when 'paid' then p_to = 'refunded'
      when 'failed' then p_to in ('under_review','cancelled')
      else false
    end;
  else
    raise exception 'CM_COM_4A_TRANSITION_TYPE_INVALID';
  end if;

  if v_current <> p_expected_from then
    raise exception 'CM_COM_4A_STALE_STATE';
  end if;
  if not v_allowed then
    raise exception 'CM_COM_4A_TRANSITION_NOT_ALLOWED';
  end if;

  v_result_order_status := case
    when p_transition_type = 'order_status' then p_to
    else v_order.status
  end;
  v_result_payment_status := case
    when p_transition_type = 'payment_status' then p_to
    else v_order.payment_status
  end;

  -- COD combined-state compatibility authority. This executes while the order
  -- row is locked and before either the state row or audit log is mutated.
  v_pair_allowed := case v_result_order_status
    when 'pending' then v_result_payment_status in ('pending','under_review','failed','cancelled')
    when 'confirmed' then v_result_payment_status in ('pending','under_review','paid')
    when 'processing' then v_result_payment_status in ('pending','under_review','paid')
    when 'shipped' then v_result_payment_status in ('pending','under_review','paid')
    when 'delivered' then v_result_payment_status in ('paid','refunded')
    when 'cancelled' then v_result_payment_status in ('pending','failed','refunded','cancelled')
    else false
  end;
  if not v_pair_allowed then
    raise exception 'CM_COM_4A_COMBINED_STATE_INCOMPATIBLE';
  end if;

  if p_transition_type = 'order_status' then
    update public.orders
    set status = p_to, updated_at = now()
    where id = p_order_id;
  else
    update public.orders
    set payment_status = p_to, updated_at = now()
    where id = p_order_id;
  end if;

  insert into public.order_lifecycle_events (
    order_id, transition_type, previous_value, new_value, actor_id
  ) values (
    p_order_id, p_transition_type, v_current, p_to, v_actor
  ) returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'transition_type', p_transition_type,
    'previous_value', v_current,
    'new_value', p_to,
    'event_id', v_event_id
  );
end;
$$;

revoke all on function public.admin_transition_order_lifecycle_v1(uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.admin_transition_order_lifecycle_v1(uuid, text, text, text)
  to authenticated;

comment on table public.order_lifecycle_events is
  'CM-COM-4A append-only evidence for authorized order and payment lifecycle transitions.';
comment on function public.admin_transition_order_lifecycle_v1(uuid, text, text, text) is
  'Admin-only, row-locked and allowlisted CM-COM-4A lifecycle transition transaction.';
