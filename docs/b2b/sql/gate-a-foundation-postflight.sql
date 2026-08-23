-- CM-B2B-OPS-PROD-READINESS-1 / Gate A postflight
-- READ ONLY. Run immediately after Gate A commits. Every summary row must be green.
-- Gate B remains forbidden unless this output and the fresh advisor delta are green.

with target_tables(name) as (values
  ('b2b_customer_accounts'), ('b2b_account_users'), ('b2b_account_variant_prices'),
  ('saved_lists'), ('saved_list_items'), ('inventory_policies')
), expected_fks(source_table, target_schema, target_table, delete_action) as (values
  ('b2b_account_users', 'commerce_private', 'b2b_customer_accounts', 'c'),
  ('b2b_account_users', 'auth', 'users', 'c'),
  ('b2b_account_variant_prices', 'commerce_private', 'b2b_customer_accounts', 'c'),
  ('b2b_account_variant_prices', 'public', 'product_variants', 'c'),
  ('saved_lists', 'commerce_private', 'b2b_customer_accounts', 'c'),
  ('saved_lists', 'auth', 'users', 'r'),
  ('saved_list_items', 'commerce_private', 'saved_lists', 'c'),
  ('saved_list_items', 'public', 'product_variants', 'r'),
  ('inventory_policies', 'public', 'product_variants', 'c')
), checks as (
  select
    'A101_foundation_ledger_present_once' as check_id,
    count(*) = 1 as passed,
    count(*)::text as observed,
    '1 row named cm_b2b_ops_foundation_1' as expected
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_ops_foundation_1'

  union all
  select
    'A102_portal_ledger_still_absent', count(*) = 0, count(*)::text,
    '0 rows named cm_b2b_portal_1a_boundary'
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_portal_1a_boundary'

  union all
  select
    'A103_six_private_tables_force_rls_owned_by_postgres', count(*) = 6, count(*)::text,
    '6 tables, RLS enabled + forced, owner postgres'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner
  join target_tables t on t.name = c.relname
  where n.nspname = 'commerce_private' and c.relkind = 'r'
    and c.relrowsecurity and c.relforcerowsecurity and r.rolname = 'postgres'

  union all
  select
    'A104_zero_private_table_policies', count(*) = 0, count(*)::text,
    '0 policies on the six foundation tables'
  from pg_policies p join target_tables t on t.name = p.tablename
  where p.schemaname = 'commerce_private'

  union all
  select
    'A105_zero_application_role_table_grants', count(*) = 0, count(*)::text,
    '0 grants to PUBLIC, anon, authenticated or service_role'
  from information_schema.table_privileges p join target_tables t on t.name = p.table_name
  where p.table_schema = 'commerce_private'
    and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')

  union all
  select
    'A106_nine_canonical_foreign_keys',
    count(*) = 9 and (
      select count(*)
      from pg_constraint actual
      join pg_class actual_rel on actual_rel.oid = actual.conrelid
      join pg_namespace actual_n on actual_n.oid = actual_rel.relnamespace
      join target_tables actual_t on actual_t.name = actual_rel.relname
      where actual_n.nspname = 'commerce_private' and actual.contype = 'f'
    ) = 9,
    format('matched=%s actual=%s', count(*), (
      select count(*)
      from pg_constraint actual
      join pg_class actual_rel on actual_rel.oid = actual.conrelid
      join pg_namespace actual_n on actual_n.oid = actual_rel.relnamespace
      join target_tables actual_t on actual_t.name = actual_rel.relname
      where actual_n.nspname = 'commerce_private' and actual.contype = 'f'
    )),
    'matched=9 actual=9 with exact targets and delete actions'
  from pg_constraint c
  join pg_class source_rel on source_rel.oid = c.conrelid
  join pg_namespace source_n on source_n.oid = source_rel.relnamespace
  join pg_class target_rel on target_rel.oid = c.confrelid
  join pg_namespace target_n on target_n.oid = target_rel.relnamespace
  join expected_fks e
    on e.source_table = source_rel.relname
    and e.target_schema = target_n.nspname
    and e.target_table = target_rel.relname
    and e.delete_action = c.confdeltype::text
  where source_n.nspname = 'commerce_private' and c.contype = 'f'

  union all
  select
    'A107_six_updated_at_triggers', count(*) = 6, count(*)::text,
    '6 enabled set_updated_at triggers'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join target_tables tt on tt.name = c.relname
  where n.nspname = 'commerce_private' and not t.tgisinternal
    and t.tgenabled <> 'D'
    and t.tgfoid = to_regprocedure('public.set_updated_at()')

  union all
  select
    'A108_three_supporting_indexes', count(*) = 3, count(*)::text,
    '3 named supporting indexes'
  from pg_indexes
  where schemaname = 'commerce_private' and indexname in (
    'b2b_account_users_user_idx', 'saved_lists_account_updated_idx',
    'saved_list_items_list_order_idx'
  )

  union all
  select
    'A109_pricing_and_inventory_checks_present', count(*) >= 10, count(*)::text,
    'at least 10 pricing, quantity and inventory CHECK constraints'
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'commerce_private'
    and rel.relname in ('b2b_account_variant_prices', 'saved_list_items', 'inventory_policies')
    and c.contype = 'c'

  union all
  select
    'A110_portal_function_still_absent',
    to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)') is null,
    coalesce(to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)')::text, '<absent>'),
    '<absent>'
)
select check_id, case when passed then 'green' else 'STOP' end as status, observed, expected
from checks
order by check_id;

-- Exact FK custody. Review all nine rows; unexpected targets are a STOP.
select
  format('%I.%I', n.nspname, rel.relname) as source_table,
  c.conname,
  pg_get_constraintdef(c.oid, true) as definition
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'commerce_private'
  and rel.relname in (
    'b2b_customer_accounts', 'b2b_account_users', 'b2b_account_variant_prices',
    'saved_lists', 'saved_list_items', 'inventory_policies'
  )
  and c.contype = 'f'
order by source_table, c.conname;

-- Exact constraint custody for pricing, saved-list quantity/order, and inventory policy.
select
  rel.relname as table_name,
  c.conname,
  pg_get_constraintdef(c.oid, true) as definition,
  c.convalidated as validated
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'commerce_private'
  and rel.relname in ('b2b_account_variant_prices', 'saved_list_items', 'inventory_policies')
  and c.contype in ('c', 'p', 'u', 'f')
order by table_name, c.contype, c.conname;
