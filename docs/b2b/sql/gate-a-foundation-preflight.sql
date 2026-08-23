-- CM-B2B-OPS-PROD-READINESS-1 / Gate A preflight
-- READ ONLY. Run on project wlrfknmrhowldygmvtvn immediately before the separately
-- authorized Gate A apply. Every row must be green. Any STOP ends the sequence.

with checks as (
  select
    'A01_target_ledger_absent' as check_id,
    count(*) = 0 as passed,
    count(*)::text as observed,
    '0 rows named cm_b2b_ops_foundation_1' as expected
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_ops_foundation_1'

  union all
  select
    'A02_portal_ledger_absent', count(*) = 0, count(*)::text,
    '0 rows named cm_b2b_portal_1a_boundary'
  from supabase_migrations.schema_migrations
  where name = 'cm_b2b_portal_1a_boundary'

  union all
  select
    'A03_private_schema_owned_by_postgres',
    coalesce((select r.rolname = 'postgres'
      from pg_namespace n join pg_roles r on r.oid = n.nspowner
      where n.nspname = 'commerce_private'), false),
    coalesce((select r.rolname
      from pg_namespace n join pg_roles r on r.oid = n.nspowner
      where n.nspname = 'commerce_private'), '<absent>'),
    'postgres'

  union all
  select
    'A04_required_roles_present', count(*) = 3, count(*)::text,
    'anon, authenticated and service_role all present'
  from pg_roles where rolname in ('anon', 'authenticated', 'service_role')

  union all
  select
    'A05_identity_and_variant_prerequisites_present', count(*) = 3, count(*)::text,
    'auth.users, public.product_variants and public.set_updated_at() present'
  from (values
    (to_regclass('auth.users') is not null),
    (to_regclass('public.product_variants') is not null),
    (to_regprocedure('public.set_updated_at()') is not null)
  ) prerequisite(present)
  where present

  union all
  select
    'A06_required_prerequisite_columns_present', count(*) = 2, count(*)::text,
    'auth.users.id and public.product_variants.id present'
  from information_schema.columns
  where (table_schema, table_name, column_name) in (
    ('auth', 'users', 'id'),
    ('public', 'product_variants', 'id')
  )

  union all
  select
    'A07_foundation_relation_names_clear', count(*) = 0, count(*)::text,
    'no target table or index names exist'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'commerce_private'
    and c.relname in (
      'b2b_customer_accounts', 'b2b_account_users', 'b2b_account_variant_prices',
      'saved_lists', 'saved_list_items', 'inventory_policies',
      'b2b_account_users_user_idx', 'saved_lists_account_updated_idx',
      'saved_list_items_list_order_idx'
    )

  union all
  select
    'A08_foundation_trigger_names_clear', count(*) = 0, count(*)::text,
    'no target trigger names exist'
  from pg_trigger
  where not tgisinternal and tgname in (
    'b2b_customer_accounts_set_updated_at', 'b2b_account_users_set_updated_at',
    'b2b_account_variant_prices_set_updated_at', 'saved_lists_set_updated_at',
    'saved_list_items_set_updated_at', 'inventory_policies_set_updated_at'
  )

  union all
  select
    'A09_existing_commerce_rpcs_present', count(*) = 10, count(*)::text,
    '10 protected commerce/B2B RPC identities present'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in (
    'admin_add_b2b_lead_note_v1', 'admin_delete_b2b_lead_note_v1',
    'admin_get_b2b_lead_v1', 'admin_list_b2b_leads_v1',
    'admin_save_b2b_quote_draft_v1', 'admin_transition_order_lifecycle_v1',
    'admin_update_b2b_lead_pipeline_v1', 'admin_update_b2b_lead_v1',
    'place_cod_order_v1', 'submit_b2b_lead_v2'
  )
)
select check_id, case when passed then 'green' else 'STOP' end as status, observed, expected
from checks
order by check_id;

-- Custody fingerprints for the operator to retain and compare after Gate A.
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
