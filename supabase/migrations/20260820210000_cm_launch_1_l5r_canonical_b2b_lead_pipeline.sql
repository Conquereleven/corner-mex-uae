-- CM-LAUNCH-1-L5R
-- Canonical B2B lead intake and admin pipeline.
-- Public enquiries persist through a server-side service-role RPC only.
-- Admin reads and writes use authenticated RPCs with independent admin checks.

alter table public.b2b_leads
  add column if not exists country_city text,
  add column if not exists contact_role text,
  add column if not exists products_interest text,
  add column if not exists estimated_volume text,
  add column if not exists contact_preference text,
  add column if not exists idempotency_key text,
  add column if not exists admin_note text,
  add column if not exists contacted_at timestamptz;

alter table public.b2b_leads drop constraint if exists b2b_leads_status_check;

update public.b2b_leads
   set status = 'quoting', updated_at = now()
 where status = 'qualified';

update public.b2b_leads
   set status = 'won', updated_at = now()
 where status = 'closed';

alter table public.b2b_leads
  add constraint b2b_leads_status_check
  check (status in ('new', 'contacted', 'quoting', 'won', 'lost'));

create unique index if not exists b2b_leads_idempotency_key_uidx
  on public.b2b_leads (idempotency_key)
  where idempotency_key is not null;

create index if not exists b2b_leads_email_created_idx
  on public.b2b_leads (lower(email), created_at desc);

-- Direct browser inserts are retired. Public intake is mediated by
-- submit_b2b_lead_v1 so validation, idempotency and history are atomic.
drop policy if exists b2b_leads_public_intake on public.b2b_leads;
revoke all on table public.b2b_leads from anon, authenticated;

create table if not exists commerce_private.b2b_lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2b_leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint b2b_lead_status_history_from_check
    check (from_status is null or from_status in ('new', 'contacted', 'quoting', 'won', 'lost')),
  constraint b2b_lead_status_history_to_check
    check (to_status in ('new', 'contacted', 'quoting', 'won', 'lost')),
  constraint b2b_lead_status_history_note_length
    check (note is null or char_length(note) <= 4000)
);

create index if not exists b2b_lead_status_history_lead_created_idx
  on commerce_private.b2b_lead_status_history (lead_id, created_at desc);

create table if not exists commerce_private.b2b_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2b_leads(id) on delete cascade,
  author_id uuid,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint b2b_lead_notes_body_check
    check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists b2b_lead_notes_lead_created_idx
  on commerce_private.b2b_lead_notes (lead_id, created_at desc);

revoke all on table commerce_private.b2b_lead_status_history from public, anon, authenticated, service_role;
revoke all on table commerce_private.b2b_lead_notes from public, anon, authenticated, service_role;

create or replace function commerce_private.reject_b2b_lead_history_mutation()
returns trigger
language plpgsql
set search_path = public, commerce_private
as $$
begin
  raise exception 'CM_B2B_LEAD_HISTORY_APPEND_ONLY';
end;
$$;

drop trigger if exists b2b_lead_status_history_append_only
  on commerce_private.b2b_lead_status_history;
create trigger b2b_lead_status_history_append_only
before update or delete on commerce_private.b2b_lead_status_history
for each row execute function commerce_private.reject_b2b_lead_history_mutation();

-- Give any pre-existing lead a truthful initial history event after lifecycle
-- normalization. Production currently has no rows, but replay remains complete.
insert into commerce_private.b2b_lead_status_history (
  lead_id, from_status, to_status, changed_by, note, created_at
)
select l.id, null, l.status, null, 'migration_backfill', l.created_at
  from public.b2b_leads l
 where not exists (
   select 1
     from commerce_private.b2b_lead_status_history h
    where h.lead_id = l.id
 );

create or replace function public.submit_b2b_lead_v1(
  p_full_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_country_city text,
  p_contact_role text,
  p_business_type text,
  p_products_interest text,
  p_estimated_volume text,
  p_message text,
  p_contact_preference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_lead_id uuid;
  v_email text := lower(trim(p_email));
  v_idempotency_key text := nullif(trim(p_idempotency_key), '');
begin
  if p_full_name is null or char_length(trim(p_full_name)) < 2 or char_length(trim(p_full_name)) > 200 then
    raise exception 'CM_B2B_LEAD_NAME_INVALID';
  end if;
  if p_company is null or char_length(trim(p_company)) < 2 or char_length(trim(p_company)) > 200 then
    raise exception 'CM_B2B_LEAD_COMPANY_INVALID';
  end if;
  if v_email is null or char_length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'CM_B2B_LEAD_EMAIL_INVALID';
  end if;
  if p_country_city is null or char_length(trim(p_country_city)) < 2 or char_length(trim(p_country_city)) > 120 then
    raise exception 'CM_B2B_LEAD_LOCATION_INVALID';
  end if;
  if p_business_type is null or char_length(trim(p_business_type)) < 2 or char_length(trim(p_business_type)) > 120 then
    raise exception 'CM_B2B_LEAD_BUSINESS_TYPE_INVALID';
  end if;
  if p_products_interest is null or char_length(trim(p_products_interest)) < 1 or char_length(trim(p_products_interest)) > 1000 then
    raise exception 'CM_B2B_LEAD_PRODUCTS_INVALID';
  end if;
  if p_estimated_volume is null or char_length(trim(p_estimated_volume)) < 1 or char_length(trim(p_estimated_volume)) > 120 then
    raise exception 'CM_B2B_LEAD_VOLUME_INVALID';
  end if;
  if p_phone is not null and char_length(trim(p_phone)) > 60 then
    raise exception 'CM_B2B_LEAD_PHONE_INVALID';
  end if;
  if p_contact_role is not null and char_length(trim(p_contact_role)) > 120 then
    raise exception 'CM_B2B_LEAD_ROLE_INVALID';
  end if;
  if p_message is not null and char_length(p_message) > 2000 then
    raise exception 'CM_B2B_LEAD_MESSAGE_INVALID';
  end if;
  if p_contact_preference is not null and char_length(trim(p_contact_preference)) > 40 then
    raise exception 'CM_B2B_LEAD_CONTACT_PREFERENCE_INVALID';
  end if;
  if v_idempotency_key is null or char_length(v_idempotency_key) < 8 or char_length(v_idempotency_key) > 80 then
    raise exception 'CM_B2B_LEAD_IDEMPOTENCY_INVALID';
  end if;

  select id into v_lead_id
    from public.b2b_leads
   where idempotency_key = v_idempotency_key
   limit 1;
  if v_lead_id is not null then
    return jsonb_build_object('id', v_lead_id, 'duplicate', true);
  end if;

  select id into v_lead_id
    from public.b2b_leads
   where lower(email) = v_email
     and company_name = trim(p_company)
     and coalesce(products_interest, '') = trim(p_products_interest)
     and created_at >= now() - interval '10 minutes'
   order by created_at desc
   limit 1;
  if v_lead_id is not null then
    return jsonb_build_object('id', v_lead_id, 'duplicate', true);
  end if;

  insert into public.b2b_leads (
    company_name,
    contact_name,
    email,
    phone,
    country_city,
    contact_role,
    business_type,
    products_interest,
    estimated_volume,
    message,
    contact_preference,
    idempotency_key,
    status,
    created_at,
    updated_at
  ) values (
    trim(p_company),
    trim(p_full_name),
    v_email,
    nullif(trim(p_phone), ''),
    trim(p_country_city),
    nullif(trim(p_contact_role), ''),
    trim(p_business_type),
    trim(p_products_interest),
    trim(p_estimated_volume),
    nullif(trim(p_message), ''),
    nullif(trim(p_contact_preference), ''),
    v_idempotency_key,
    'new',
    now(),
    now()
  ) returning id into v_lead_id;

  insert into commerce_private.b2b_lead_status_history (
    lead_id, from_status, to_status, changed_by, note
  ) values (
    v_lead_id, null, 'new', null, 'public_intake'
  );

  return jsonb_build_object('id', v_lead_id, 'duplicate', false);
exception
  when unique_violation then
    select id into v_lead_id
      from public.b2b_leads
     where idempotency_key = v_idempotency_key
     limit 1;
    if v_lead_id is not null then
      return jsonb_build_object('id', v_lead_id, 'duplicate', true);
    end if;
    raise;
end;
$$;

revoke all on function public.submit_b2b_lead_v1(text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_b2b_lead_v1(text, text, text, text, text, text, text, text, text, text, text, text)
  to service_role;

create or replace function public.admin_list_b2b_leads_v1(
  p_status text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;
  if p_status not in ('all', 'new', 'contacted', 'quoting', 'won', 'lost') then
    raise exception 'CM_B2B_LEAD_STATUS_INVALID';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'full_name', l.contact_name,
        'company', l.company_name,
        'email', l.email,
        'phone', l.phone,
        'country_city', l.country_city,
        'contact_role', l.contact_role,
        'business_type', l.business_type,
        'products_interest', l.products_interest,
        'estimated_volume', l.estimated_volume,
        'message', l.message,
        'contact_preference', l.contact_preference,
        'status', l.status,
        'admin_note', l.admin_note,
        'contacted_at', l.contacted_at,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ) order by l.created_at desc
    ),
    '[]'::jsonb
  ) into v_result
    from public.b2b_leads l
   where p_status = 'all' or l.status = p_status;

  return v_result;
end;
$$;

revoke all on function public.admin_list_b2b_leads_v1(text) from public, anon, service_role;
grant execute on function public.admin_list_b2b_leads_v1(text) to authenticated;

create or replace function public.admin_get_b2b_lead_v1(
  p_lead_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  select jsonb_build_object(
    'lead', jsonb_build_object(
      'id', l.id,
      'full_name', l.contact_name,
      'company', l.company_name,
      'email', l.email,
      'phone', l.phone,
      'country_city', l.country_city,
      'contact_role', l.contact_role,
      'business_type', l.business_type,
      'products_interest', l.products_interest,
      'estimated_volume', l.estimated_volume,
      'message', l.message,
      'contact_preference', l.contact_preference,
      'status', l.status,
      'admin_note', l.admin_note,
      'contacted_at', l.contacted_at,
      'created_at', l.created_at,
      'updated_at', l.updated_at
    ),
    'history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'lead_id', h.lead_id,
          'from_status', h.from_status,
          'to_status', h.to_status,
          'changed_by', h.changed_by,
          'note', h.note,
          'created_at', h.created_at
        ) order by h.created_at desc
      )
        from commerce_private.b2b_lead_status_history h
       where h.lead_id = l.id
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'lead_id', n.lead_id,
          'author_id', n.author_id,
          'body', n.body,
          'created_at', n.created_at,
          'updated_at', n.updated_at
        ) order by n.created_at desc
      )
        from commerce_private.b2b_lead_notes n
       where n.lead_id = l.id
    ), '[]'::jsonb)
  ) into v_result
    from public.b2b_leads l
   where l.id = p_lead_id;

  if v_result is null then
    raise exception 'CM_B2B_LEAD_NOT_FOUND';
  end if;
  return v_result;
end;
$$;

revoke all on function public.admin_get_b2b_lead_v1(uuid) from public, anon, service_role;
grant execute on function public.admin_get_b2b_lead_v1(uuid) to authenticated;

create or replace function public.admin_update_b2b_lead_v1(
  p_lead_id uuid,
  p_status text default null,
  p_admin_note text default null,
  p_set_admin_note boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_from_status text;
  v_changed boolean := false;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  select status into v_from_status
    from public.b2b_leads
   where id = p_lead_id
   for update;
  if not found then
    raise exception 'CM_B2B_LEAD_NOT_FOUND';
  end if;

  if p_status is not null then
    if p_status not in ('new', 'contacted', 'quoting', 'won', 'lost') then
      raise exception 'CM_B2B_LEAD_STATUS_INVALID';
    end if;
    if p_status <> v_from_status then
      if not (
        (v_from_status = 'new' and p_status in ('contacted', 'lost')) or
        (v_from_status = 'contacted' and p_status in ('quoting', 'lost')) or
        (v_from_status = 'quoting' and p_status in ('won', 'lost'))
      ) then
        raise exception 'CM_B2B_LEAD_TRANSITION_NOT_ALLOWED';
      end if;

      update public.b2b_leads
         set status = p_status,
             contacted_at = case
               when p_status = 'contacted' and contacted_at is null then now()
               else contacted_at
             end,
             updated_at = now()
       where id = p_lead_id;

      insert into commerce_private.b2b_lead_status_history (
        lead_id, from_status, to_status, changed_by
      ) values (
        p_lead_id, v_from_status, p_status, v_actor
      );
      v_changed := true;
    end if;
  end if;

  if p_set_admin_note then
    if p_admin_note is not null and char_length(p_admin_note) > 4000 then
      raise exception 'CM_B2B_LEAD_ADMIN_NOTE_INVALID';
    end if;
    update public.b2b_leads
       set admin_note = nullif(trim(p_admin_note), ''),
           updated_at = now()
     where id = p_lead_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status_changed', v_changed,
    'from_status', v_from_status,
    'to_status', coalesce(p_status, v_from_status)
  );
end;
$$;

revoke all on function public.admin_update_b2b_lead_v1(uuid, text, text, boolean)
  from public, anon, service_role;
grant execute on function public.admin_update_b2b_lead_v1(uuid, text, text, boolean)
  to authenticated;

create or replace function public.admin_add_b2b_lead_note_v1(
  p_lead_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_note_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;
  if not exists (select 1 from public.b2b_leads where id = p_lead_id) then
    raise exception 'CM_B2B_LEAD_NOT_FOUND';
  end if;
  if p_body is null or char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 4000 then
    raise exception 'CM_B2B_LEAD_NOTE_INVALID';
  end if;

  insert into commerce_private.b2b_lead_notes (lead_id, author_id, body)
  values (p_lead_id, v_actor, trim(p_body))
  returning id into v_note_id;

  return jsonb_build_object('ok', true, 'id', v_note_id);
end;
$$;

revoke all on function public.admin_add_b2b_lead_note_v1(uuid, text)
  from public, anon, service_role;
grant execute on function public.admin_add_b2b_lead_note_v1(uuid, text)
  to authenticated;

create or replace function public.admin_delete_b2b_lead_note_v1(
  p_note_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_lead_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  delete from commerce_private.b2b_lead_notes
   where id = p_note_id
   returning lead_id into v_lead_id;
  if v_lead_id is null then
    raise exception 'CM_B2B_LEAD_NOTE_NOT_FOUND';
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id);
end;
$$;

revoke all on function public.admin_delete_b2b_lead_note_v1(uuid)
  from public, anon, service_role;
grant execute on function public.admin_delete_b2b_lead_note_v1(uuid)
  to authenticated;
