-- READ ONLY. Canonical project wlrfknmrhowldygmvtvn must be verified externally.
-- Evaluate ONLY the rows for the separately authorized target gate.
-- Every applicable row must be true; null/false/error is STOP. No apply in this file.
with checks(gate, check_id, passed) as (
  select 'ZOHO', 'target_absent', not exists (
    select 1 from supabase_migrations.schema_migrations
    where name='cm_int_zoho_1_zero_touch_order_invoice')
  union all select 'ZOHO', 'b2b_c_ledger_present', exists (
    select 1 from supabase_migrations.schema_migrations
    where name='cm_b2b_portal_1b_pricing_availability')
  union all select 'ZOHO', 'objects_absent',
    to_regclass('commerce_private.accounting_integration_jobs') is null
    and to_regclass('commerce_private.accounting_entity_mappings') is null
    and to_regclass('commerce_private.accounting_integration_audit_events') is null
  union all select 'STRIPE', 'target_absent', not exists (
    select 1 from supabase_migrations.schema_migrations
    where name='cm_pay_stripe_1_payment_foundation')
  union all select 'STRIPE', 'zoho_ledger_present', exists (
    select 1 from supabase_migrations.schema_migrations
    where name='cm_int_zoho_1_zero_touch_order_invoice')
  union all select 'STRIPE', 'ledger_object_absent',
    to_regclass('commerce_private.payment_webhook_events') is null
  union all select 'STRIPE', 'stripe_reference_duplicates_absent', not exists (
    select provider_reference from public.payments
    where provider='stripe' and provider_reference is not null
      and provider_reference not like 'stripe-attempt:%'
    group by provider_reference having count(*)>1)
)
select gate, check_id, coalesce(passed,false) as passed from checks order by gate,check_id;
-- Also require the referenced B2B postflight/smoke artifacts, exact source hash,
-- frozen head, fresh Founder authorization, and provider-disabled evidence.
