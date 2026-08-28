-- CM-B2B-OPS-PROD-READINESS-1 / Gate C preflight
-- READ ONLY. Gate C is invalid without Gate B postflight and runtime smoke green
-- plus a new, separate Founder authorization. Every row must be green.

with target_tables(name) as (values
  ('b2b_customer_accounts'), ('b2b_account_users'), ('b2b_account_variant_prices'),
  ('saved_lists'), ('saved_list_items'), ('inventory_policies')
), portal as (
  select p.*, r.rolname as owner, pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where p.oid = to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)')
), checks as (
  select 'C01_gate_a_ledger_present_once' as check_id, count(*) = 1 as passed,
    count(*)::text as observed, '1 row named cm_b2b_ops_foundation_1' as expected
  from supabase_migrations.schema_migrations where name = 'cm_b2b_ops_foundation_1'
  union all
  select 'C02_gate_b_ledger_present_once', count(*) = 1, count(*)::text,
    '1 row named cm_b2b_portal_1a_boundary'
  from supabase_migrations.schema_migrations where name = 'cm_b2b_portal_1a_boundary'
  union all
  select 'C03_gate_c_ledger_absent', count(*) = 0, count(*)::text,
    '0 rows named cm_b2b_portal_1b_pricing_availability'
  from supabase_migrations.schema_migrations where name = 'cm_b2b_portal_1b_pricing_availability'
  union all
  select 'C04_portal_1a_identity_and_custody_green', count(*) = 1, count(*)::text,
    'one owner-postgres SECURITY DEFINER function with fixed search path'
  from portal where prosecdef and owner = 'postgres'
    and proconfig = array['search_path=pg_catalog, public, commerce_private']
  union all
  select 'C05_portal_1a_execute_grants_exact', coalesce((select
      has_function_privilege('authenticated', oid, 'EXECUTE')
      and not has_function_privilege('anon', oid, 'EXECUTE')
      and not has_function_privilege('service_role', oid, 'EXECUTE')
      and not exists (select 1 from aclexplode(coalesce(proacl, acldefault('f', proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') from portal), false),
    coalesce((select format('authenticated=%s anon=%s service_role=%s',
      has_function_privilege('authenticated', oid, 'EXECUTE'),
      has_function_privilege('anon', oid, 'EXECUTE'),
      has_function_privilege('service_role', oid, 'EXECUTE')) from portal), '<function absent>'),
    'authenticated=true anon=false service_role=false and PUBLIC=false'
  union all
  select 'C06_portal_1a_definition_is_expected_predecessor', count(*) = 1, count(*)::text,
    'Portal 1A definition has catalogue price and lacks Portal 1B price-status fields'
  from portal where definition ~ 'catalogPriceAed'
    and definition !~ 'effective' || 'PriceAed'
    and definition !~ 'special_' || 'account'
  union all
  select 'C07_foundation_private_posture_preserved', count(*) = 6, count(*)::text,
    '6 owner-postgres tables with forced RLS'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner join target_tables t on t.name = c.relname
  where n.nspname = 'commerce_private' and c.relkind = 'r'
    and c.relrowsecurity and c.relforcerowsecurity and r.rolname = 'postgres'
  union all
  select 'C08_private_tables_have_no_policies_or_app_grants',
    (select count(*) from pg_policies p join target_tables t on t.name = p.tablename
      where p.schemaname = 'commerce_private') = 0
    and (select count(*) from information_schema.table_privileges p
      join target_tables t on t.name = p.table_name where p.table_schema = 'commerce_private'
      and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')) = 0,
    format('policies=%s grants=%s',
      (select count(*) from pg_policies p join target_tables t on t.name = p.tablename
        where p.schemaname = 'commerce_private'),
      (select count(*) from information_schema.table_privileges p join target_tables t on t.name = p.table_name
        where p.table_schema = 'commerce_private' and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role'))),
    'policies=0 grants=0'
)
select check_id, case when passed then 'green' else 'STOP' end as status, observed, expected
from checks order by check_id;

-- Retain the predecessor fingerprint. Gate C is a reviewed replacement of this
-- exact identity; any custody or definition drift is a STOP.
select p.oid::regprocedure::text as function_identity, r.rolname as owner,
  p.prosecdef as security_definer, p.proconfig as configuration,
  md5(pg_get_functiondef(p.oid)) as definition_md5,
  obj_description(p.oid, 'pg_proc') as comment
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid = to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)');
