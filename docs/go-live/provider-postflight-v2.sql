-- Read-only postflight after a separately authorized apply. No provider calls.
select public.cm_runtime_capabilities_v2();
select provider,mode,enabled,generation,eligible_after,validated_at,valid_until,evidence_ref
 from commerce_private.provider_runtime_gates;
select activation_generation,status,count(*) from commerce_private.accounting_integration_jobs group by 1,2;
select provider_mode,status,count(*) from public.payments where provider='stripe' group by 1,2;
select action,status,count(*) from commerce_private.refund_accounting_actions group by 1,2;
select payment_attention,count(*) from public.orders where payment_attention is not null group by 1;
select n.nspname,p.proname,has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as browser_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'cm_%v2';
-- Expected at initial apply: zero enabled gates; zero anon/browser execute grants for operational v2 RPCs.
