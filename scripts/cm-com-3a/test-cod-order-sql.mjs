// CM-COM-3A — transactional COD order proof against a disposable PostgreSQL.
//
// Applies the canonical A2 chain plus the pending COD function to a throwaway
// database and proves the correctness contract. It never connects to a
// production database: it requires PG* / COD_SQL_TEST_DATABASE_URL pointing at a
// disposable instance, and refuses to run against a Supabase host.
//
// Skips (exit 0) when no disposable PostgreSQL is configured, so the unit suite
// stays runnable on machines without a database.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

const url = process.env.COD_SQL_TEST_DATABASE_URL;
const hasPgVars = Boolean(process.env.PGHOST && process.env.PGUSER);
if (!url && !hasPgVars) {
  console.log(
    JSON.stringify({
      status: "cod_sql_test_skipped",
      reason: "no disposable PostgreSQL configured",
    }),
  );
  process.exit(0);
}
if (url && /supabase\.(co|com)/i.test(url)) {
  console.error("COD_SQL_TEST_REFUSES_REMOTE_DATABASE");
  process.exit(1);
}

const DB = "cod_order_contract_test";
const base = url ? ["-d", url] : [];
// Fresh database per run so constraint experiments start from empty tables.
try {
  execFileSync(
    "psql",
    [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `drop database if exists ${DB}`],
    {
      stdio: "ignore",
    },
  );
} catch {
  /* first run */
}
execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `create database ${DB}`], {
  stdio: "ignore",
});

const psql = (args) =>
  execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const query = (sql) => psql(["-t", "-A", "-c", sql]).trim();
const file = (relative) => psql(["-q", "-f", path.join(root, relative)]);

// PostgreSQL roles are cluster-wide, not per-database. In CI the canonical
// replay step has already created anon/authenticated/service_role in the same
// cluster, so replaying the shared prelude verbatim aborts with
// "role ... already exists". The shared fixture is correct for a fresh cluster
// and is NOT modified; instead this harness applies a role-idempotent copy of
// it via stdin. Only role creation is made conditional — every other statement,
// and ON_ERROR_STOP, is left untouched.
const applyRoleIdempotentPrelude = (relative) => {
  const sql = readFileSync(path.join(root, relative), "utf8").replace(
    /create\s+role\s+([a-z_]+)\s+nologin\s*;/gi,
    (_match, role) =>
      `do $$ begin if not exists (select 1 from pg_roles where rolname = '${role}') then create role ${role} nologin; end if; end $$;`,
  );
  execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
};

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

// --- schema ---------------------------------------------------------------
applyRoleIdempotentPrelude("tests/fixtures/supabase-canonical-platform-prelude.sql");
for (const name of readdirSync(path.join(root, "supabase/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  file(`supabase/migrations/${name}`);
}
file("supabase/pending-canonical/20260809010000_place_cod_order_v1.sql");

const BUYER = "11111111-1111-1111-1111-111111111111";
const PRODUCT = "22222222-2222-2222-2222-222222222222";
const VARIANT = "33333333-3333-3333-3333-333333333333";
const call = (items, shipping, rate) =>
  `select public.place_cod_order_v1('${BUYER}'::uuid, '${items}'::jsonb, '{"emirate":"DU"}'::jsonb, ${shipping}, ${rate}, '{"accepted_at":"t"}'::jsonb)`;

const seed = () =>
  psql([
    "-q",
    "-c",
    `insert into auth.users (id) values ('${BUYER}') on conflict do nothing;
     insert into public.products (id, slug, status) values ('${PRODUCT}','contract-product','active') on conflict do nothing;
     insert into public.product_translations (product_id, lang, name) values ('${PRODUCT}','en','Contract Product') on conflict do nothing;
     insert into public.product_variants (id, product_id, sku, format_label, price_aed, stock, is_active, is_default)
       values ('${VARIANT}','${PRODUCT}','CONTRACT-SKU','450 g', 25.50, 10, true, true) on conflict do nothing;`,
  ]);
seed();

console.log("CM-COM-3A COD transactional contract");

// 1. Server-side pricing and totals.
const happy = JSON.parse(query(call(`[{"variant_id":"${VARIANT}","qty":2}]`, 20, 0)));
check(
  "server computes subtotal from database price",
  happy.subtotal_aed === 51,
  `got ${happy.subtotal_aed}`,
);
check("shipping is the server-supplied amount", Number(happy.shipping_aed) === 20);
check("total = subtotal + shipping + tax", Number(happy.total_aed) === 71);
check(
  "order_number is generated",
  /^CM-\d{8}-[0-9A-F]{8}$/.test(happy.order_number),
  happy.order_number,
);
check(
  "stock decremented",
  query(`select stock from product_variants where id='${VARIANT}'`) === "8",
);
check("order item inserted", query("select count(*) from order_items") === "1");
check(
  "inventory movement recorded",
  query("select count(*) from inventory_movements where movement_type='sale'") === "1",
);
check(
  "payment recorded as pending COD",
  query("select payment_method||'/'||payment_status from orders limit 1") === "cod/pending",
);

// 2. Tax is server-authoritative.
const taxed = JSON.parse(query(call(`[{"variant_id":"${VARIANT}","qty":1}]`, 15, 0.05)));
check("tax computed from the server rate", Number(taxed.tax_aed) === 1.28, `got ${taxed.tax_aed}`);
check("zero-rate order carries zero tax", Number(happy.tax_aed) === 0);

// 3. Overselling is impossible and leaves no partial state.
const ordersBefore = query("select count(*) from orders");
const stockBefore = query(`select stock from product_variants where id='${VARIANT}'`);
check(
  "oversell rejected",
  expectError(
    call(`[{"variant_id":"${VARIANT}","qty":9999}]`, 20, 0),
    "COD_ORDER_INSUFFICIENT_STOCK",
  ) === null,
);
check("no order created on oversell", query("select count(*) from orders") === ordersBefore);
check(
  "stock unchanged on oversell",
  query(`select stock from product_variants where id='${VARIANT}'`) === stockBefore,
);

// 4. Status gates.
psql(["-q", "-c", `update product_variants set is_active=false where id='${VARIANT}'`]);
check(
  "inactive variant rejected",
  expectError(
    call(`[{"variant_id":"${VARIANT}","qty":1}]`, 0, 0),
    "COD_ORDER_VARIANT_NOT_ACTIVE",
  ) === null,
);
psql(["-q", "-c", `update product_variants set is_active=true where id='${VARIANT}'`]);
psql(["-q", "-c", `update products set status='draft' where id='${PRODUCT}'`]);
check(
  "non-active product rejected",
  expectError(
    call(`[{"variant_id":"${VARIANT}","qty":1}]`, 0, 0),
    "COD_ORDER_PRODUCT_NOT_ACTIVE",
  ) === null,
);
psql(["-q", "-c", `update products set status='active' where id='${PRODUCT}'`]);
check(
  "unknown variant rejected",
  expectError(
    call('[{"variant_id":"44444444-4444-4444-4444-444444444444","qty":1}]', 0, 0),
    "COD_ORDER_VARIANT_NOT_FOUND",
  ) === null,
);
check(
  "zero quantity rejected",
  expectError(call(`[{"variant_id":"${VARIANT}","qty":0}]`, 0, 0), "COD_ORDER_QTY_INVALID") ===
    null,
);
check("empty basket rejected", expectError(call("[]", 0, 0), "COD_ORDER_ITEMS_REQUIRED") === null);
check(
  "out-of-range tax rate rejected",
  expectError(call(`[{"variant_id":"${VARIANT}","qty":1}]`, 0, 2), "COD_ORDER_TAX_RATE_INVALID") ===
    null,
);
check(
  "negative shipping rejected",
  expectError(
    call(`[{"variant_id":"${VARIANT}","qty":1}]`, -5, 0),
    "COD_ORDER_SHIPPING_INVALID",
  ) === null,
);

// 5. Duplicate lines collapse so a variant is decremented once.
const stockBeforeDuplicate = Number(
  query(`select stock from product_variants where id='${VARIANT}'`),
);
const duplicate = JSON.parse(
  query(call(`[{"variant_id":"${VARIANT}","qty":1},{"variant_id":"${VARIANT}","qty":2}]`, 0, 0)),
);
check(
  "duplicate lines collapse into one quantity",
  Number(duplicate.subtotal_aed) === 76.5,
  `got ${duplicate.subtotal_aed}`,
);
check(
  "duplicate lines decrement stock once",
  Number(query(`select stock from product_variants where id='${VARIANT}'`)) ===
    stockBeforeDuplicate - 3,
);

// 6. Rollback: a failure while writing order items must undo everything.
psql([
  "-q",
  "-c",
  // NOT VALID: existing rows are exempt, new inserts are still checked, which is
  // exactly what is needed to force a mid-transaction failure.
  "alter table order_items add constraint cod_rollback_probe check (qty < 0) not valid",
]);
const ordersBeforeRollback = query("select count(*) from orders");
const stockBeforeRollback = query(`select stock from product_variants where id='${VARIANT}'`);
const rollbackError = expectError(
  call(`[{"variant_id":"${VARIANT}","qty":1}]`, 0, 0),
  "cod_rollback_probe",
);
check("order-item failure aborts the call", rollbackError === null, rollbackError ?? "");
check(
  "no order row survives the failure",
  query("select count(*) from orders") === ordersBeforeRollback,
);
check(
  "stock is not decremented on failure",
  query(`select stock from product_variants where id='${VARIANT}'`) === stockBeforeRollback,
);
psql(["-q", "-c", "alter table order_items drop constraint cod_rollback_probe"]);

// 7. Execution is service-role only.
const acl = query(
  "select coalesce(array_to_string(proacl,','),'') from pg_proc where proname='place_cod_order_v1'",
);
check("anon cannot execute", !acl.includes("anon="), acl);
check("authenticated cannot execute", !acl.includes("authenticated="), acl);
check("service_role can execute", acl.includes("service_role="), acl);
check("no PUBLIC execute grant", !/(^|,)=X/.test(acl), acl);
check(
  "function is security definer with pinned search_path",
  query(
    "select prosecdef::text||'|'||array_to_string(proconfig,',') from pg_proc where proname='place_cod_order_v1'",
  ) === "true|search_path=public, pg_temp",
);

// 8. The function must not depend on schema production does not have.
const body = query("select prosrc from pg_proc where proname='place_cod_order_v1'");
for (const forbidden of [
  "seller",
  "commission",
  "shipping_zone",
  "shipping_rate",
  "coupon",
  "discount_aed",
]) {
  check(`no ${forbidden} dependency`, !body.includes(forbidden));
}

// 9. The catalog load mechanism applies to the real A2 schema, transactionally
//    and idempotently. This proves the generated artifact is executable rather
//    than merely well-formed.
const { renderPlanSql } = await import("./load-activation-plan.mjs");
const { validateActivationManifest } = await import("./validate-activation-manifest.mjs");
const { normalizeCatalog, toActivationManifest } = await import("./ingest-intermex-catalog.mjs");

const loadManifest = toActivationManifest(
  normalizeCatalog(
    [
      {
        id: 900,
        handle: "loader-salsa",
        title: "Loader Salsa",
        vendor: "Loader Vendor",
        product_type: "Salsas",
        body_html: "<p>loader</p>",
        images: [{ src: "https://cdn.example.test/loader-a.jpg" }],
        variants: [
          {
            id: 9001,
            sku: "LOADER-REAL",
            title: "450 g",
            price: "25.50",
            compare_at_price: "30.00",
            available: true,
            grams: 450,
          },
          {
            id: 9002,
            sku: null,
            title: "900 g",
            price: "40.00",
            compare_at_price: null,
            available: false,
            grams: 900,
          },
        ],
      },
    ],
    "2026-08-09T00:00:00.000Z",
  ),
);
const loadResult = validateActivationManifest(loadManifest);
check(
  "generated manifest is valid for loading",
  loadResult.valid,
  JSON.stringify(loadResult.errors),
);
const loadSql = renderPlanSql(loadResult.plan);

const applySql = (sql) =>
  execFileSync("psql", ["-d", DB, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

applySql(loadSql);
check("category loaded", query("select name_en from categories where slug='salsas'") === "Salsas");
check(
  "product loaded active and linked to its category",
  query(
    "select p.status from products p join categories c on c.id=p.category_id where p.slug='loader-salsa' and c.slug='salsas'",
  ) === "active",
);
check(
  "english translation loaded",
  query(
    "select name from product_translations t join products p on p.id=t.product_id where p.slug='loader-salsa' and t.lang='en'",
  ) === "Loader Salsa",
);
check(
  "both variants loaded under one product",
  query(
    "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa'",
  ) === "2",
);
check(
  "CornerMex price mirrors the source effective price",
  query("select price_aed from product_variants where sku like 'CM-LOADERSALSA-%9001'") === "25.50",
);
check(
  "Founder stock policy applied by the loader",
  query(
    "select string_agg(stock::text, ',' order by sku) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa'",
  ) === "1,0",
);
check(
  "inventory rows match variant stock",
  query(
    "select string_agg(i.quantity_on_hand::text, ',' order by v.sku) from inventory i join product_variants v on v.id=i.variant_id",
  ) === "1,0",
);
check(
  "exactly one default variant",
  query(
    "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa' and v.is_default",
  ) === "1",
);
check("images loaded", query("select count(*) from product_images") === "1");

// Re-applying the same plan converges instead of duplicating.
applySql(loadSql);
check(
  "re-applying the plan is idempotent",
  query(
    "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa'",
  ) === "2" && query("select count(*) from product_images") === "1",
);

// A failing statement must abort the whole load: no partial activation.
const partialProbe = expectError(
  `${loadSql.replace("commit;", "insert into public.product_variants (product_id, sku, price_aed) values (null, 'BAD-SKU', 1); commit;")}`,
  // Match the column, not the message text, which is locale-dependent.
  "product_id",
);
check("a failing statement aborts the whole load", partialProbe === null, partialProbe ?? "");
check(
  "no row from the aborted load survives",
  query("select count(*) from product_variants where sku='BAD-SKU'") === "0",
);

console.log(
  JSON.stringify({
    status: failures.length ? "cod_sql_contract_failed" : "cod_sql_contract_valid",
    failures,
  }),
);
process.exit(failures.length ? 1 : 0);
