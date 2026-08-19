// CM-LAUNCH-1 canonical notifications proof against disposable PostgreSQL only.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { persistNotification } from "../../src/lib/notifications-persistence.ts";

const root = path.resolve(import.meta.dirname, "../..");
const url = process.env.CM_LAUNCH_1_SQL_TEST_DATABASE_URL;
const hasPgVars = Boolean(process.env.PGHOST && process.env.PGUSER);
if (!url && !hasPgVars) {
  console.log(
    JSON.stringify({
      status: "cm_launch_1_notifications_sql_test_skipped",
      reason: "no disposable PostgreSQL configured",
    }),
  );
  process.exit(0);
}
if (url && /supabase\.(co|com)/i.test(url))
  throw new Error("CM_LAUNCH_1_SQL_TEST_REFUSES_REMOTE_DATABASE");

const db = "cm_launch_1_notifications_test";
const base = url ? ["-d", url] : [];
try {
  execFileSync(
    "psql",
    [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `drop database if exists ${db}`],
    { stdio: "ignore" },
  );
} catch {}
execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `create database ${db}`], {
  stdio: "ignore",
});

const psql = (args, input) =>
  execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", ...args], {
    input,
    encoding: "utf8",
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
  });
const query = (sql) => psql(["-t", "-A", "-c", sql]).trim().split("\n").at(-1) ?? "";
const file = (relative) => psql(["-q", "-f", path.join(root, relative)]);
const prelude = readFileSync(
  path.join(root, "tests/fixtures/supabase-canonical-platform-prelude.sql"),
  "utf8",
).replace(
  /create\s+role\s+([a-z_]+)\s+nologin\s*;/gi,
  (_match, role) =>
    `do $$ begin if not exists (select 1 from pg_roles where rolname='${role}') then create role ${role} nologin; end if; end $$;`,
);
psql(["-q", "-f", "-"], prelude);
for (const migration of readdirSync(path.join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  file(`supabase/migrations/${migration}`);
}
file("supabase/pending-canonical/20260819220000_cm_launch_1_notifications_canonical.sql");

psql([
  "-q",
  "-c",
  `
  alter role service_role bypassrls;
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users(id) values
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222');
  insert into public.orders(id, order_number, buyer_id, status, payment_status, payment_method,
    subtotal_aed, shipping_aed, tax_aed, total_aed, shipping_address)
  values ('33333333-3333-3333-3333-333333333333', 'CM-NOTIFICATIONS-TEST',
    '11111111-1111-1111-1111-111111111111', 'pending', 'pending', 'cod', 6, 20, 0.3, 26.3, '{}');
`,
]);

const userA = "11111111-1111-1111-1111-111111111111";
const userB = "22222222-2222-2222-2222-222222222222";
const orderId = "33333333-3333-3333-3333-333333333333";
const sqlLiteral = (value) =>
  value === null || value === undefined
    ? "null"
    : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
const realDatabaseClient = {
  from(table) {
    if (table !== "notifications") throw new Error(`unexpected table: ${table}`);
    return {
      async insert(row) {
        try {
          query(`set role service_role; insert into public.notifications
            (user_id,kind,title,body,link,order_id,shipment_id,metadata)
            values (${sqlLiteral(row.user_id)},${sqlLiteral(row.kind)},${sqlLiteral(row.title)},
              ${sqlLiteral(row.body)},${sqlLiteral(row.link)},${sqlLiteral(row.order_id)},
              ${sqlLiteral(row.shipment_id)},${sqlLiteral(row.metadata)}::jsonb)`);
          return { error: null };
        } catch (error) {
          return { error: { message: error instanceof Error ? error.message : String(error) } };
        }
      },
    };
  },
};
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) failures.push(name);
};
const expectError = (sql) => {
  try {
    query(sql);
    return false;
  } catch {
    return true;
  }
};

console.log("CM-LAUNCH-1 canonical notifications SQL contract");
check("table exists", query("select to_regclass('public.notifications')") === "notifications");
check(
  "required columns and types are exact",
  query(`
  select string_agg(column_name||':'||data_type||':'||is_nullable, ',' order by ordinal_position)
  from information_schema.columns where table_schema='public' and table_name='notifications'
`) ===
    "id:uuid:NO,user_id:uuid:NO,kind:text:NO,title:text:NO,body:text:YES,link:text:YES,order_id:uuid:YES,shipment_id:uuid:YES,metadata:jsonb:YES,read_at:timestamp with time zone:YES,created_at:timestamp with time zone:NO",
);
check(
  "RLS is enabled",
  query("select relrowsecurity from pg_class where oid='public.notifications'::regclass") === "t",
);
check(
  "owner and order foreign keys exist",
  query(`
  select count(*) from pg_constraint where conrelid='public.notifications'::regclass and contype='f'
`) === "2",
);
check(
  "shipment_id has no missing-domain foreign key",
  query(`
  select count(*) from pg_constraint c join unnest(c.conkey) k(attnum) on true
  join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
  where c.conrelid='public.notifications'::regclass and c.contype='f' and a.attname='shipment_id'
`) === "0",
);
check(
  "query indexes exist",
  query(`
  select count(*) from pg_indexes where schemaname='public' and tablename='notifications'
    and indexname in ('notifications_user_created_idx','notifications_user_unread_idx')
`) === "2",
);

check("anon SELECT denied", expectError("set role anon; select * from public.notifications"));
check(
  "anon INSERT denied",
  expectError(
    `set role anon; insert into public.notifications(user_id,kind,title) values ('${userA}','order_placed','x')`,
  ),
);
check(
  "anon UPDATE denied",
  expectError("set role anon; update public.notifications set read_at=now()"),
);
check(
  "authenticated direct SELECT denied",
  expectError(
    `set role authenticated; set request.jwt.claim.sub='${userA}'; select * from public.notifications`,
  ),
);
check(
  "authenticated direct UPDATE denied",
  expectError(
    `set role authenticated; set request.jwt.claim.sub='${userA}'; update public.notifications set read_at=now()`,
  ),
);
check(
  "service role has only required table privileges",
  query(`
  select has_table_privilege('service_role','public.notifications','select')::text||'/'||
    has_table_privilege('service_role','public.notifications','insert')::text||'/'||
    has_table_privilege('service_role','public.notifications','update')::text||'/'||
    has_table_privilege('service_role','public.notifications','delete,truncate,references,trigger')::text
`) === "true/true/true/false",
);

query(`set role service_role; insert into public.notifications(user_id,kind,title,body,link,order_id,shipment_id,metadata) values
  ('${userA}','order_placed','A one','body','/account','${orderId}','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','{"source":"fixture"}'),
  ('${userA}','loyalty_earned','A two',null,'/account/loyalty','${orderId}',null,null),
  ('${userB}','payout_requested','B one',null,'/seller/payouts',null,null,null)`);
const helperResult = await persistNotification(realDatabaseClient, {
  userId: userA,
  kind: "order_shipped",
  title: "Helper persistence",
  body: "real schema",
  link: "/account/orders",
  orderId,
  shipmentId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  metadata: { source: "persistNotification" },
});
check("production persistence helper reports success", helperResult.ok);
check(
  "production persistence helper writes the disposable schema",
  query(`set role service_role; select body||'/'||link||'/'||(metadata->>'source')
    from public.notifications where title='Helper persistence'`) ===
    "real schema//account/orders/persistNotification",
);
const failedHelperResult = await persistNotification(
  { from: () => ({ insert: async () => ({ error: { message: "forced insert rejection" } }) }) },
  { userId: userA, kind: "order_placed", title: "Rejected" },
);
check(
  "production persistence helper exposes insert failure",
  !failedHelperResult.ok && failedHelperResult.error === "forced insert rejection",
);
check(
  "server insert persists all runtime fields",
  query(
    `set role service_role; select kind||'/'||title||'/'||body||'/'||link||'/'||order_id||'/'||shipment_id||'/'||(metadata->>'source') from public.notifications where title='A one'`,
  ) === `order_placed/A one/body//account/${orderId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/fixture`,
);
check(
  "server list A returns only A",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userA}'`,
  ) === "3",
);
check(
  "server list B returns only B",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userB}'`,
  ) === "1",
);
check(
  "A unread count starts at two",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userA}' and read_at is null`,
  ) === "3",
);
query(
  `set role service_role; update public.notifications set read_at=now() where title='A one' and user_id='${userA}'`,
);
check(
  "mark one changes exactly one A row",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userA}' and read_at is null`,
  ) === "2",
);
query(
  `set role service_role; update public.notifications set read_at=now() where user_id='${userA}' and read_at is null`,
);
check(
  "mark all clears A unread",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userA}' and read_at is null`,
  ) === "0",
);
check(
  "B remains unread",
  query(
    `set role service_role; select count(*) from public.notifications where user_id='${userB}' and read_at is null`,
  ) === "1",
);
check(
  "scoped mark cannot mutate B as A",
  query(
    `set role service_role; update public.notifications set read_at=now() where user_id='${userA}' and title='B one'; select count(*) from public.notifications where user_id='${userB}' and read_at is null`,
  ) === "1",
);

if (failures.length)
  throw new Error(`CM_LAUNCH_1_NOTIFICATIONS_SQL_FAILURES: ${failures.join(", ")}`);
console.log("CM-LAUNCH-1 canonical notifications SQL contract passed");
