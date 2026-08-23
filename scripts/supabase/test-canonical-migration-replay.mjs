import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const databaseUrl = process.env.CANONICAL_REPLAY_DATABASE_URL;
if (!databaseUrl && !process.env.PGDATABASE) {
  throw new Error(
    "CANONICAL_REPLAY_DATABASE_URL or standard PG* connection variables are required",
  );
}

const psql = (...args) =>
  execFileSync("psql", [...(databaseUrl ? [databaseUrl] : []), "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

psql("-f", "tests/fixtures/supabase-canonical-platform-prelude.sql");
const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const migration of migrations) psql("-f", `supabase/migrations/${migration}`);

const metricsSql = `
select json_build_object(
  'tables', (select count(*) from pg_tables where schemaname='public'),
  'publicFunctions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_transition_order_lifecycle_v1','b2b_portal_v1','cm_com_4a_order_lifecycle_capability','place_cod_order_v1','rls_auto_enable','set_updated_at')),
  'privateFunctions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='commerce_private' and p.proname='is_admin'),
  'rlsTables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
  'policies', (select count(*) from pg_policies where schemaname='public'),
  'privateB2bRlsTables', (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='commerce_private'
       and c.relkind='r'
       and c.relname in ('b2b_lead_status_history','b2b_lead_notes','b2b_intake_abuse_budget')
       and c.relrowsecurity
       and not c.relforcerowsecurity
  ),
  'privateB2bPolicies', (
    select count(*)
      from pg_policies
     where schemaname='commerce_private'
       and tablename in ('b2b_lead_status_history','b2b_lead_notes','b2b_intake_abuse_budget')
  ),
  'privateB2bDirectGrants', (
    select count(*)
      from information_schema.table_privileges
     where table_schema='commerce_private'
       and table_name in ('b2b_lead_status_history','b2b_lead_notes','b2b_intake_abuse_budget')
       and grantee in ('PUBLIC','anon','authenticated','service_role')
  ),
  'b2bOpsPrivateTables', (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='commerce_private'
       and c.relkind='r'
       and c.relname in (
         'b2b_customer_accounts',
         'b2b_account_users',
         'b2b_account_variant_prices',
         'saved_lists',
         'saved_list_items',
         'inventory_policies'
       )
       and c.relrowsecurity
       and c.relforcerowsecurity
  ),
  'b2bOpsPrivatePolicies', (
    select count(*)
      from pg_policies
     where schemaname='commerce_private'
       and tablename in (
         'b2b_customer_accounts',
         'b2b_account_users',
         'b2b_account_variant_prices',
         'saved_lists',
         'saved_list_items',
         'inventory_policies'
       )
  ),
  'b2bOpsPrivateDirectGrants', (
    select count(*)
      from information_schema.table_privileges
     where table_schema='commerce_private'
       and table_name in (
         'b2b_customer_accounts',
         'b2b_account_users',
         'b2b_account_variant_prices',
         'saved_lists',
         'saved_list_items',
         'inventory_policies'
       )
       and grantee in ('PUBLIC','anon','authenticated','service_role')
  ),
  'mcpGrantRlsTables', (
    select count(*)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='commerce_private'
       and c.relkind='r'
       and c.relname='mcp_grants'
       and c.relrowsecurity
       and not c.relforcerowsecurity
  ),
  'mcpGrantPolicies', (
    select count(*)
      from pg_policies
     where schemaname='commerce_private'
       and tablename='mcp_grants'
  ),
  'mcpGrantDirectGrants', (
    select count(*)
      from information_schema.table_privileges
     where table_schema='commerce_private'
       and table_name='mcp_grants'
       and grantee in ('PUBLIC','anon','authenticated','service_role')
  ),
  'mcpReadFunctions', (
    select count(*)
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in (
         'mcp_current_permissions',
         'mcp_catalog_search',
         'mcp_catalog_get_product',
         'mcp_inventory_get_availability',
         'mcp_orders_list',
         'mcp_orders_get',
         'mcp_b2b_list_leads',
         'mcp_b2b_get_lead',
         'mcp_ops_summary'
       )
       and p.prosecdef
  ),
  'mcpAuthenticatedExecuteFunctions', (
    select count(*)
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in (
         'mcp_current_permissions',
         'mcp_catalog_search',
         'mcp_catalog_get_product',
         'mcp_inventory_get_availability',
         'mcp_orders_list',
         'mcp_orders_get',
         'mcp_b2b_list_leads',
         'mcp_b2b_get_lead',
         'mcp_ops_summary'
       )
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       and not has_function_privilege('anon', p.oid, 'EXECUTE')
       and not has_function_privilege('service_role', p.oid, 'EXECUTE')
  )
)::text;`;
const first = JSON.parse(psql("-At", "-c", metricsSql));
const second = JSON.parse(psql("-At", "-c", metricsSql));
const expected = {
  tables: 22,
  publicFunctions: 6,
  privateFunctions: 1,
  rlsTables: 22,
  // L5R retires the direct public b2b_leads intake policy. Enquiries now enter only
  // through the server-mediated submit_b2b_lead_v2 RPC using the service role.
  policies: 37,
  // SEC-RLS-1 keeps the private B2B tables non-direct: RLS is enabled without
  // FORCE RLS or row policies, and no application role has table privileges.
  privateB2bRlsTables: 3,
  privateB2bPolicies: 0,
  privateB2bDirectGrants: 0,
  // CM-B2B-OPS-FOUNDATION-1 is closed by default: all six foundation tables
  // use forced RLS, have no policies and expose no direct application grants.
  b2bOpsPrivateTables: 6,
  b2bOpsPrivatePolicies: 0,
  b2bOpsPrivateDirectGrants: 0,
  // CM-MCP-DB2 keeps the grant store private while exposing exactly nine guarded
  // SECURITY DEFINER read RPCs to authenticated OAuth callers only.
  mcpGrantRlsTables: 1,
  mcpGrantPolicies: 0,
  mcpGrantDirectGrants: 0,
  mcpReadFunctions: 9,
  mcpAuthenticatedExecuteFunctions: 9,
};
if (JSON.stringify(first) !== JSON.stringify(expected))
  throw new Error(`canonical replay mismatch: ${JSON.stringify(first)}`);
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error("canonical replay validation is not deterministic");
console.log(
  `canonical migration replay valid: migrations=${migrations.length}, tables=${first.tables}, functions=${first.publicFunctions}, rls=${first.rlsTables}, privateB2bRls=${first.privateB2bRlsTables}, mcpReadFunctions=${first.mcpReadFunctions}, policies=${first.policies}`,
);
