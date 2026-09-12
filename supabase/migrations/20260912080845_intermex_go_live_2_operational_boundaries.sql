-- INTERMEX-GO-LIVE-2. Repository only; every production apply is Founder gated.
-- No enabled provider gate is inserted. Existing payment modes stay UNKNOWN/null.
create table commerce_private.provider_runtime_gates (
  provider text primary key check (provider in ('stripe','zoho')),
  mode text not null check (mode in ('test','live')),
  generation uuid not null unique,
  enabled boolean not null default false,
  eligible_after timestamptz not null,
  validated_at timestamptz not null,
  valid_until timestamptz not null,
  evidence_ref text not null check (length(trim(evidence_ref))>0),
  check (valid_until > validated_at), check (eligible_after >= validated_at)
);
create table commerce_private.card_checkout_operations (
  buyer_id uuid not null references auth.users(id),
  operation_id uuid not null,
  fingerprint text not null,
  order_id uuid unique references public.orders(id),
  created_at timestamptz not null default now(),
  primary key (buyer_id,operation_id)
);
alter table public.orders add column b2b_account_id uuid references commerce_private.b2b_customer_accounts(id);
alter table public.orders add column payment_attention text;
alter table public.orders add column stripe_paid_attempt_id uuid references public.payments(id);
alter table public.payments add column provider_mode text check (provider_mode in ('test','live'));
alter table public.payments add column captured_aed numeric(12,2) not null default 0;
alter table public.payments add column refunded_aed numeric(12,2) not null default 0;
alter table public.payments add constraint payment_capture_refund_bounds check (
  refunded_aed >= 0 and captured_aed >= refunded_aed and captured_aed <= amount_aed);
create unique index stripe_intent_mode_unique on public.payments(provider_mode,(metadata->>'stripe_payment_intent_id'))
 where provider='stripe' and metadata->>'stripe_payment_intent_id' is not null;
alter table commerce_private.payment_webhook_events add column provider_mode text check (provider_mode in ('test','live'));
alter table commerce_private.payment_webhook_events add column event_fingerprint text;
create table commerce_private.payment_lifecycle_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id),
  payment_id uuid not null references public.payments(id),
  event_id text not null unique,
  action text not null,
  occurred_at timestamptz not null default now()
);
create table commerce_private.refund_accounting_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  payment_id uuid not null references public.payments(id),
  cumulative_refund_aed numeric(12,2) not null check(cumulative_refund_aed>0),
  status text not null default 'requires_attention' check(status in ('requires_attention','resolved')),
  action text not null default 'REFUND_REQUIRES_ACCOUNTING_ACTION',
  created_at timestamptz not null default now(),
  unique(payment_id,cumulative_refund_aed)
);

create function public.cm_runtime_capabilities_v2() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('schemaVersion',2,'gates',coalesce((select jsonb_object_agg(provider,
   jsonb_build_object('mode',mode,'generation',generation,'eligibleAfter',eligible_after,
     'enabled',enabled and validated_at<=now() and valid_until>now(), 'validUntil',valid_until))
 from commerce_private.provider_runtime_gates),'{}'::jsonb));
$$;

create function public.cm_pay_create_stripe_attempt_v2(p_order_id uuid,p_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; p public.payments%rowtype;
begin
 if p_mode is null or p_mode not in ('test','live') then raise exception 'PAYMENT_MODE_REQUIRED'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.payment_method<>'card' or o.status<>'pending' or o.payment_attention is not null
    or o.payment_status not in ('pending','failed','cancelled','under_review') then raise exception 'ORDER_NOT_PAYABLE'; end if;
 if exists(select 1 from public.payments where order_id=o.id and provider='stripe'
   and (captured_aed>0 or provider_mode is distinct from p_mode)) then raise exception 'PAYMENT_MODE_OR_CAPTURE_CONFLICT'; end if;
 select * into p from public.payments where order_id=o.id and provider='stripe'
   and status in ('pending','under_review') order by created_at desc limit 1 for update;
 if not found then
   insert into public.payments(order_id,provider,provider_reference,status,amount_aed,provider_mode,metadata)
   values(o.id,'stripe','stripe-attempt:'||gen_random_uuid()::text,'pending',o.total_aed,p_mode,'{"attempt_state":"created"}') returning * into p;
 end if;
 return jsonb_build_object('payment_id',p.id,'order_id',o.id,'order_number',o.order_number,
   'amount_aed',p.amount_aed,'provider_reference',p.provider_reference,'provider_mode',p.provider_mode,'created_at',p.created_at);
end; $$;

create function public.cm_create_card_order_v2(p_buyer_id uuid,p_operation_id uuid,p_items jsonb,
 p_shipping_address jsonb,p_shipping_aed numeric,p_tax_rate numeric,p_legal_acceptance jsonb,
 p_mode text,p_account_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f text; op commerce_private.card_checkout_operations%rowtype; result jsonb; norm jsonb;
begin
 if p_buyer_id is null or p_operation_id is null then raise exception 'CHECKOUT_IDENTITY_REQUIRED'; end if;
 if p_mode is null or p_mode not in ('test','live') then raise exception 'PAYMENT_MODE_REQUIRED'; end if;
 if not exists(select 1 from commerce_private.provider_runtime_gates where provider='stripe' and mode=p_mode
   and enabled and validated_at<=now() and valid_until>now()) then raise exception 'CARD_CAPABILITY_UNAVAILABLE'; end if;
 if p_legal_acceptance is null or not (p_legal_acceptance @> '{"terms":true,"privacy":true,"returns":true}')
 then raise exception 'LEGAL_ACCEPTANCE_REQUIRED'; end if;
 if p_account_id is not null and not exists(select 1 from commerce_private.b2b_account_users u
   join commerce_private.b2b_customer_accounts a on a.id=u.account_id
   where u.user_id=p_buyer_id and a.id=p_account_id and u.status='active' and a.status='active')
 then raise exception 'ACCOUNT_MEMBERSHIP_REQUIRED'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50
 then raise exception 'CARD_ITEMS_INVALID'; end if;
 select jsonb_agg(jsonb_build_object('variant_id',variant_id,'qty',qty) order by variant_id) into norm
 from (select (e->>'variant_id')::uuid variant_id,sum((e->>'qty')::integer) qty from jsonb_array_elements(p_items) e group by 1) q;
 if exists(select 1 from jsonb_to_recordset(norm) x(variant_id uuid,qty integer) where qty not between 1 and 500 or qty is null)
 then raise exception 'CARD_QTY_INVALID'; end if;
 f:=encode(extensions.digest(jsonb_build_array(norm,p_shipping_address,p_shipping_aed,p_tax_rate,p_legal_acceptance,p_mode,p_account_id)::text,'sha256'),'hex');
 insert into commerce_private.card_checkout_operations(buyer_id,operation_id,fingerprint)
 values(p_buyer_id,p_operation_id,f) on conflict do nothing;
 select * into op from commerce_private.card_checkout_operations where buyer_id=p_buyer_id and operation_id=p_operation_id for update;
 if op.fingerprint<>f then raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT'; end if;
 if op.order_id is null then
   -- Reuse the canonical, atomic stock/order primitive inside THIS transaction.
   -- The intermediate COD designation is never committed or visible externally.
   result:=public.place_cod_order_v1(p_buyer_id,norm,p_shipping_address,p_shipping_aed,p_tax_rate,p_legal_acceptance);
   op.order_id:=(result->>'order_id')::uuid;
   update public.orders set payment_method='card',b2b_account_id=p_account_id where id=op.order_id;
   update public.inventory_movements set reason='card_order' where reference_id=op.order_id and reference_type='order';
   perform public.cm_pay_create_stripe_attempt_v2(op.order_id,p_mode);
   update commerce_private.card_checkout_operations set order_id=op.order_id where buyer_id=p_buyer_id and operation_id=p_operation_id;
 end if;
 return jsonb_build_object('order_id',op.order_id);
end; $$;

create function public.cm_pay_bind_stripe_session_v2(p_payment_id uuid,p_session_id text,p_payment_intent_id text,p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype;
begin
 -- Consistent lock order: order, then payment (also used by webhook and attempt creation).
 perform 1 from public.orders where id=(select order_id from public.payments where id=p_payment_id) for update;
 select * into p from public.payments where id=p_payment_id for update;
 if not found or p.provider<>'stripe' or p.provider_mode is distinct from p_mode or p_session_id is null or p_session_id !~ '^cs_'
 then raise exception 'PAYMENT_BIND_INVALID'; end if;
 if p.provider_reference !~ '^stripe-attempt:' and p.provider_reference<>p_session_id then raise exception 'SESSION_REBIND_DENIED'; end if;
 if p_payment_intent_id is not null and (p_payment_intent_id !~ '^pi_' or
   (p.metadata->>'stripe_payment_intent_id' is not null and p.metadata->>'stripe_payment_intent_id'<>p_payment_intent_id))
 then raise exception 'INTENT_REBIND_DENIED'; end if;
 update public.payments set provider_reference=p_session_id,
 metadata=metadata||jsonb_strip_nulls(jsonb_build_object('stripe_payment_intent_id',p_payment_intent_id,'attempt_state','checkout_created')),
 updated_at=now() where id=p.id;
 return jsonb_build_object('ok',true);
end; $$;

create function public.cm_pay_process_stripe_webhook_v2(p_event_id text,p_event_type text,p_provider_object_id text,
 p_payment_id uuid,p_order_id uuid,p_currency text,p_amount_aed numeric,p_provider_created_at timestamptz,
 p_payment_status text,p_payment_intent_id text,p_refunded_amount_aed numeric,p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype; o public.orders%rowtype; next_status text; refund numeric;
 captures integer; fingerprint text; prior commerce_private.payment_webhook_events%rowtype; was_pending boolean;
begin
 if p_event_id is null or p_event_id !~ '^evt_' or p_mode is null or p_mode not in ('test','live')
 or p_currency is distinct from 'aed' or p_amount_aed is null or p_amount_aed<=0 or p_amount_aed<>round(p_amount_aed,2)
 or p_event_type is null or p_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded',
 'checkout.session.async_payment_failed','checkout.session.expired','charge.refunded') then raise exception 'WEBHOOK_INPUT_INVALID'; end if;
 select * into o from public.orders where id=p_order_id for update;
 select * into p from public.payments where id=p_payment_id and order_id=p_order_id for update;
 if not found or p.provider<>'stripe' or p.provider_mode is distinct from p_mode or o.payment_method<>'card'
 then raise exception 'WEBHOOK_LINK_OR_MODE_INVALID'; end if;
 if p.amount_aed<>p_amount_aed or o.total_aed<>p_amount_aed then raise exception 'WEBHOOK_AMOUNT_MISMATCH'; end if;
 fingerprint:=encode(extensions.digest(jsonb_build_array(p_event_type,p_provider_object_id,p_payment_id,p_order_id,
   p_currency,p_amount_aed,p_payment_status,p_payment_intent_id,p_refunded_amount_aed,p_mode)::text,'sha256'),'hex');
 select * into prior from commerce_private.payment_webhook_events where provider='stripe' and provider_event_id=p_event_id;
 if found then
   if prior.event_fingerprint is distinct from fingerprint then raise exception 'WEBHOOK_EVENT_COLLISION'; end if;
   return jsonb_build_object('ok',true,'duplicate',true,'mutated',false);
 end if;
 if p_payment_intent_id is not null and (p_payment_intent_id !~ '^pi_' or
   (p.metadata->>'stripe_payment_intent_id' is not null and p.metadata->>'stripe_payment_intent_id'<>p_payment_intent_id))
 then raise exception 'WEBHOOK_INTENT_MISMATCH'; end if;
 if p_event_type='charge.refunded' then
   if p_provider_object_id is null or p_provider_object_id !~ '^ch_' or p_payment_intent_id is null
     or p_refunded_amount_aed is null or p_refunded_amount_aed<0 or p_refunded_amount_aed>p_amount_aed
     or p_refunded_amount_aed<>round(p_refunded_amount_aed,2) then raise exception 'REFUND_INVALID'; end if;
   refund:=greatest(p.refunded_aed,p_refunded_amount_aed);
   next_status:=case when refund=p_amount_aed then 'refunded' else 'paid' end;
 else
   if p_provider_object_id is null or p_provider_object_id !~ '^cs_' then raise exception 'WEBHOOK_SESSION_INVALID'; end if;
   perform public.cm_pay_bind_stripe_session_v2(p.id,p_provider_object_id,p_payment_intent_id,p_mode);
   next_status:=case
     when p_event_type='checkout.session.completed' and p_payment_status='paid' then 'paid'
     when p_event_type='checkout.session.completed' and p_payment_status='unpaid' then 'under_review'
     when p_event_type='checkout.session.async_payment_succeeded' then 'paid'
     when p_event_type='checkout.session.async_payment_failed' then 'failed'
     when p_event_type='checkout.session.expired' then 'cancelled' end;
   if next_status is null then raise exception 'WEBHOOK_STATUS_INVALID'; end if;
   if next_status='paid' and p_payment_intent_id is null then raise exception 'PAID_INTENT_REQUIRED'; end if;
   refund:=p.refunded_aed;
 end if;
 insert into commerce_private.payment_webhook_events(provider,provider_event_id,event_type,provider_object_id,
   payment_id,order_id,provider_created_at,provider_mode,event_fingerprint)
 values('stripe',p_event_id,p_event_type,p_provider_object_id,p.id,o.id,p_provider_created_at,p_mode,fingerprint);
 -- Late success enriches intent without undoing refund or decreasing cumulative amounts.
 if p.status='refunded' then next_status:='refunded';
 elsif p.captured_aed>0 and next_status in ('failed','cancelled','under_review') then next_status:='paid'; end if;
 update public.payments set status=next_status,
   captured_aed=case when next_status in ('paid','refunded') then amount_aed else captured_aed end,
   refunded_aed=refund, metadata=metadata||jsonb_strip_nulls(jsonb_build_object(
     'stripe_payment_intent_id',p_payment_intent_id,'refunded_amount_aed',refund)),updated_at=now() where id=p.id;
 select count(*) into captures from public.payments where order_id=o.id and provider='stripe' and captured_aed>0;
 if captures>1 then
   update public.orders set payment_attention='MULTIPLE_SUCCESSFUL_ATTEMPTS',updated_at=now() where id=o.id;
 else
   was_pending:=o.status='pending';
   if next_status in ('paid','refunded') then
     update public.orders set payment_status=next_status,stripe_paid_attempt_id=p.id,
       status=case when next_status='paid' and refund=0 and status='pending' then 'confirmed' else status end,
       payment_attention=case when status='cancelled' then 'CAPTURE_ON_CANCELLED_ORDER' else payment_attention end,
       updated_at=now() where id=o.id;
     if was_pending and next_status='paid' and refund=0 then
       insert into commerce_private.payment_lifecycle_events(order_id,payment_id,event_id,action)
       values(o.id,p.id,p_event_id,'VERIFIED_PAYMENT_CONFIRMED_ORDER');
     end if;
   elsif captures=0 then
     update public.orders set payment_status=next_status,updated_at=now() where id=o.id;
   end if;
 end if;
 if refund>p.refunded_aed then
   insert into commerce_private.refund_accounting_actions(order_id,payment_id,cumulative_refund_aed)
   values(o.id,p.id,refund) on conflict do nothing;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false,'mutated',true,'payment_status',next_status,
 'refunded_aed',refund,'requires_attention',captures>1);
end; $$;

-- Existing jobs have NULL generation and are never automatically claimed.
alter table commerce_private.accounting_integration_jobs add column activation_generation uuid;
create table commerce_private.accounting_customer_leases (
 buyer_id uuid primary key references auth.users(id),job_id uuid not null,
 worker_id text not null,expires_at timestamptz not null
);
create table commerce_private.accounting_create_intents (
 entity_key text primary key,job_id uuid not null,created_at timestamptz not null default now()
);
create or replace function commerce_private.enqueue_accounting_job_from_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g commerce_private.provider_runtime_gates%rowtype;
begin
 select * into g from commerce_private.provider_runtime_gates where provider='zoho' and enabled
 and validated_at<=now() and valid_until>now();
 if new.payment_status='paid' and new.status in ('confirmed','processing','shipped','delivered')
   and new.payment_attention is null and exists(select 1 from public.payments where id=new.stripe_paid_attempt_id and provider_mode=g.mode and captured_aed>0) and not exists(select 1 from public.payments where order_id=new.id and refunded_aed>0) then
   insert into commerce_private.accounting_integration_jobs(provider,job_type,order_id,dedupe_key,activation_generation)
   values('zoho','order_invoice',new.id,'zoho:order_invoice:'||new.id::text,
     case when new.created_at>=g.eligible_after then g.generation else null end)
   on conflict(dedupe_key) do nothing;
 end if;
 return new;
end; $$;

create or replace function commerce_private.claim_accounting_integration_jobs(p_worker_id text,p_limit integer default 10)
returns setof commerce_private.accounting_integration_jobs language plpgsql security definer set search_path = '' as $$
declare g commerce_private.provider_runtime_gates%rowtype; j commerce_private.accounting_integration_jobs%rowtype;
 buyer uuid; claimed integer:=0;
begin
 if p_worker_id is null or length(p_worker_id)<3 or p_limit is null or p_limit not between 1 and 25 then raise exception 'WORKER_INPUT_INVALID'; end if;
 select * into g from commerce_private.provider_runtime_gates where provider='zoho' and enabled and validated_at<=now() and valid_until>now();
 if not found then return; end if;
 update commerce_private.accounting_integration_jobs set status='requires_attention',last_failure_code='HISTORICAL_QUEUE_QUARANTINED'
 where status in ('pending','retry_scheduled') and (activation_generation is distinct from g.generation or created_at<g.eligible_after);
 -- An expired owner is fenced. Ambiguous external creates are recovery-only via durable intents.
 update commerce_private.accounting_integration_jobs set status='requires_attention',locked_at=null,locked_by=null,last_failure_code='ACCOUNTING_WORKER_LEASE_EXHAUSTED'
 where status='processing' and locked_at<now()-interval '20 minutes' and attempt_count>=max_attempts;
 for j in select jobs.* from commerce_private.accounting_integration_jobs jobs join public.orders o on o.id=jobs.order_id
 where jobs.activation_generation=g.generation and jobs.created_at>=g.eligible_after and o.created_at>=g.eligible_after
 and o.payment_status='paid' and o.status in ('confirmed','processing','shipped','delivered') and o.payment_attention is null
 and exists(select 1 from public.payments p where p.id=o.stripe_paid_attempt_id and p.provider_mode=g.mode and p.captured_aed>0)
 and not exists(select 1 from public.payments p where p.order_id=o.id and p.refunded_aed>0)
 and jobs.attempt_count<jobs.max_attempts and ((jobs.status in ('pending','retry_scheduled') and jobs.next_attempt_at<=now())
 or (jobs.status='processing' and jobs.locked_at<now()-interval '20 minutes'))
 order by jobs.next_attempt_at,jobs.created_at for update of jobs skip locked
 loop
   select buyer_id into buyer from public.orders where id=j.order_id;
   insert into commerce_private.accounting_customer_leases(buyer_id,job_id,worker_id,expires_at)
   values(buyer,j.id,p_worker_id,now()+interval '20 minutes') on conflict(buyer_id) do update
   set job_id=excluded.job_id,worker_id=excluded.worker_id,expires_at=excluded.expires_at
   where commerce_private.accounting_customer_leases.expires_at<now();
   if not found then continue; end if;
   update commerce_private.accounting_integration_jobs set status='processing',attempt_count=attempt_count+1,
     locked_at=now(),locked_by=p_worker_id,started_at=coalesce(started_at,now()),updated_at=now()
     where id=j.id returning * into j;
   return next j; claimed:=claimed+1; if claimed>=p_limit then exit; end if;
 end loop;
end; $$;

-- All worker side effects are fenced by the database owner and customer lease.
create function public.cm_accounting_job_action_v2(p_job_id uuid,p_worker_id text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j commerce_private.accounting_integration_jobs%rowtype; o public.orders%rowtype;
 g commerce_private.provider_runtime_gates%rowtype; m jsonb; acquired boolean;
begin
 select * into j from commerce_private.accounting_integration_jobs where id=p_job_id for update;
 if not found or j.status<>'processing' or j.locked_by is distinct from p_worker_id
 or j.locked_at<=clock_timestamp()-interval '20 minutes' then raise exception 'ACCOUNTING_LEASE_LOST'; end if;
 select * into o from public.orders where id=j.order_id;
 if not exists(select 1 from commerce_private.accounting_customer_leases where buyer_id=o.buyer_id
   and job_id=j.id and worker_id=p_worker_id and expires_at>clock_timestamp()) then raise exception 'ACCOUNTING_CUSTOMER_LEASE_LOST'; end if;
 if p_action<>'fail' then
   select * into g from commerce_private.provider_runtime_gates where provider='zoho' and enabled
     and validated_at<=clock_timestamp() and valid_until>clock_timestamp()+interval '20 seconds';
   if not found or j.activation_generation is distinct from g.generation or j.created_at<g.eligible_after
     or o.created_at<g.eligible_after or o.payment_status<>'paid' or o.payment_attention is not null
     or o.status not in ('confirmed','processing','shipped','delivered')
     or not exists(select 1 from public.payments where id=o.stripe_paid_attempt_id and provider_mode=g.mode and captured_aed>0)
     or exists(select 1 from public.payments where order_id=o.id and refunded_aed>0)
     then raise exception 'ACCOUNTING_ELIGIBILITY_LOST'; end if;
 end if;
 if p_action='assert' then
   if j.locked_at<=clock_timestamp()-interval '19 minutes 40 seconds' then raise exception 'ACCOUNTING_LEASE_ENDING'; end if;
 elsif p_action='begin_create' then
   if p_payload->>'key' not in ('customer:'||o.buyer_id::text,'invoice:'||o.id::text,'payment:'||(select provider||':'||provider_reference from public.payments where id=o.stripe_paid_attempt_id))
     or p_payload->>'key' is null then raise exception 'ACCOUNTING_CREATE_SCOPE_INVALID'; end if;
   insert into commerce_private.accounting_create_intents(entity_key,job_id) values(p_payload->>'key',j.id) on conflict do nothing;
   acquired:=found; return jsonb_build_object('acquired',acquired);
 elsif p_action in ('save_mapping','get_mapping') then
   if p_payload->>'entityType' not in ('customer','invoice','payment') or p_payload->>'entityType' is null
     or p_payload->>'localEntityId' is distinct from (case when p_payload->>'entityType'='customer' then o.buyer_id::text when p_payload->>'entityType'='payment' then (select provider||':'||provider_reference from public.payments where id=o.stripe_paid_attempt_id) else o.id::text end)
     or (p_action='save_mapping' and nullif(p_payload->>'externalId','') is null) then raise exception 'ACCOUNTING_MAPPING_SCOPE_INVALID'; end if;
   if p_action='get_mapping' then return (select jsonb_build_object('entityType',entity_type,'localEntityId',local_entity_id,'externalId',external_id,'metadata',metadata) from commerce_private.accounting_entity_mappings where provider='zoho' and entity_type=p_payload->>'entityType' and local_entity_id=p_payload->>'localEntityId'); end if;
   m:=jsonb_strip_nulls(jsonb_build_object('number',p_payload#>>'{metadata,number}','status',p_payload#>>'{metadata,status}',
     'url',p_payload#>>'{metadata,url}','issuedDate',p_payload#>>'{metadata,issuedDate}',
     'pdfSupported',coalesce((p_payload#>>'{metadata,pdfSupported}')::boolean,false)));
   insert into commerce_private.accounting_entity_mappings(provider,entity_type,local_entity_id,external_id,
     external_number,external_status,external_url,pdf_supported,metadata,last_synced_at)
   values('zoho',p_payload->>'entityType',p_payload->>'localEntityId',p_payload->>'externalId',
     m->>'number',m->>'status',m->>'url',(m->>'pdfSupported')::boolean,m,now())
   on conflict(provider,entity_type,local_entity_id) do update set
     metadata=excluded.metadata,external_number=excluded.external_number,external_status=excluded.external_status,
     external_url=excluded.external_url,pdf_supported=excluded.pdf_supported,last_synced_at=now(),updated_at=now()
   where commerce_private.accounting_entity_mappings.external_id=excluded.external_id;
   if not found then raise exception 'ACCOUNTING_MAPPING_REBIND_DENIED'; end if;
 elsif p_action='audit' then
   insert into commerce_private.accounting_integration_audit_events(provider,job_id,order_id,correlation_id,action,outcome,failure_category,external_id)
   values('zoho',j.id,o.id,j.correlation_id,p_payload->>'action',p_payload->>'outcome',p_payload->>'category',p_payload->>'externalId');
 elsif p_action in ('finish','fail') then
   update commerce_private.accounting_integration_jobs set
     status=case when p_action='finish' then 'succeeded' when coalesce((p_payload->>'retryable')::boolean,false) and attempt_count<max_attempts
       then 'retry_scheduled' else 'requires_attention' end,
     completed_at=case when p_action='finish' then now() else null end,
     next_attempt_at=now()+make_interval(secs=>least(3600,greatest(1,coalesce((p_payload->>'retrySeconds')::integer,60)))),
     last_failure_category=case when p_action='fail' then p_payload->>'category' else null end,
     last_failure_code=case when p_action='fail' then left(p_payload->>'code',160) else null end,
     locked_by=null,locked_at=null,updated_at=now() where id=j.id;
   delete from commerce_private.accounting_customer_leases where buyer_id=o.buyer_id and job_id=j.id and worker_id=p_worker_id;
 else raise exception 'ACCOUNTING_ACTION_INVALID'; end if;
 return jsonb_build_object('ok',true);
end; $$;

create function public.cm_claim_accounting_jobs_v2(p_worker_id text,p_limit integer default 10)
returns setof commerce_private.accounting_integration_jobs language sql security definer set search_path = '' as $$
 select * from commerce_private.claim_accounting_integration_jobs(p_worker_id,p_limit);
$$;

-- Owner/account authorization occurs in the database. Admin is checked independently.
create function public.cm_invoice_projection_v2(p_actor_id uuid,p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.orders%rowtype; m commerce_private.accounting_entity_mappings%rowtype;
begin
 if p_actor_id is null then return null; end if;
 select * into o from public.orders where id=p_order_id;
 if not found then return null; end if;
 if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then
   if o.b2b_account_id is not null then
     if not exists(select 1 from commerce_private.b2b_account_users u join commerce_private.b2b_customer_accounts a on a.id=u.account_id
       where u.account_id=o.b2b_account_id and u.user_id=p_actor_id and u.status='active' and a.status='active') then return null; end if;
   elsif o.buyer_id<>p_actor_id then return null; end if;
 end if;
 select * into m from commerce_private.accounting_entity_mappings where provider='zoho' and entity_type='invoice' and local_entity_id=o.id::text;
 if not found then return null; end if;
 return jsonb_build_object('reference',o.order_number,'number',m.external_number,'status',m.external_status,
   'issuedDate',m.metadata->>'issuedDate','url',m.external_url,'pdfSupported',m.pdf_supported);
end; $$;

create function public.cm_accounting_control_center_v2(p_actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(row_data) from (select jsonb_build_object('id',j.id,'order_id',j.order_id,
   'job_type',j.job_type,'status',j.status,'attempt_count',j.attempt_count,'max_attempts',j.max_attempts,
   'next_attempt_at',j.next_attempt_at,'last_failure_category',j.last_failure_category,'last_failure_code',j.last_failure_code,
   'correlation_id',j.correlation_id,'updated_at',j.updated_at,'orders',jsonb_build_object('order_number',o.order_number)) row_data
   from commerce_private.accounting_integration_jobs j join public.orders o on o.id=j.order_id order by j.created_at desc limit 100) q),'[]'::jsonb);
end; $$;
create function public.cm_accounting_admin_action_v2(p_actor_id uuid,p_action text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j commerce_private.accounting_integration_jobs%rowtype; o public.orders%rowtype; g commerce_private.provider_runtime_gates%rowtype;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then raise exception 'FORBIDDEN'; end if;
 select * into g from commerce_private.provider_runtime_gates where provider='zoho' and enabled and validated_at<=now() and valid_until>now();
 if not found then raise exception 'ACCOUNTING_ACTIVATION_BLOCKED'; end if;
 if p_action='retry' then
   select * into j from commerce_private.accounting_integration_jobs where id=p_id for update;
   if not found or j.status<>'requires_attention' or j.activation_generation is distinct from g.generation
     or j.last_failure_code in ('HISTORICAL_QUEUE_QUARANTINED','CUSTOMER_CREATE_OUTCOME_UNCERTAIN','INVOICE_CREATE_OUTCOME_UNCERTAIN','PAYMENT_CREATE_OUTCOME_UNCERTAIN')
     then raise exception 'ACCOUNTING_JOB_NOT_RETRYABLE'; end if;
   select * into o from public.orders where id=j.order_id;
 elsif p_action='reconcile' then select * into o from public.orders where id=p_id;
 else raise exception 'ACCOUNTING_ACTION_INVALID'; end if;
 if o.id is null or o.created_at<g.eligible_after or o.payment_status<>'paid' or o.payment_attention is not null
   or o.status not in ('confirmed','processing','shipped','delivered')
   or not exists(select 1 from public.payments where id=o.stripe_paid_attempt_id and provider_mode=g.mode and captured_aed>0)
   or exists(select 1 from public.payments where order_id=o.id and refunded_aed>0) then raise exception 'ACCOUNTING_ORDER_INELIGIBLE'; end if;
 if p_action='retry' then
   update commerce_private.accounting_integration_jobs set status='retry_scheduled',attempt_count=0,next_attempt_at=now(),
     completed_at=null,locked_by=null,locked_at=null,last_failure_category=null,last_failure_code=null,updated_at=now() where id=j.id;
 else
   insert into commerce_private.accounting_integration_jobs(provider,job_type,order_id,dedupe_key,activation_generation)
   values('zoho','reconciliation',o.id,'zoho:reconciliation:'||o.id::text||':'||to_char(now(),'YYYYMMDDHH24'),g.generation)
   on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning * into j;
 end if;
 insert into commerce_private.accounting_integration_audit_events(provider,job_id,order_id,correlation_id,action,outcome)
 values('zoho',j.id,o.id,j.correlation_id,'admin_'||p_action,'succeeded');
 return jsonb_build_object('ok',true,'jobId',j.id);
end; $$;

create function public.cm_operational_status_v2(p_actor_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('capabilities',public.cm_runtime_capabilities_v2(),
   'paymentAnomalies',(select count(*) from public.orders where payment_attention is not null),
   'refundActions',(select count(*) from commerce_private.refund_accounting_actions where status='requires_attention'),
   'historicalJobs',(select count(*) from commerce_private.accounting_integration_jobs j where j.activation_generation is null or
      not exists(select 1 from commerce_private.provider_runtime_gates g where g.provider='zoho' and g.generation=j.activation_generation)),
   'jobsRequiringAttention',(select count(*) from commerce_private.accounting_integration_jobs where status='requires_attention'));
end; $$;
create function public.cm_completed_checkout_operation_v2(p_actor_id uuid,p_order_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
 select c.operation_id from commerce_private.card_checkout_operations c join public.orders o on o.id=c.order_id
 where c.buyer_id=p_actor_id and o.id=p_order_id and o.buyer_id=p_actor_id and o.payment_status='paid'
   and o.status in ('confirmed','processing','shipped','delivered') and o.payment_attention is null;
$$;

-- Uniform private posture, no browser table or function grants.
do $$ declare n text; f regprocedure; begin
 foreach n in array array['provider_runtime_gates','card_checkout_operations','payment_lifecycle_events',
   'refund_accounting_actions','accounting_customer_leases','accounting_create_intents'] loop
 execute format('alter table commerce_private.%I enable row level security',n);
 execute format('alter table commerce_private.%I force row level security',n);
 execute format('revoke all on commerce_private.%I from public,anon,authenticated',n);
 execute format('grant select,insert,update,delete on commerce_private.%I to service_role',n);
 end loop;
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('cm_accounting_control_center_v2','cm_accounting_admin_action_v2','cm_claim_accounting_jobs_v2','cm_operational_status_v2','cm_completed_checkout_operation_v2','cm_accounting_job_action_v2','cm_runtime_capabilities_v2','cm_create_card_order_v2',
 'cm_pay_create_stripe_attempt_v2','cm_pay_bind_stripe_session_v2','cm_pay_process_stripe_webhook_v2','cm_invoice_projection_v2') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
grant usage,select on sequence commerce_private.payment_lifecycle_events_id_seq to service_role;
-- Retire legacy mutation entry points for application roles; retained for historical replay.
revoke execute on function public.cm_pay_create_stripe_attempt_v1(uuid) from service_role;
revoke execute on function public.cm_pay_bind_stripe_checkout_session_v1(uuid,text,text) from service_role;
revoke execute on function public.cm_pay_process_stripe_webhook_v1(text,text,text,uuid,uuid,text,numeric,timestamptz,text,text,numeric) from service_role;
