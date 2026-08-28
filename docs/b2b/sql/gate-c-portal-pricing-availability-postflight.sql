-- CM-B2B-OPS-PROD-READINESS-1 / Gate C postflight
-- READ ONLY. Run immediately after Gate C commits and before runtime smoke.
-- Every row must be green. Any STOP triggers emergency-disable evaluation.

with target_tables(name) as (values
  ('b2b_customer_accounts'), ('b2b_account_users'), ('b2b_account_variant_prices'),
  ('saved_lists'), ('saved_list_items'), ('inventory_policies')
), portal as (
  select p.*, r.rolname as owner, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where p.oid = to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)')
), checks as (
  select 'C101_gate_c_ledger_present_once' as check_id, count(*) = 1 as passed,
    count(*)::text as observed, '1 row named cm_b2b_portal_1b_pricing_availability' as expected
  from supabase_migrations.schema_migrations where name = 'cm_b2b_portal_1b_pricing_availability'
  union all
  select 'C102_exact_function_identity_present', count(*) = 1, count(*)::text,
    'public.b2b_portal_v1(text,uuid,jsonb) present once' from portal
  union all
  select 'C103_security_definer_owner_and_search_path', count(*) = 1, count(*)::text,
    'SECURITY DEFINER, owner postgres, fixed search path' from portal
  where prosecdef and owner = 'postgres'
    and proconfig = array['search_path=pg_catalog, public, commerce_private']
  union all
  select 'C104_execute_grants_exact', coalesce((select
      has_function_privilege('authenticated', oid, 'EXECUTE')
      and not has_function_privilege('anon', oid, 'EXECUTE')
      and not has_function_privilege('service_role', oid, 'EXECUTE')
      and not exists (select 1 from aclexplode(coalesce(proacl, acldefault('f', proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') from portal), false),
    coalesce((select format('PUBLIC=%s anon=%s authenticated=%s service_role=%s',
      exists (select 1 from aclexplode(coalesce(proacl, acldefault('f', proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'),
      has_function_privilege('anon', oid, 'EXECUTE'),
      has_function_privilege('authenticated', oid, 'EXECUTE'),
      has_function_privilege('service_role', oid, 'EXECUTE')) from portal), '<function absent>'),
    'PUBLIC=false anon=false authenticated=true service_role=false'
  union all
  select 'C105_auth_uid_and_active_membership_checks_present', count(*) = 1, count(*)::text,
    'auth.uid plus active membership and account checks present' from portal
  where definition ~* 'auth[.]uid[(][)]' and definition ~* 'au[.]user_id = v_actor'
    and definition ~* 'au[.]status = ''active''' and definition ~* 'a[.]status = ''active'''
  union all
  select 'C106_pricing_precedence_and_freshness_present', count(*) = 1, count(*)::text,
    'catalogPriceAed/effectivePriceAed, special_account and current applicability checks present'
  from portal where definition ~ 'catalogPriceAed' and definition ~ 'effectivePriceAed'
    and definition ~ 'special_account' and definition ~ 'statement_timestamp[(][)]'
    and definition ~ 'b2b_account_variant_prices'
  union all
  select 'C107_current_inventory_and_sellability_present', count(*) = 1, count(*)::text,
    'current public.inventory availability and active product/variant checks present'
  from portal where definition ~ 'quantity_on_hand' and definition ~ 'quantity_reserved'
    and definition ~ 'pv[.]is_active' and definition ~ 'p[.]status'
  union all
  select 'C108_no_forbidden_commerce_mutation', count(*) = 1, count(*)::text,
    'no INSERT/UPDATE/DELETE against orders, payments, inventory or suppliers'
  from portal where definition !~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](orders|order_items|payments|inventory|inventory_movements|suppliers)'
  union all
  select 'C109_private_tables_remain_unexposed',
    (select count(*) from information_schema.table_privileges p join target_tables t on t.name = p.table_name
      where p.table_schema = 'commerce_private' and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')) = 0,
    (select count(*)::text from information_schema.table_privileges p join target_tables t on t.name = p.table_name
      where p.table_schema = 'commerce_private' and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')),
    '0 application-role table grants'
  union all
  select 'C110_private_rls_posture_preserved', count(*) = 6, count(*)::text,
    '6 tables with RLS enabled + forced, owner postgres'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner join target_tables t on t.name = c.relname
  where n.nspname = 'commerce_private' and c.relkind = 'r'
    and c.relrowsecurity and c.relforcerowsecurity and r.rolname = 'postgres'
  union all
  select 'C111_private_tables_still_have_zero_policies', count(*) = 0, count(*)::text,
    '0 direct row policies, RPC remains the only app boundary'
  from pg_policies p join target_tables t on t.name = p.tablename
  where p.schemaname = 'commerce_private'
)
select check_id, case when passed then 'green' else 'STOP' end as status, observed, expected
from checks order by check_id;

select p.oid::regprocedure::text as function_identity, r.rolname as owner,
  p.prosecdef as security_definer, p.provolatile as volatility, p.proconfig as configuration,
  md5(pg_get_functiondef(p.oid)) as definition_md5,
  obj_description(p.oid, 'pg_proc') as comment
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid = to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)');

select roles.role_name,
  case when roles.role_name = 'PUBLIC' then exists (
    select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) else has_function_privilege(roles.role_name, p.oid, 'EXECUTE') end as can_execute
from pg_proc p cross join (values ('PUBLIC'), ('anon'), ('authenticated'), ('service_role')) roles(role_name)
where p.oid = to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)') order by role_name;
