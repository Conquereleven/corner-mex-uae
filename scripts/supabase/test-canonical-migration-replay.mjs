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
  'publicFunctions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_transition_order_lifecycle_v1','cm_com_4a_order_lifecycle_capability','place_cod_order_v1','rls_auto_enable','set_updated_at')),
  'privateFunctions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='commerce_private' and p.proname='is_admin'),
  'rlsTables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
  'policies', (select count(*) from pg_policies where schemaname='public')
)::text;`;
const first = JSON.parse(psql("-At", "-c", metricsSql));
const second = JSON.parse(psql("-At", "-c", metricsSql));
const expected = {
  tables: 22,
  publicFunctions: 5,
  privateFunctions: 1,
  rlsTables: 22,
  // L5R retires the direct public b2b_leads intake policy. Enquiries now enter only
  // through the server-mediated submit_b2b_lead_v1 RPC using the service role.
  policies: 37,
};
if (JSON.stringify(first) !== JSON.stringify(expected))
  throw new Error(`canonical replay mismatch: ${JSON.stringify(first)}`);
if (JSON.stringify(first) !== JSON.stringify(second))
  throw new Error("canonical replay validation is not deterministic");
console.log(
  `canonical migration replay valid: migrations=${migrations.length}, tables=${first.tables}, functions=${first.publicFunctions}, rls=${first.rlsTables}, policies=${first.policies}`,
);
