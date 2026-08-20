-- CM-LAUNCH-1-L5R operating layer
-- Extends the canonical B2B lead intake with human-owned commercial follow-up.
-- This migration prepares repository schema only. It does not send messages,
-- create orders, mutate inventory, or approve commercial terms.

alter table public.b2b_leads
  add column if not exists website text,
  add column if not exists decision_maker text,
  add column if not exists qualification_score integer,
  add column if not exists priority text not null default 'unassigned',
  add column if not exists owner text,
  add column if not exists source_url text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_action text,
  add column if not exists next_action_at timestamptz,
  add column if not exists blocker text,
  add column if not exists first_order_id uuid references public.orders(id) on delete set null,
  add column if not exists first_order_linked_at timestamptz,
  add column if not exists quote_draft jsonb,
  add column if not exists quote_draft_updated_at timestamptz;

alter table public.b2b_leads
  drop constraint if exists b2b_leads_qualification_score_check;
alter table public.b2b_leads
  add constraint b2b_leads_qualification_score_check
  check (qualification_score is null or qualification_score between 0 and 100);

alter table public.b2b_leads
  drop constraint if exists b2b_leads_priority_check;
alter table public.b2b_leads
  add constraint b2b_leads_priority_check
  check (priority in ('unassigned', 'low', 'medium', 'high'));

alter table public.b2b_leads
  drop constraint if exists b2b_leads_quote_draft_object_check;
alter table public.b2b_leads
  add constraint b2b_leads_quote_draft_object_check
  check (
    quote_draft is null or (
      jsonb_typeof(quote_draft) = 'object'
      and char_length(quote_draft::text) <= 20000
    )
  );

create index if not exists b2b_leads_priority_status_idx
  on public.b2b_leads (priority, status, created_at desc);

create index if not exists b2b_leads_next_action_idx
  on public.b2b_leads (next_action_at)
  where status in ('new', 'contacted', 'quoting');

create index if not exists b2b_leads_first_order_idx
  on public.b2b_leads (first_order_id)
  where first_order_id is not null;

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
        'website', l.website,
        'decision_maker', l.decision_maker,
        'qualification_score', l.qualification_score,
        'priority', l.priority,
        'owner', l.owner,
        'source_url', l.source_url,
        'last_contact_at', l.last_contact_at,
        'next_action', l.next_action,
        'next_action_at', l.next_action_at,
        'blocker', l.blocker,
        'first_order_id', l.first_order_id,
        'first_order_linked_at', l.first_order_linked_at,
        'quote_draft', l.quote_draft,
        'quote_draft_updated_at', l.quote_draft_updated_at,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ) order by
        case l.priority
          when 'high' then 0
          when 'medium' then 1
          when 'low' then 2
          else 3
        end,
        l.next_action_at asc nulls last,
        l.created_at desc
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
      'website', l.website,
      'decision_maker', l.decision_maker,
      'qualification_score', l.qualification_score,
      'priority', l.priority,
      'owner', l.owner,
      'source_url', l.source_url,
      'last_contact_at', l.last_contact_at,
      'next_action', l.next_action,
      'next_action_at', l.next_action_at,
      'blocker', l.blocker,
      'first_order_id', l.first_order_id,
      'first_order_linked_at', l.first_order_linked_at,
      'quote_draft', l.quote_draft,
      'quote_draft_updated_at', l.quote_draft_updated_at,
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

create or replace function public.admin_update_b2b_lead_pipeline_v1(
  p_lead_id uuid,
  p_website text,
  p_decision_maker text,
  p_qualification_score integer,
  p_priority text,
  p_owner text,
  p_source_url text,
  p_last_contact_at timestamptz,
  p_next_action text,
  p_next_action_at timestamptz,
  p_blocker text,
  p_first_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_first_order_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;

  select first_order_id into v_previous_first_order_id
    from public.b2b_leads
   where id = p_lead_id
   for update;
  if not found then
    raise exception 'CM_B2B_LEAD_NOT_FOUND';
  end if;

  if p_website is not null and (
    char_length(trim(p_website)) > 1000 or trim(p_website) !~* '^https?://'
  ) then
    raise exception 'CM_B2B_LEAD_WEBSITE_INVALID';
  end if;
  if p_source_url is not null and (
    char_length(trim(p_source_url)) > 1000 or trim(p_source_url) !~* '^https?://'
  ) then
    raise exception 'CM_B2B_LEAD_SOURCE_URL_INVALID';
  end if;
  if p_decision_maker is not null and char_length(trim(p_decision_maker)) > 200 then
    raise exception 'CM_B2B_LEAD_DECISION_MAKER_INVALID';
  end if;
  if p_qualification_score is not null and (p_qualification_score < 0 or p_qualification_score > 100) then
    raise exception 'CM_B2B_LEAD_SCORE_INVALID';
  end if;
  if p_priority not in ('unassigned', 'low', 'medium', 'high') then
    raise exception 'CM_B2B_LEAD_PRIORITY_INVALID';
  end if;
  if p_owner is not null and char_length(trim(p_owner)) > 160 then
    raise exception 'CM_B2B_LEAD_OWNER_INVALID';
  end if;
  if p_next_action is not null and char_length(trim(p_next_action)) > 1000 then
    raise exception 'CM_B2B_LEAD_NEXT_ACTION_INVALID';
  end if;
  if p_blocker is not null and char_length(trim(p_blocker)) > 2000 then
    raise exception 'CM_B2B_LEAD_BLOCKER_INVALID';
  end if;
  if p_last_contact_at is not null and p_last_contact_at > now() + interval '5 minutes' then
    raise exception 'CM_B2B_LEAD_LAST_CONTACT_INVALID';
  end if;
  if p_first_order_id is not null and not exists (
    select 1 from public.orders where id = p_first_order_id
  ) then
    raise exception 'CM_B2B_LEAD_FIRST_ORDER_NOT_FOUND';
  end if;

  update public.b2b_leads
     set website = nullif(trim(p_website), ''),
         decision_maker = nullif(trim(p_decision_maker), ''),
         qualification_score = p_qualification_score,
         priority = p_priority,
         owner = nullif(trim(p_owner), ''),
         source_url = nullif(trim(p_source_url), ''),
         last_contact_at = p_last_contact_at,
         next_action = nullif(trim(p_next_action), ''),
         next_action_at = p_next_action_at,
         blocker = nullif(trim(p_blocker), ''),
         first_order_id = p_first_order_id,
         first_order_linked_at = case
           when p_first_order_id is null then null
           when v_previous_first_order_id is distinct from p_first_order_id then now()
           else first_order_linked_at
         end,
         updated_at = now()
   where id = p_lead_id;

  return jsonb_build_object(
    'ok', true,
    'lead_id', p_lead_id,
    'first_order_linked', p_first_order_id is not null
  );
end;
$$;

revoke all on function public.admin_update_b2b_lead_pipeline_v1(
  uuid, text, text, integer, text, text, text, timestamptz, text, timestamptz, text, uuid
) from public, anon, service_role;
grant execute on function public.admin_update_b2b_lead_pipeline_v1(
  uuid, text, text, integer, text, text, text, timestamptz, text, timestamptz, text, uuid
) to authenticated;

create or replace function public.admin_save_b2b_quote_draft_v1(
  p_lead_id uuid,
  p_quote_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, commerce_private
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles where user_id = v_actor and role = 'admin'
  ) then
    raise exception 'CM_ADMIN_ROLE_REQUIRED';
  end if;
  if not exists (select 1 from public.b2b_leads where id = p_lead_id) then
    raise exception 'CM_B2B_LEAD_NOT_FOUND';
  end if;
  if p_quote_draft is not null and (
    jsonb_typeof(p_quote_draft) <> 'object'
    or char_length(p_quote_draft::text) > 20000
  ) then
    raise exception 'CM_B2B_QUOTE_DRAFT_INVALID';
  end if;

  update public.b2b_leads
     set quote_draft = p_quote_draft,
         quote_draft_updated_at = case when p_quote_draft is null then null else now() end,
         updated_at = now()
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'lead_id', p_lead_id, 'draft_only', true);
end;
$$;

revoke all on function public.admin_save_b2b_quote_draft_v1(uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.admin_save_b2b_quote_draft_v1(uuid, jsonb)
  to authenticated;
