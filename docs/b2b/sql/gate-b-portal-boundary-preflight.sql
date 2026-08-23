-- CM-B2B-OPS-PROD-READINESS-1 / Gate B preflight
-- READ ONLY. Gate B is invalid without Gate A postflight green and a new, separate
-- Founder authorization issued after that result. Every row must be green.

with target_tables(name) as (values
  ('b2b_customer_accounts'), ('b2b_account_users'), ('b2b_account_variant_prices'),
  ('saved_lists'), ('saved_list_items'), ('inventory_policies')
), required_columns(table_schema, table_name, column_name) as (values
  ('public', 'products', 'id'), ('public', 'products', 'slug'),
  ('public', 'products', 'status'),
  ('public', 'product_variants', 'id'), ('public', 'product_variants', 'product_id'),
  ('public', 'product_variants', 'sku'), ('public', 'product_variants', 'format_label'),
  ('public', 'product_variants', 'is_active'),
  ('public', 'product_translations', 'product_id'),
  ('public', 'product_translations', 'name'), ('public', 'product_translations', 'lang'),
  ('public', 'inventory', 'variant_id'), ('public', 'inventory', 'quantity_on_hand'),
  ('public', 'inventory', 'quantity_reserved'),
  ('public', 'orders', 'id'), ('public', 'orders', 'buyer_id'),
  ('public', 'orders', 'order_number'), ('public', 'orders', 'created_at'),
  ('public', 'orders', 'status'),
  ('public', 'order_items', 'order_id'), ('public', 'order_items', 'variant_id'),
  ('public', 'order_items', 'product_name'), ('public', 'order_items', 'variant_label'),
  ('public', 'order_items', 'qty')
), checks as (
  select
    'B01_gate_a_ledger_present_once' as check_id,
    count(*) = 1 as passed, count(*)::text as observed,
    '1 row named cm_b2b_ops_foundation_1' as expected
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_ops_foundation_1'

  union all
  select
    'B02_gate_b_ledger_absent', count(*) = 0, count(*)::text,
    '0 rows named cm_b2b_portal_1a_boundary'
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_portal_1a_boundary'

  union all
  select
    'B03_gate_a_tables_still_green', count(*) = 6, count(*)::text,
    '6 owner-postgres tables with forced RLS'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner
  join target_tables t on t.name = c.relname
  where n.nspname = 'commerce_private' and c.relkind = 'r'
    and c.relrowsecurity and c.relforcerowsecurity and r.rolname = 'postgres'

  union all
  select
    'B04_gate_a_tables_have_no_policies_or_app_grants',
    (select count(*) from pg_policies p join target_tables t on t.name = p.tablename
      where p.schemaname = 'commerce_private') = 0
    and
    (select count(*) from information_schema.table_privileges p
      join target_tables t on t.name = p.table_name
      where p.table_schema = 'commerce_private'
        and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')) = 0,
    format('policies=%s grants=%s',
      (select count(*) from pg_policies p join target_tables t on t.name = p.tablename
        where p.schemaname = 'commerce_private'),
      (select count(*) from information_schema.table_privileges p
        join target_tables t on t.name = p.table_name
        where p.table_schema = 'commerce_private'
          and p.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role'))),
    'policies=0 grants=0'

  union all
  select
    'B05_portal_function_name_clear',
    to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)') is null,
    coalesce(to_regprocedure('public.b2b_portal_v1(text,uuid,jsonb)')::text, '<absent>'),
    '<absent>'

  union all
  select
    'B06_portal_relation_prerequisites_present', count(*) = 7, count(*)::text,
    '7 public relation prerequisites present'
  from (values
    (to_regclass('public.products') is not null),
    (to_regclass('public.product_variants') is not null),
    (to_regclass('public.product_translations') is not null),
    (to_regclass('public.inventory') is not null),
    (to_regclass('public.orders') is not null),
    (to_regclass('public.order_items') is not null),
    (to_regclass('commerce_private.b2b_account_users') is not null)
  ) prerequisite(present)
  where present

  union all
  select
    'B07_portal_required_columns_present', count(*) = 24, count(*)::text,
    '24 exact public columns present'
  from information_schema.columns c
  join required_columns r using (table_schema, table_name, column_name)

  union all
  select
    'B08_authenticated_role_present', count(*) = 1, count(*)::text,
    'authenticated role present'
  from pg_roles where rolname = 'authenticated'
)
select check_id, case when passed then 'green' else 'STOP' end as status, observed, expected
from checks
order by check_id;

-- Re-run and retain the existing RPC fingerprints. Compare with Gate A preflight custody;
-- any unrelated definition change is a STOP.
select
  p.oid::regprocedure::text as function_identity,
  r.rolname as owner,
  p.prosecdef as security_definer,
  md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname in (
  'admin_add_b2b_lead_note_v1', 'admin_delete_b2b_lead_note_v1',
  'admin_get_b2b_lead_v1', 'admin_list_b2b_leads_v1',
  'admin_save_b2b_quote_draft_v1', 'admin_transition_order_lifecycle_v1',
  'admin_update_b2b_lead_pipeline_v1', 'admin_update_b2b_lead_v1',
  'place_cod_order_v1', 'submit_b2b_lead_v2'
)
order by function_identity;
