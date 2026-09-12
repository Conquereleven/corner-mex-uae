-- READ ONLY. Evaluate rows for the ONE authorized target gate only.
-- All applicable rows must pass. SQL proves schema posture, not operational readiness.
with expected_tables(gate, name) as (values
 ('STRIPE','payment_webhook_events'),
 ('ZOHO','accounting_integration_jobs'),
 ('ZOHO','accounting_entity_mappings'),
 ('ZOHO','accounting_integration_audit_events')
), checks as (
 select e.gate, e.name || '_rls_and_acl' as check_id,
   coalesce(c.relrowsecurity and c.relforcerowsecurity
     and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
     and not has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'),false) as passed
 from expected_tables e
 left join pg_namespace n on n.nspname='commerce_private'
 left join pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
 union all select 'STRIPE', 'ledger_present', exists (
   select 1 from supabase_migrations.schema_migrations where name='cm_pay_stripe_1_payment_foundation')
 union all select 'ZOHO', 'ledger_present', exists (
   select 1 from supabase_migrations.schema_migrations where name='cm_int_zoho_1_zero_touch_order_invoice')
 union all select 'STRIPE', 'four_service_only_rpc_functions', count(*)=4 and coalesce(bool_and(
   p.prosecdef and has_function_privilege('service_role',p.oid,'EXECUTE')
   and not has_function_privilege('anon',p.oid,'EXECUTE')
   and not has_function_privilege('authenticated',p.oid,'EXECUTE')
   and array_to_string(p.proconfig,',') like '%search_path=pg_catalog%'),false)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
   'cm_pay_create_stripe_attempt_v1','cm_pay_bind_stripe_checkout_session_v1',
   'cm_pay_process_stripe_webhook_v1','cm_pay_note_stripe_attempt_degraded_v1')
 union all select 'ZOHO', 'claim_service_only', count(*)=1 and coalesce(bool_and(
   has_function_privilege('service_role',p.oid,'EXECUTE')
   and not has_function_privilege('anon',p.oid,'EXECUTE')
   and not has_function_privilege('authenticated',p.oid,'EXECUTE')),false)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='commerce_private' and p.proname='claim_accounting_integration_jobs'
)
select gate,check_id,passed from checks order by gate,check_id;
-- Attach catalog output for function definitions/signatures, owners, unique constraints,
-- and enabled order outbox trigger; compare against exact reviewed source.
select n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid)
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='commerce_private' and c.relname in (
 'payment_webhook_events','accounting_integration_jobs','accounting_entity_mappings');
select tgname,tgenabled,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.orders'::regclass and not tgisinternal;
