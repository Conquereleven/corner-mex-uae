// CM-COM-4A transactional lifecycle proof against disposable PostgreSQL only.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const url = process.env.CM_COM_4A_SQL_TEST_DATABASE_URL;
const hasPgVars = Boolean(process.env.PGHOST && process.env.PGUSER);
if (!url && !hasPgVars) {
  console.log(
    JSON.stringify({
      status: "cm_com_4a_sql_test_skipped",
      reason: "no disposable PostgreSQL configured",
    }),
  );
  process.exit(0);
}
if (url && /supabase\.(co|com)/i.test(url)) {
  throw new Error("CM_COM_4A_SQL_TEST_REFUSES_REMOTE_DATABASE");
}

const DB = "cm_com_4a_contract_test";
const base = url ? ["-d", url] : [];
try {
  execFileSync(
    "psql",
    [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `drop database if exists ${DB}`],
    { stdio: "ignore" },
  );
} catch {}
execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `create database ${DB}`], {
  stdio: "ignore",
});

const psql = (args, input) =>
  execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", ...args], {
    input,
    encoding: "utf8",
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
  });
const query = (sql) => psql(["-t", "-A", "-c", sql]).trim();
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
  .sort())
  file(`supabase/migrations/${migration}`);
file("supabase/pending-canonical/20260812180442_cm_com_4a_post_order_lifecycle.sql");

psql([
  "-q",
  "-c",
  `
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users(id) values
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222');
  insert into public.user_roles(user_id, role)
    values ('11111111-1111-1111-1111-111111111111', 'admin');
  insert into public.orders(id, order_number, buyer_id, status, payment_status, payment_method,
    subtotal_aed, shipping_aed, tax_aed, total_aed, shipping_address)
  values ('33333333-3333-3333-3333-333333333333', 'CM-COM-4A-TEST',
    '22222222-2222-2222-2222-222222222222', 'pending', 'pending', 'cod', 10, 0, 0.5, 10.5, '{}');
`,
]);

const ADMIN = "11111111-1111-1111-1111-111111111111";
const CUSTOMER = "22222222-2222-2222-2222-222222222222";
const ORDER = "33333333-3333-3333-3333-333333333333";
const call = (type, from, to, actor = ADMIN) =>
  `set request.jwt.claim.sub='${actor}'; select public.admin_transition_order_lifecycle_v1('${ORDER}','${type}','${from}','${to}')`;
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) failures.push(name);
};
const expectError = (sql, code) => {
  try {
    query(sql);
    return false;
  } catch (error) {
    return `${error.stderr ?? ""}`.includes(code);
  }
};

console.log("CM-COM-4A lifecycle SQL contract");
check(
  "unauthenticated caller cannot transition",
  expectError(
    `set request.jwt.claim.sub=''; select public.admin_transition_order_lifecycle_v1('${ORDER}','order_status','pending','confirmed')`,
    "CM_COM_4A_UNAUTHENTICATED",
  ),
);
check(
  "ordinary customer cannot transition",
  expectError(call("order_status", "pending", "confirmed", CUSTOMER), "CM_COM_4A_ADMIN_REQUIRED"),
);
check(
  "failed authorization leaves state unchanged",
  query(`select status from orders where id='${ORDER}'`) === "pending",
);
check(
  "failed authorization writes no audit",
  query("select count(*) from order_lifecycle_events") === "0",
);
check(
  "admin allowed order transition succeeds",
  query(call("order_status", "pending", "confirmed")).includes('"ok": true'),
);
check(
  "order state changed",
  query(`select status from orders where id='${ORDER}'`) === "confirmed",
);
check(
  "successful transition writes exactly one audit event",
  query("select count(*) from order_lifecycle_events") === "1",
);
check(
  "audit records exact order transition",
  query(
    "select transition_type||'/'||previous_value||'/'||new_value from order_lifecycle_events",
  ) === "order_status/pending/confirmed",
);
check(
  "payment transition is independently allowed",
  query(call("payment_status", "pending", "paid")).includes('"ok": true'),
);
check(
  "payment changed without changing order state",
  query(`select status||'/'||payment_status from orders where id='${ORDER}'`) === "confirmed/paid",
);
check(
  "invalid transition rejected",
  expectError(call("order_status", "confirmed", "delivered"), "CM_COM_4A_TRANSITION_NOT_ALLOWED"),
);
check(
  "invalid transition creates no extra audit",
  query("select count(*) from order_lifecycle_events") === "2",
);
check(
  "stale expected state fails closed",
  expectError(call("order_status", "pending", "confirmed"), "CM_COM_4A_STALE_STATE"),
);
psql(["-q", "-c", `update orders set status='delivered' where id='${ORDER}'`]);
check(
  "terminal delivered cannot revert",
  expectError(call("order_status", "delivered", "pending"), "CM_COM_4A_TRANSITION_NOT_ALLOWED"),
);
psql(["-q", "-c", `update orders set status='cancelled' where id='${ORDER}'`]);
check(
  "terminal cancelled cannot revert",
  expectError(call("order_status", "cancelled", "pending"), "CM_COM_4A_TRANSITION_NOT_ALLOWED"),
);
const acl = query(
  "select coalesce(array_to_string(proacl,','),'') from pg_proc where proname='admin_transition_order_lifecycle_v1'",
);
check("RPC has no anon or PUBLIC execution", !acl.includes("anon=") && !/(^|,)=X/.test(acl), acl);
check("RPC is authenticated-only", acl.includes("authenticated=X"), acl);
check(
  "RPC is security definer with pinned search path",
  query(
    "select prosecdef::text||'|'||array_to_string(proconfig,',') from pg_proc where proname='admin_transition_order_lifecycle_v1'",
  ) === "true|search_path=pg_catalog",
);

if (failures.length) throw new Error(`CM_COM_4A_SQL_FAILURES: ${failures.join(", ")}`);
console.log("CM-COM-4A lifecycle SQL contract passed");
