-- CM-INT-ZOHO-1 — durable, replay-safe order-to-accounting outbox.
-- Repository-only: this migration is not applied by this change and creates no
-- Zoho customer, invoice, payment, OAuth grant or provider credential.

create table commerce_private.accounting_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('zoho')),
  entity_type text not null check (entity_type in ('customer','invoice','payment')),
  local_entity_id text not null,
  external_id text not null,
  external_number text,
  external_status text,
  external_url text,
  pdf_supported boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, entity_type, local_entity_id),
  unique (provider, entity_type, external_id)
);

create table commerce_private.accounting_integration_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('zoho')),
  job_type text not null check (job_type in ('order_invoice','payment_sync','reconciliation')),
  order_id uuid not null references public.orders(id) on delete restrict,
  dedupe_key text not null unique,
  correlation_id uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending','processing','retry_scheduled','requires_attention','succeeded')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 6),
  max_attempts integer not null default 6 check (max_attempts between 1 and 6),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_failure_category text
    check (last_failure_category is null or last_failure_category in
      ('auth','validation','rate_limit','provider_unavailable','mapping_error','conflict','unknown')),
  last_failure_code text,
  source_version text not null default 'cm-int-zoho-1-v1',
  payload_fingerprint text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounting_integration_jobs_claim_idx
  on commerce_private.accounting_integration_jobs(status, next_attempt_at, created_at)
  where status in ('pending','retry_scheduled');
create index accounting_integration_jobs_order_idx
  on commerce_private.accounting_integration_jobs(order_id, created_at desc);

create table commerce_private.accounting_integration_audit_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('zoho')),
  job_id uuid references commerce_private.accounting_integration_jobs(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  correlation_id uuid not null,
  action text not null,
  outcome text not null check (outcome in ('started','succeeded','failed','skipped')),
  failure_category text
    check (failure_category is null or failure_category in
      ('auth','validation','rate_limit','provider_unavailable','mapping_error','conflict','unknown')),
  safe_code text,
  external_id text,
  occurred_at timestamptz not null default now()
);

create index accounting_integration_audit_order_idx
  on commerce_private.accounting_integration_audit_events(order_id, occurred_at desc);
create index accounting_integration_audit_correlation_idx
  on commerce_private.accounting_integration_audit_events(correlation_id, occurred_at);

alter table commerce_private.accounting_entity_mappings enable row level security;
alter table commerce_private.accounting_entity_mappings force row level security;
alter table commerce_private.accounting_integration_jobs enable row level security;
alter table commerce_private.accounting_integration_jobs force row level security;
alter table commerce_private.accounting_integration_audit_events enable row level security;
alter table commerce_private.accounting_integration_audit_events force row level security;

-- Private schema + service-role-only access. Admin UI reads through a server
-- function that independently calls assertAdmin; the browser has no table grant.
revoke all on commerce_private.accounting_entity_mappings from public, anon, authenticated;
revoke all on commerce_private.accounting_integration_jobs from public, anon, authenticated;
revoke all on commerce_private.accounting_integration_audit_events from public, anon, authenticated;
grant select, insert, update on commerce_private.accounting_entity_mappings to service_role;
grant select, insert, update on commerce_private.accounting_integration_jobs to service_role;
grant select, insert on commerce_private.accounting_integration_audit_events to service_role;
grant usage, select on sequence commerce_private.accounting_integration_audit_events_id_seq to service_role;

create or replace function commerce_private.enqueue_accounting_job_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed','processing','shipped','delivered')
     and (tg_op = 'INSERT' or old.status not in ('confirmed','processing','shipped','delivered')) then
    insert into commerce_private.accounting_integration_jobs (
      provider, job_type, order_id, dedupe_key, payload_fingerprint
    ) values (
      'zoho', 'order_invoice', new.id, 'zoho:order_invoice:' || new.id::text,
      encode(extensions.digest(
        concat_ws('|', new.id::text, new.order_number, new.subtotal_aed::text,
          new.shipping_aed::text, new.tax_aed::text, new.total_aed::text),
        'sha256'
      ), 'hex')
    ) on conflict (dedupe_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and old.payment_status is distinct from new.payment_status then
    insert into commerce_private.accounting_integration_jobs (
      provider, job_type, order_id, dedupe_key, payload_fingerprint
    ) values (
      'zoho', 'payment_sync', new.id,
      'zoho:payment_sync:' || new.id::text || ':' || new.payment_status,
      encode(extensions.digest(
        concat_ws('|', new.id::text, new.payment_status, new.total_aed::text),
        'sha256'
      ), 'hex')
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function commerce_private.enqueue_accounting_job_from_order() from public, anon, authenticated;
grant execute on function commerce_private.enqueue_accounting_job_from_order() to service_role;

create or replace function commerce_private.claim_accounting_integration_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns setof commerce_private.accounting_integration_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 3 then
    raise exception 'ACCOUNTING_WORKER_ID_REQUIRED';
  end if;
  if p_limit < 1 or p_limit > 25 then
    raise exception 'ACCOUNTING_WORKER_LIMIT_INVALID';
  end if;
  return query
    with claimable as (
      select id
      from commerce_private.accounting_integration_jobs
      where status in ('pending','retry_scheduled')
        and next_attempt_at <= now()
        and attempt_count < max_attempts
      order by next_attempt_at, created_at
      for update skip locked
      limit p_limit
    )
    update commerce_private.accounting_integration_jobs jobs
    set status = 'processing',
        attempt_count = jobs.attempt_count + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        started_at = coalesce(jobs.started_at, now()),
        updated_at = now()
    from claimable
    where jobs.id = claimable.id
    returning jobs.*;
end;
$$;

revoke all on function commerce_private.claim_accounting_integration_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function commerce_private.claim_accounting_integration_jobs(text, integer)
  to service_role;

create trigger orders_enqueue_accounting_job
after insert or update of status, payment_status on public.orders
for each row execute function commerce_private.enqueue_accounting_job_from_order();

comment on table commerce_private.accounting_entity_mappings is
  'CM-INT-ZOHO-1 durable local/external identifiers. Contains no OAuth tokens or secrets.';
comment on table commerce_private.accounting_integration_jobs is
  'CM-INT-ZOHO-1 bounded-attempt outbox. Unique dedupe keys make at-least-once delivery replay-safe.';
comment on table commerce_private.accounting_integration_audit_events is
  'CM-INT-ZOHO-1 append-only operational evidence with PII-free safe codes and correlation IDs.';
comment on function commerce_private.claim_accounting_integration_jobs(text, integer) is
  'CM-INT-ZOHO-1 atomic bounded claim using FOR UPDATE SKIP LOCKED for at-least-once workers.';
