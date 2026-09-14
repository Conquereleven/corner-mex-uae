-- INTERMEX-PO-AUTOMATION-1: additive intake boundary. No provider or production activation.
create table commerce_private.po_mapping_sets (
 mode text not null check(mode in ('test','live')), organization_id text not null,
 revision uuid not null default gen_random_uuid(), mappings jsonb not null,
 approved_by uuid not null references auth.users(id), updated_at timestamptz not null default now(),
 primary key(mode,organization_id),
 check(mappings->>'mode'=mode and mappings->>'organizationId'=organization_id),
 check(mode<>'test' or (organization_id<>'773588238' and mappings->>'testOrganizationVerified'='true'))
);
create table commerce_private.po_intakes (
 id uuid primary key default gen_random_uuid(), mode text not null check(mode in ('test','live')),
 organization_id text not null, source text not null check(source in ('email','ichat','admin')),
 source_key text not null check(source_key ~ '^[a-f0-9]{64}$'),
 document_hash text not null check(document_hash ~ '^[a-f0-9]{64}$'),
 document_base64 text not null check(length(document_base64) between 1 and 6990508), mime text not null,
 normalized_po jsonb, composed jsonb, mapping_revision uuid,
 business_key text, status text not null check(status in ('requires_attention','ready_for_review','released','processing','succeeded')),
 safe_code text, correlation_id uuid not null default gen_random_uuid(),
 locked_by text, locked_until timestamptz, activation_generation uuid,
 external_invoice_id text, invoice_projection jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(mode,organization_id,source,source_key), unique(mode,organization_id,document_hash),
 unique(mode,organization_id,business_key), unique(mode,organization_id,external_invoice_id)
);
create table commerce_private.po_intake_receipts (
 mode text not null, organization_id text not null, source text not null, source_key text not null,
 document_hash text not null, intake_id uuid not null references commerce_private.po_intakes(id),
 created_at timestamptz not null default now(), primary key(mode,organization_id,source,source_key)
);
create table commerce_private.po_intake_revisions (
 id uuid primary key default gen_random_uuid(), intake_id uuid not null references commerce_private.po_intakes(id),
 actor_id uuid not null references auth.users(id), reason text not null, before_value jsonb not null, after_value jsonb not null,
 created_at timestamptz not null default now()
);
create table commerce_private.po_intake_conflicts (
 id uuid primary key default gen_random_uuid(), intake_id uuid not null references commerce_private.po_intakes(id),
 source text not null, source_key text not null, document_hash text not null,
 document_base64 text not null check(length(document_base64) between 1 and 6990508),
 safe_code text not null, created_at timestamptz not null default now(), unique(intake_id,source,source_key,document_hash)
);
create index po_intakes_queue on commerce_private.po_intakes(status,created_at);
alter table commerce_private.accounting_integration_audit_events add column po_intake_id uuid references commerce_private.po_intakes(id);
-- Reuse accounting audit and durable create intents; PO lifecycle does not create a fictitious paid storefront order.
create function public.cm_po_action_v1(p_action text,p_payload jsonb default '{}'::jsonb,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r commerce_private.po_intakes%rowtype; c commerce_private.po_mapping_sets%rowtype;
 g commerce_private.provider_runtime_gates%rowtype; ident text; result jsonb; acquired boolean;
begin
 if p_action in ('configure','list','detail','release','revise') and (p_actor_id is null or not commerce_private.is_admin(p_actor_id)) then raise exception 'CM_ADMIN_ROLE_REQUIRED'; end if;
 if p_action='configure' then
   if p_payload->>'version' is distinct from 'intermex-po-v1' then raise exception 'PO_MAPPING_VERSION_INVALID'; end if;
   insert into commerce_private.po_mapping_sets(mode,organization_id,mappings,approved_by)
   values(p_payload->>'mode',p_payload->>'organizationId',p_payload,p_actor_id)
   on conflict(mode,organization_id) do update set mappings=excluded.mappings,approved_by=p_actor_id,revision=gen_random_uuid(),updated_at=now();
   insert into commerce_private.accounting_integration_audit_events(provider,correlation_id,action,outcome,safe_code)
   values('zoho',gen_random_uuid(),'po_mapping_configuration','succeeded','ADMIN_'||p_actor_id::text);
   return jsonb_build_object('ok',true);
 elsif p_action='mappings' then
   return (select jsonb_build_object('revision',revision,'mappings',mappings) from commerce_private.po_mapping_sets
   where mode=p_payload->>'mode' and organization_id=p_payload->>'organizationId');
 elsif p_action='list' then
   return coalesce((select jsonb_agg(v) from (select id,mode,organization_id,source,status,safe_code,correlation_id,
     normalized_po->>'poNumber' as po_number,created_at,updated_at,invoice_projection,
     (select count(*) from commerce_private.po_intake_conflicts x where x.intake_id=po_intakes.id) as conflict_count
     from commerce_private.po_intakes order by created_at desc limit 100) v),'[]'::jsonb);
 elsif p_action='detail' then
   return (select (to_jsonb(t)-'document_base64') || jsonb_build_object(
     'conflicts',coalesce((select jsonb_agg(to_jsonb(x)-'document_base64') from commerce_private.po_intake_conflicts x where x.intake_id=t.id),'[]'::jsonb),
     'audit',coalesce((select jsonb_agg(a order by a.created_at) from commerce_private.accounting_integration_audit_events a where a.po_intake_id=t.id),'[]'::jsonb),
     'revisions',coalesce((select jsonb_agg(v order by v.created_at) from commerce_private.po_intake_revisions v where v.intake_id=t.id),'[]'::jsonb))
     from commerce_private.po_intakes t where id=(p_payload->>'id')::uuid);
 elsif p_action='intake' then
   if encode(extensions.digest(decode(p_payload->>'documentBase64','base64'),'sha256'),'hex') is distinct from p_payload->>'documentHash' then raise exception 'PO_DOCUMENT_HASH_MISMATCH'; end if;
   -- Serialize overlapping source/document/business identities, including arrivals on different channels.
   perform pg_advisory_xact_lock(hashtextextended('po:'||(p_payload->>'mode')||':'||(p_payload->>'organizationId'),0));
   select p.* into r from commerce_private.po_intakes p where p.mode=p_payload->>'mode' and p.organization_id=p_payload->>'organizationId'
     and (p.document_hash=p_payload->>'documentHash' or p.id in (select intake_id from commerce_private.po_intake_receipts
       where mode=p_payload->>'mode' and organization_id=p_payload->>'organizationId' and source=p_payload->>'source' and source_key=p_payload->>'sourceKey')) order by p.created_at limit 1;
   if found then
     if r.document_hash<>p_payload->>'documentHash' then
       insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome,safe_code)
       values('zoho',r.id,r.correlation_id,'po_duplicate','failed','SOURCE_ID_CONFLICT');
       insert into commerce_private.po_intake_conflicts(intake_id,source,source_key,document_hash,document_base64,safe_code)
       values(r.id,p_payload->>'source',p_payload->>'sourceKey',p_payload->>'documentHash',p_payload->>'documentBase64','SOURCE_ID_CONFLICT') on conflict do nothing;
       update commerce_private.po_intakes set status=case when status='succeeded' then status else 'requires_attention' end,
         safe_code='SOURCE_ID_CONFLICT',updated_at=now() where id=r.id;
       return jsonb_build_object('id',r.id,'status','requires_attention','code','SOURCE_ID_CONFLICT');
     end if;
     insert into commerce_private.po_intake_receipts(mode,organization_id,source,source_key,document_hash,intake_id)
     values(r.mode,r.organization_id,p_payload->>'source',p_payload->>'sourceKey',r.document_hash,r.id) on conflict do nothing;
     insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome)
     values('zoho',r.id,r.correlation_id,'po_duplicate','skipped');
     return jsonb_build_object('id',r.id,'status',r.status,'duplicate',true);
   end if;
   if p_payload->'composed' is not null and p_payload->'composed'<>'null'::jsonb then
     select * into c from commerce_private.po_mapping_sets where mode=p_payload->>'mode' and organization_id=p_payload->>'organizationId';
     if not found or c.revision is distinct from (p_payload->>'mappingRevision')::uuid then raise exception 'PO_MAPPING_CHANGED'; end if;
     if p_payload#>>'{composed,mode}' is distinct from c.mode or p_payload#>>'{composed,organizationId}' is distinct from c.organization_id then raise exception 'PO_SCOPE_MISMATCH'; end if;
     ident:=encode(extensions.digest((p_payload#>'{composed,identity}')::text,'sha256'),'hex');
     select * into r from commerce_private.po_intakes where mode=c.mode and organization_id=c.organization_id and business_key=ident;
     if found then
       insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome,safe_code)
       values('zoho',r.id,r.correlation_id,'po_duplicate','failed','PO_REVISION_REQUIRES_ATTENTION');
       insert into commerce_private.po_intake_conflicts(intake_id,source,source_key,document_hash,document_base64,safe_code)
       values(r.id,p_payload->>'source',p_payload->>'sourceKey',p_payload->>'documentHash',p_payload->>'documentBase64','PO_REVISION_REQUIRES_ATTENTION') on conflict do nothing;
       update commerce_private.po_intakes set status=case when status='succeeded' then status else 'requires_attention' end,
         safe_code='PO_REVISION_REQUIRES_ATTENTION',updated_at=now() where id=r.id;
       return jsonb_build_object('id',r.id,'status','requires_attention','code','PO_REVISION_REQUIRES_ATTENTION');
     end if;
   end if;
   insert into commerce_private.po_intakes(mode,organization_id,source,source_key,document_hash,document_base64,mime,
     normalized_po,composed,mapping_revision,business_key,status,safe_code)
   values(p_payload->>'mode',p_payload->>'organizationId',p_payload->>'source',p_payload->>'sourceKey',p_payload->>'documentHash',
     p_payload->>'documentBase64',p_payload->>'mime',p_payload->'normalized',p_payload->'composed',c.revision,ident,
     case when ident is null then 'requires_attention' else 'ready_for_review' end,p_payload->>'safeCode') returning * into r;
   insert into commerce_private.po_intake_receipts(mode,organization_id,source,source_key,document_hash,intake_id)
   values(r.mode,r.organization_id,r.source,r.source_key,r.document_hash,r.id);
   insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome,safe_code)
   values('zoho',r.id,r.correlation_id,'po_intake',case when ident is null then 'failed' else 'succeeded' end,r.safe_code);
   return jsonb_build_object('id',r.id,'status',r.status,'code',r.safe_code);
 end if;
 select * into r from commerce_private.po_intakes where id=(p_payload->>'id')::uuid for update;
 if not found then raise exception 'PO_NOT_FOUND'; end if;
 if p_action='revise' then
   if r.status not in ('ready_for_review','requires_attention') or r.external_invoice_id is not null
     or exists(select 1 from commerce_private.accounting_create_intents where job_id=r.id) then raise exception 'PO_RECONCILIATION_ONLY'; end if;
   if length(trim(coalesce(p_payload->>'reason','')))<10 then raise exception 'PO_REVISION_REASON_REQUIRED'; end if;
   select * into c from commerce_private.po_mapping_sets where mode=r.mode and organization_id=r.organization_id;
   if not found or c.revision is distinct from (p_payload->>'mappingRevision')::uuid or p_payload#>>'{composed,mode}' is distinct from r.mode
     or p_payload#>>'{composed,organizationId}' is distinct from r.organization_id then raise exception 'PO_MAPPING_CHANGED'; end if;
   ident:=encode(extensions.digest((p_payload#>'{composed,identity}')::text,'sha256'),'hex');
   insert into commerce_private.po_intake_revisions(intake_id,actor_id,reason,before_value,after_value)
     values(r.id,p_actor_id,p_payload->>'reason',jsonb_build_object('normalized',r.normalized_po,'composed',r.composed),
       jsonb_build_object('normalized',p_payload->'normalized','composed',p_payload->'composed'));
   update commerce_private.po_intakes set normalized_po=p_payload->'normalized',composed=p_payload->'composed',
     mapping_revision=c.revision,business_key=ident,status='ready_for_review',safe_code=null,updated_at=now() where id=r.id;
   insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome)
     values('zoho',r.id,r.correlation_id,'po_revision','succeeded');
   return jsonb_build_object('id',r.id,'status','ready_for_review');
 end if;
 if p_action='release' then
   -- This action is not exposed by this sprint's server/UI: future explicit activation only.
   if r.status<>'ready_for_review' then raise exception 'PO_NOT_RELEASABLE'; end if;
   if exists(select 1 from commerce_private.po_intake_conflicts where intake_id=r.id) then raise exception 'PO_CONFLICT_UNRESOLVED'; end if;
   select * into g from commerce_private.provider_runtime_gates where provider='zoho' and mode=r.mode and enabled
     and validated_at<=now() and valid_until>now()+interval '20 seconds' and eligible_after<=r.created_at;
   if not found then raise exception 'PO_ACTIVATION_BLOCKED'; end if;
   select * into c from commerce_private.po_mapping_sets where mode=r.mode and organization_id=r.organization_id;
   if c.revision is distinct from r.mapping_revision or (r.composed->>'mappingValidUntil')::timestamptz<=now() then raise exception 'PO_MAPPING_CHANGED'; end if;
   update commerce_private.po_intakes set status='released',activation_generation=g.generation,updated_at=now() where id=r.id;
   insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome,safe_code)
   values('zoho',r.id,r.correlation_id,'po_release','succeeded','ADMIN_'||p_actor_id::text);
   return jsonb_build_object('ok',true);
 end if;
 if r.status<>'processing' or r.locked_by is distinct from p_payload->>'workerId' or r.locked_until<=clock_timestamp() then raise exception 'PO_LEASE_LOST'; end if;
 if p_action<>'attention' then
   if not exists(select 1 from commerce_private.provider_runtime_gates where provider='zoho' and enabled and mode=r.mode
     and generation=r.activation_generation and valid_until>clock_timestamp()+interval '20 seconds' and validated_at<=clock_timestamp() and eligible_after<=r.created_at)
     or r.locked_until<=clock_timestamp()+interval '20 seconds' then raise exception 'PO_ACTIVATION_BLOCKED'; end if;
   if not exists(select 1 from commerce_private.po_mapping_sets where mode=r.mode and organization_id=r.organization_id and revision=r.mapping_revision)
     or (r.composed->>'mappingValidUntil')::timestamptz<=clock_timestamp() then raise exception 'PO_MAPPING_CHANGED'; end if;
 end if;
 if p_action='assert' then return jsonb_build_object('ok',true);
 elsif p_action='begin_create' then
   insert into commerce_private.accounting_create_intents(entity_key,job_id) values('po:'||r.mode||':'||r.organization_id||':'||r.business_key,r.id) on conflict do nothing;
   acquired:=found; return jsonb_build_object('acquired',acquired);
 elsif p_action='complete' then
   if nullif(p_payload->>'invoiceId','') is null then raise exception 'PO_INVOICE_ID_REQUIRED'; end if;
   update commerce_private.po_intakes set status='succeeded',external_invoice_id=p_payload->>'invoiceId',invoice_projection=p_payload->'projection',safe_code=null,updated_at=now() where id=r.id;
 elsif p_action='attention' then
   update commerce_private.po_intakes set status='requires_attention',safe_code=p_payload->>'code',updated_at=now() where id=r.id;
 else raise exception 'PO_ACTION_INVALID'; end if;
 insert into commerce_private.accounting_integration_audit_events(provider,po_intake_id,correlation_id,action,outcome,safe_code,external_id)
 values('zoho',r.id,r.correlation_id,'po_'||p_action,case when p_action='attention' then 'failed' else 'succeeded' end,p_payload->>'code',p_payload->>'invoiceId');
 return jsonb_build_object('ok',true);
end; $$;
create function public.cm_po_claim_v1(p_worker_id text,p_mode text,p_organization_id text)
returns setof commerce_private.po_intakes language plpgsql security definer set search_path='' as $$
begin
 if nullif(p_worker_id,'') is null or length(p_worker_id)>100 then raise exception 'PO_WORKER_INVALID'; end if;
 -- Expired creates never automatically return to create: operator reconciliation required.
 update commerce_private.po_intakes set status='requires_attention',safe_code='PO_LEASE_EXPIRED',updated_at=now()
 where status='processing' and locked_until<=now() and mode=p_mode and organization_id=p_organization_id;
 return query with candidate as (
   select p.id from commerce_private.po_intakes p join commerce_private.provider_runtime_gates g on g.provider='zoho'
   join commerce_private.po_mapping_sets m on m.mode=p.mode and m.organization_id=p.organization_id and m.revision=p.mapping_revision
   where p.status='released' and p.mode=p_mode and p.organization_id=p_organization_id and g.enabled and g.mode=p.mode
     and g.generation=p.activation_generation and g.validated_at<=now() and g.valid_until>now()+interval '20 seconds'
     and p.created_at>=g.eligible_after and (p.composed->>'mappingValidUntil')::timestamptz>now()
   order by p.created_at for update of p skip locked limit 1
 ) update commerce_private.po_intakes p set status='processing',locked_by=p_worker_id,locked_until=now()+interval '5 minutes',updated_at=now()
   from candidate c where p.id=c.id returning p.*;
end; $$;
alter table commerce_private.po_mapping_sets enable row level security;
alter table commerce_private.po_mapping_sets force row level security;
alter table commerce_private.po_intakes enable row level security;
alter table commerce_private.po_intakes force row level security;
revoke all on commerce_private.po_mapping_sets,commerce_private.po_intakes from public,anon,authenticated,service_role;
revoke all on function public.cm_po_action_v1(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.cm_po_claim_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.cm_po_action_v1(text,jsonb,uuid) to service_role;
grant execute on function public.cm_po_claim_v1(text,text,text) to service_role;

alter table commerce_private.po_intake_receipts enable row level security;
alter table commerce_private.po_intake_receipts force row level security;
alter table commerce_private.po_intake_revisions enable row level security;
alter table commerce_private.po_intake_revisions force row level security;
revoke all on commerce_private.po_intake_receipts,commerce_private.po_intake_revisions from public,anon,authenticated,service_role;

alter table commerce_private.po_intake_conflicts enable row level security;
alter table commerce_private.po_intake_conflicts force row level security;
revoke all on commerce_private.po_intake_conflicts from public,anon,authenticated,service_role;
