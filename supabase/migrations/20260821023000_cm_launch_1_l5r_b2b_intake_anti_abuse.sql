-- CM-LAUNCH-1 follow-up: B2B intake anti-abuse hardening.
-- Public intake remains server-mediated. Raw IP/contact data is never stored here.

create table if not exists commerce_private.b2b_intake_abuse_budget (
  abuse_key text primary key,
  burst_window_started_at timestamptz not null,
  burst_count integer not null default 0,
  sustained_window_started_at timestamptz not null,
  sustained_count integer not null default 0,
  allowed_count bigint not null default 0,
  blocked_count bigint not null default 0,
  last_seen_at timestamptz not null,
  constraint b2b_intake_abuse_key_shape check (abuse_key ~ '^[0-9a-f]{64}$'),
  constraint b2b_intake_abuse_nonnegative check (
    burst_count >= 0 and sustained_count >= 0 and allowed_count >= 0 and blocked_count >= 0
  )
);

create index if not exists b2b_intake_abuse_budget_last_seen_idx
  on commerce_private.b2b_intake_abuse_budget (last_seen_at);

revoke all on table commerce_private.b2b_intake_abuse_budget
  from public, anon, authenticated, service_role;

create or replace function commerce_private.consume_b2b_intake_budget_v1(
  p_abuse_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_abuse_key text := lower(trim(p_abuse_key));
  v_burst_limit constant integer := 5;
  v_burst_window constant interval := interval '10 minutes';
  v_sustained_limit constant integer := 20;
  v_sustained_window constant interval := interval '24 hours';
  v_row commerce_private.b2b_intake_abuse_budget%rowtype;
  v_retry_at timestamptz;
  v_retry_after integer;
begin
  if v_abuse_key is null or v_abuse_key !~ '^[0-9a-f]{64}$' then
    raise exception 'CM_B2B_ABUSE_KEY_INVALID';
  end if;

  delete from commerce_private.b2b_intake_abuse_budget
   where last_seen_at < p_now - interval '7 days';

  insert into commerce_private.b2b_intake_abuse_budget (
    abuse_key, burst_window_started_at, burst_count,
    sustained_window_started_at, sustained_count,
    allowed_count, blocked_count, last_seen_at
  ) values (v_abuse_key, p_now, 0, p_now, 0, 0, 0, p_now)
  on conflict (abuse_key) do nothing;

  select * into v_row
    from commerce_private.b2b_intake_abuse_budget
   where abuse_key = v_abuse_key
   for update;

  if not found then raise exception 'CM_B2B_ABUSE_BACKEND_UNAVAILABLE'; end if;

  if p_now >= v_row.burst_window_started_at + v_burst_window then
    v_row.burst_window_started_at := p_now;
    v_row.burst_count := 0;
  end if;
  if p_now >= v_row.sustained_window_started_at + v_sustained_window then
    v_row.sustained_window_started_at := p_now;
    v_row.sustained_count := 0;
  end if;

  if v_row.burst_count >= v_burst_limit or v_row.sustained_count >= v_sustained_limit then
    v_retry_at := greatest(
      case when v_row.burst_count >= v_burst_limit
        then v_row.burst_window_started_at + v_burst_window else p_now end,
      case when v_row.sustained_count >= v_sustained_limit
        then v_row.sustained_window_started_at + v_sustained_window else p_now end
    );
    v_retry_after := greatest(1, ceil(extract(epoch from (v_retry_at - p_now)))::integer);
    update commerce_private.b2b_intake_abuse_budget
       set burst_window_started_at = v_row.burst_window_started_at,
           burst_count = v_row.burst_count,
           sustained_window_started_at = v_row.sustained_window_started_at,
           sustained_count = v_row.sustained_count,
           blocked_count = blocked_count + 1,
           last_seen_at = p_now
     where abuse_key = v_abuse_key;
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry_after);
  end if;

  update commerce_private.b2b_intake_abuse_budget
     set burst_window_started_at = v_row.burst_window_started_at,
         burst_count = v_row.burst_count + 1,
         sustained_window_started_at = v_row.sustained_window_started_at,
         sustained_count = v_row.sustained_count + 1,
         allowed_count = allowed_count + 1,
         last_seen_at = p_now
   where abuse_key = v_abuse_key;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function commerce_private.consume_b2b_intake_budget_v1(text, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.submit_b2b_lead_v2(
  p_full_name text, p_company text, p_email text, p_phone text,
  p_country_city text, p_contact_role text, p_business_type text,
  p_products_interest text, p_estimated_volume text, p_message text,
  p_contact_preference text, p_idempotency_key text, p_abuse_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_idempotency_key text := nullif(trim(p_idempotency_key), '');
  v_existing_id uuid;
  v_budget jsonb;
  v_result jsonb;
begin
  if v_idempotency_key is null or char_length(v_idempotency_key) < 8
     or char_length(v_idempotency_key) > 80 then
    raise exception 'CM_B2B_LEAD_IDEMPOTENCY_INVALID';
  end if;

  select id into v_existing_id
    from public.b2b_leads
   where idempotency_key = v_idempotency_key
   limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('id', v_existing_id, 'duplicate', true, 'rate_limited', false);
  end if;

  v_budget := commerce_private.consume_b2b_intake_budget_v1(p_abuse_key, now());
  if coalesce((v_budget ->> 'allowed')::boolean, false) is not true then
    return jsonb_build_object(
      'rate_limited', true,
      'retry_after_seconds', greatest(1, coalesce((v_budget ->> 'retry_after_seconds')::integer, 60))
    );
  end if;

  v_result := public.submit_b2b_lead_v1(
    p_full_name, p_company, p_email, p_phone, p_country_city, p_contact_role,
    p_business_type, p_products_interest, p_estimated_volume, p_message,
    p_contact_preference, v_idempotency_key
  );
  return v_result || jsonb_build_object('rate_limited', false);
end;
$$;

revoke all on function public.submit_b2b_lead_v1(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.submit_b2b_lead_v2(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_b2b_lead_v2(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
