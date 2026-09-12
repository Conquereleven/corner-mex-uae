-- Read only. Run only on the separately approved target; do not infer approval from this file.
select version,name from supabase_migrations.schema_migrations order by version desc limit 15;
select to_regprocedure('public.cm_runtime_capabilities_v2()') as capability,
 to_regprocedure('public.cm_claim_accounting_jobs_v2(text,integer)') as worker_claim,
 to_regprocedure('public.cm_invoice_projection_v2(uuid,uuid)') as invoice_projection;
-- If v2 is absent, stop here. Apply nothing under this preflight.
