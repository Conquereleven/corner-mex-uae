// CornerMex 2.0 launch hardening — SQL contract for
//   * cm_create_cod_order_v2      (idempotent COD order creation)
//   * cm_release_order_stock_v1   (stock returned when an order is cancelled)
//
// Runs against a DISPOSABLE PostgreSQL only. It never connects to Supabase and
// refuses a remote URL. Requires PGHOST/PGUSER or CM2_SQL_TEST_DATABASE_URL.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const url = process.env.CM2_SQL_TEST_DATABASE_URL;
const hasPgVars = Boolean(process.env.PGHOST && process.env.PGUSER);
if (!url && !hasPgVars) {
  console.log(JSON.stringify({ status: "cm2_sql_test_skipped", reason: "no disposable PostgreSQL configured" }));
  process.exit(0);
}
if (url && /supabase\.(co|com)/i.test(url)) {
  console.error("CM2_SQL_TEST_REFUSES_REMOTE_DATABASE");
  process.exit(1);
}

const DB = "cm2_launch_hardening_test";
const base = url ? ["-d", url] : [];
try {
  execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `drop database if exists ${DB}`], { stdio: "ignore" });
} catch {
  /* first run */
}
execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `create database ${DB}`], { stdio: "ignore" });

const psql = (args) =>
  execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const query = (sql) => psql(["-t", "-A", "-c", sql]).trim();
const file = (relative) => psql(["-q", "-f", path.join(root, relative)]);

const failures = [];
const check = (name, condition, detail = "") => {
  if (condition) console.log(`  ok  ${name}`);
  else {
    console.log(`  FAIL ${name} ${detail}`);
    failures.push(name);
  }
};
const expectError = (sql, code) => {
  try {
    query(sql);
    return `no error raised (expected ${code})`;
  } catch (error) {
    const text = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    return text.includes(code) ? null : `expected ${code}, got: ${text.slice(0, 160)}`;
  }
};

// Roles are cluster-wide; make only role creation idempotent, as the CM-COM-3A
// harness does. Every other statement of the shared fixture runs verbatim.
const prelude = readFileSync(path.join(root, "tests/fixtures/supabase-canonical-platform-prelude.sql"), "utf8").replace(
  /create\s+role\s+([a-z_]+)\s+nologin\s*;/gi,
  (_m, role) => `do $$ begin if not exists (select 1 from pg_roles where rolname='${role}') then create role ${role} nologin; end if; end $$;`,
);
execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], { input: prelude, encoding: "utf8" });
for (const name of readdirSync(path.join(root, "supabase/migrations")).filter((n) => n.endsWith(".sql")).sort()) {
  file(`supabase/migrations/${name}`);
}

const BUYER = "11111111-1111-1111-1111-111111111111";
const ADMIN = BUYER;
const PRODUCT = "22222222-2222-2222-2222-222222222222";
const VARIANT = "33333333-3333-3333-3333-333333333333";
const OP1 = "aaaaaaaa-0000-4000-8000-000000000001";
const OP2 = "aaaaaaaa-0000-4000-8000-000000000002";
const OP3 = "aaaaaaaa-0000-4000-8000-000000000003";
const OP4 = "aaaaaaaa-0000-4000-8000-000000000004";

// The shared prelude stubs auth.uid() to NULL; the lifecycle function needs the
// caller identity, so resolve it from the session setting as the CM-COM-4A
// harness does.
query(`create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  insert into auth.users (id) values ('${BUYER}') on conflict do nothing;
  insert into public.user_roles (user_id, role) values ('${ADMIN}','admin') on conflict do nothing;
  insert into public.products (id, slug, status) values ('${PRODUCT}','cm2-product','active') on conflict do nothing;
  insert into public.product_translations (product_id, lang, name) values ('${PRODUCT}','en','CM2 Product') on conflict do nothing;
  insert into public.product_variants (id, product_id, sku, format_label, price_aed, stock, is_active, is_default)
    values ('${VARIANT}','${PRODUCT}','CM2-SKU','450 g', 10.00, 20, true, true) on conflict do nothing;
  insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved)
    values ('${VARIANT}', 20, 0) on conflict do nothing;`);

const LEGAL = `'{"terms":true,"privacy":true,"returns":true}'::jsonb`;
const items = (qty) => `'[{"variant_id":"${VARIANT}","qty":${qty}}]'::jsonb`;
const cod = (op, qty, shipping = 15, rate = 0.05, legal = LEGAL) =>
  `select public.cm_create_cod_order_v2('${BUYER}'::uuid, '${op}'::uuid, ${items(qty)}, '{"emirate":"DU"}'::jsonb, ${shipping}, ${rate}, ${legal})`;
const stock = () => query(`select stock from public.product_variants where id='${VARIANT}'`);
const onHand = () => query(`select quantity_on_hand from public.inventory where variant_id='${VARIANT}'`);
const orderCount = () => query("select count(*) from public.orders");
const drift = () =>
  query("select count(*) from public.product_variants v join public.inventory i on i.variant_id=v.id where v.stock <> i.quantity_on_hand");

console.log("CornerMex 2.0 launch hardening SQL contract");

// --- COD idempotency -------------------------------------------------------
const first = JSON.parse(query(cod(OP1, 2)));
check("first call creates an order", Boolean(first.order_id) && first.replayed === false);
check("stock decremented once", stock() === "18" && onHand() === "18");

const replay = JSON.parse(query(cod(OP1, 2)));
check("identical replay returns the same order", replay.order_id === first.order_id && replay.replayed === true);
check("replay creates no second order", orderCount() === "1");
check("replay does not decrement stock again", stock() === "18" && onHand() === "18");
check("replay echoes the original totals", Number(replay.total_aed) === Number(first.total_aed));

check(
  "same operation id with a changed cart is refused",
  expectError(cod(OP1, 3), "CHECKOUT_IDEMPOTENCY_CONFLICT") === null,
);
check("refused replay left stock untouched", stock() === "18" && orderCount() === "1");

const second = JSON.parse(query(cod(OP2, 1)));
check("a different operation id creates a new order", second.order_id !== first.order_id && orderCount() === "2");
check("second order decremented stock", stock() === "17" && onHand() === "17");

check(
  "a card operation id cannot be reused for COD",
  (() => {
    query(`insert into commerce_private.card_checkout_operations (buyer_id, operation_id, fingerprint)
           values ('${BUYER}','${OP3}','card-fingerprint')`);
    return expectError(cod(OP3, 1), "CHECKOUT_IDEMPOTENCY_CONFLICT") === null;
  })(),
);

check("missing legal acceptance is refused", expectError(cod(OP4, 1, 15, 0.05, `'{"terms":true}'::jsonb`), "LEGAL_ACCEPTANCE_REQUIRED") === null);
check("invalid quantity is refused", expectError(cod(OP4, 0), "COD_QTY_INVALID") === null);

const beforeFail = { stock: stock(), orders: orderCount() };
check("insufficient stock is refused", expectError(cod(OP4, 500), "COD_ORDER_INSUFFICIENT_STOCK") === null);
check("failed attempt wrote nothing", stock() === beforeFail.stock && orderCount() === beforeFail.orders);
check(
  "a failed attempt does not burn its operation id",
  query(`select count(*) from commerce_private.card_checkout_operations where operation_id='${OP4}'`) === "0",
);
const retry = JSON.parse(query(cod(OP4, 1)));
check("the same operation id succeeds after the failure", Boolean(retry.order_id) && retry.replayed === false);

// --- stock release on cancellation -----------------------------------------
const cancelTarget = first.order_id;
const stockBeforeCancel = Number(stock());
const transition = (order, from, to) =>
  `set request.jwt.claim.sub='${ADMIN}'; select public.admin_transition_order_lifecycle_v1('${order}','order_status','${from}','${to}')`;

query(transition(cancelTarget, "pending", "cancelled"));
check("cancelling returns the order's stock", Number(stock()) === stockBeforeCancel + 2);
check("cancelling returns inventory too", stock() === onHand());
check(
  "exactly one release ledger row is written",
  query(`select count(*) from public.inventory_movements where reference_id='${cancelTarget}' and movement_type='release'`) === "1",
);
check(
  "the release row records the reason and a positive delta",
  query(`select reason||':'||quantity_delta from public.inventory_movements where reference_id='${cancelTarget}' and movement_type='release'`) === "order_cancelled:2",
);
check("no stock drift after cancellation", drift() === "0");

check(
  "releasing an already released order is a no-op",
  JSON.parse(query(`select public.cm_release_order_stock_v1('${cancelTarget}'::uuid,'manual')`)).released === false,
);
check("the no-op added no stock", stock() === onHand() && drift() === "0");

check(
  "releasing an unknown order is refused",
  expectError(`select public.cm_release_order_stock_v1('99999999-9999-4999-8999-999999999999'::uuid,'manual')`, "STOCK_RELEASE_ORDER_NOT_FOUND") === null,
);
check(
  "an empty reason is refused",
  expectError(`select public.cm_release_order_stock_v1('${second.order_id}'::uuid,'  ')`, "STOCK_RELEASE_REASON_REQUIRED") === null,
);

// Fail closed: if the inventory row is gone, the whole cancellation rolls back.
query(`delete from public.inventory where variant_id='${VARIANT}'`);
const stockBeforeFailClosed = stock();
check(
  "a missing inventory row fails the cancellation closed",
  expectError(transition(second.order_id, "pending", "cancelled"), "STOCK_RELEASE_INVENTORY_NOT_FOUND") === null,
);
check("the failed cancellation changed nothing", stock() === stockBeforeFailClosed);
check(
  "the order is still pending after the failed cancellation",
  query(`select status from public.orders where id='${second.order_id}'`) === "pending",
);
query(`insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved) values ('${VARIANT}', ${stock()}, 0)`);

// --- concurrency -----------------------------------------------------------
// Two sessions submit the same operation id at once. The second must block on
// the operation row and then replay, never create a second order.
const CONCURRENT_OP = "aaaaaaaa-0000-4000-8000-00000000000c";
const ordersBefore = Number(orderCount());
const holder = spawn(
  "psql",
  ["-d", DB, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c",
   `begin; ${cod(CONCURRENT_OP, 1)}; select pg_sleep(2); commit;`],
  { stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve) => setTimeout(resolve, 600));
let concurrent;
try {
  concurrent = JSON.parse(query(cod(CONCURRENT_OP, 1)));
} catch (error) {
  concurrent = { error: `${error.stdout ?? ""}${error.stderr ?? ""}`.slice(0, 160) };
}
await new Promise((resolve) => holder.on("close", resolve));
check("a concurrent duplicate replays instead of creating a second order", concurrent.replayed === true, JSON.stringify(concurrent));
check("only one order exists for the concurrent operation", Number(orderCount()) === ordersBefore + 1);
check("concurrency left no stock drift", drift() === "0");

console.log(JSON.stringify({ status: failures.length ? "cm2_sql_contract_failed" : "cm2_sql_contract_valid", failures }));
process.exit(failures.length ? 1 : 0);
