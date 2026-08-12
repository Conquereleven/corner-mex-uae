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
const applyRoleIdempotentPrelude = (relative, targetDb = DB) => {
  const sql = readFileSync(path.join(root, relative), "utf8").replace(
    /create\s+role\s+([a-z_]+)\s+nologin\s*;/gi,
    (_match, role) =>
      `do $$ begin if not exists (select 1 from pg_roles where rolname = '${role}') then create role ${role} nologin; end if; end $$;`,
  );
  execFileSync("psql", ["-d", targetDb, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
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
// CM-COM-3A.1 forward hotfix: create-or-replace the function with the
// inventory-consistent implementation. Applied after the original so the proof
// runs against the corrected function exactly as production will.
file("supabase/pending-canonical/20260810120000_place_cod_order_v1_inventory_consistency.sql");

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
       values ('${VARIANT}','${PRODUCT}','CONTRACT-SKU','450 g', 25.50, 10, true, true) on conflict do nothing;
     insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved)
       values ('${VARIANT}', 10, 0) on conflict do nothing;`,
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
check(
  "inventory quantity_on_hand decremented with stock",
  query(`select quantity_on_hand from inventory where variant_id='${VARIANT}'`) === "8",
);
check(
  "stock mirrors quantity_on_hand after a sale",
  query(
    `select (v.stock = i.quantity_on_hand)::text from product_variants v join inventory i on i.variant_id = v.id where v.id='${VARIANT}'`,
  ) === "true",
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
const qohBeforeDuplicate = Number(
  query(`select quantity_on_hand from inventory where variant_id='${VARIANT}'`),
);
const movementsBeforeDuplicate = Number(
  query(`select count(*) from inventory_movements where variant_id='${VARIANT}'`),
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
check(
  "duplicate lines decrement quantity_on_hand once",
  Number(query(`select quantity_on_hand from inventory where variant_id='${VARIANT}'`)) ===
    qohBeforeDuplicate - 3,
);
check(
  "duplicate lines record exactly one additional sale movement",
  Number(query(`select count(*) from inventory_movements where variant_id='${VARIANT}'`)) ===
    movementsBeforeDuplicate + 1,
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
const qohBeforeRollback = query(
  `select quantity_on_hand from inventory where variant_id='${VARIANT}'`,
);
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
check(
  "quantity_on_hand is not decremented on failure",
  query(`select quantity_on_hand from inventory where variant_id='${VARIANT}'`) ===
    qohBeforeRollback,
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
    "select string_agg(i.quantity_on_hand::text, ',' order by v.sku) from inventory i join product_variants v on v.id=i.variant_id join products p on p.id=v.product_id where p.slug='loader-salsa'",
  ) === "1,0",
);
check(
  "exactly one default variant",
  query(
    "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa' and v.is_default",
  ) === "1",
);
check("images loaded", query("select count(*) from product_images") === "1");

check(
  "variant provenance maps generated SKU to exact source variant and literal SKU",
  query(
    "select p.attrs->'cm_com_3a'->'variants'->v.sku->>'source_variant_id'||'/'||coalesce(p.attrs->'cm_com_3a'->'variants'->v.sku->>'source_sku','NULL') from product_variants v join products p on p.id=v.product_id where v.sku like 'CM-LOADERSALSA-%9001'",
  ) === "9001/LOADER-REAL",
);
check(
  "missing source SKU remains JSON null in persisted provenance",
  query(
    "select jsonb_typeof(p.attrs->'cm_com_3a'->'variants'->v.sku->'source_sku') from product_variants v join products p on p.id=v.product_id where v.sku like 'CM-LOADERSALSA-%9002'",
  ) === "null",
);

// Simulate consumption after activation, and preserve unrelated A2 metadata.
const loaderSku = query("select sku from product_variants where sku like 'CM-LOADERSALSA-%9001'");
psql([
  "-q",
  "-c",
  `update product_variants set stock=0 where sku='${loaderSku}';
   update inventory set quantity_on_hand=0 where variant_id=(select id from product_variants where sku='${loaderSku}');
   update products set attrs = attrs || '{"unrelated":{"must_survive":true}}'::jsonb where slug='loader-salsa';
   insert into inventory_movements (variant_id, movement_type, quantity_delta, reason)
     select id, 'sale', -1, 'loader regression proof' from product_variants where sku='${loaderSku}';`,
]);
const movementsBeforeReload = query("select count(*) from inventory_movements");

// Re-applying the same plan converges instead of duplicating.
applySql(loadSql);
check(
  "re-applying the plan is idempotent",
  query(
    "select count(*) from product_variants v join products p on p.id=v.product_id where p.slug='loader-salsa'",
  ) === "2" && query("select count(*) from product_images") === "1",
);
check(
  "re-applying the plan never resurrects consumed variant stock",
  query(`select stock from product_variants where sku='${loaderSku}'`) === "0",
);
check(
  "re-applying the plan never resurrects quantity_on_hand",
  query(
    `select i.quantity_on_hand from inventory i join product_variants v on v.id=i.variant_id where v.sku='${loaderSku}'`,
  ) === "0",
);
check(
  "catalog reload creates no fake restock movement",
  query("select count(*) from inventory_movements") === movementsBeforeReload,
);
check(
  "catalog provenance merge preserves unrelated product attrs",
  query("select attrs->'unrelated'->>'must_survive' from products where slug='loader-salsa'") ===
    "true",
);

// A later source-price refresh is catalog metadata, not a restock instruction.
const refreshedManifest = structuredClone(loadManifest);
refreshedManifest.products[0].variants[0].source_effective_price_aed = 27.75;
refreshedManifest.products[0].variants[0].price_aed = 27.75;
const refreshed = validateActivationManifest(refreshedManifest);
check("price refresh manifest remains valid", refreshed.valid, JSON.stringify(refreshed.errors));
applySql(renderPlanSql(refreshed.plan));
check(
  "source price refresh updates catalog price",
  query(`select price_aed from product_variants where sku='${loaderSku}'`) === "27.75",
);
check(
  "source price refresh does not restock existing inventory",
  query(`select stock from product_variants where sku='${loaderSku}'`) === "0" &&
    query(
      `select i.quantity_on_hand from inventory i join product_variants v on v.id=i.variant_id where v.sku='${loaderSku}'`,
    ) === "0",
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

// 10. CM-COM-3A.1 inventory consistency. These would have caught the real
//     production defect: the committed COD order decremented
//     product_variants.stock and recorded a sale movement, but left
//     inventory.quantity_on_hand untouched.
console.log("CM-COM-3A.1 inventory consistency");

// Create an isolated product + variant (+ optional inventory row) and return the
// variant id. Data-modifying CTEs always execute; the inventory CTE is skipped
// entirely when qoh is null, to exercise the missing-row path.
const newVariant = ({ stock, qoh, reserved = 0, active = true, productActive = true }) =>
  query(
    `with p as (
       insert into public.products (slug, status)
       values ('cm31-' || gen_random_uuid(), '${productActive ? "active" : "draft"}')
       returning id
     ), v as (
       insert into public.product_variants (product_id, price_aed, stock, is_active, is_default)
       select id, 10.00, ${stock}, ${active}, true from p
       returning id
     )${
       qoh === null || qoh === undefined
         ? ""
         : `, i as (
       insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved)
       select id, ${qoh}, ${reserved} from v
       returning variant_id
     )`
     }
     select id from v`,
  );
const callVariant = (variantId, qty, shipping = 0, rate = 0) =>
  `select public.place_cod_order_v1('${BUYER}'::uuid, '[{"variant_id":"${variantId}","qty":${qty}}]'::jsonb, '{"emirate":"DU"}'::jsonb, ${shipping}, ${rate}, '{"accepted_at":"t"}'::jsonb)`;
const saleUnits = (variantId) =>
  query(
    `select coalesce(sum(quantity_delta),0)::text from inventory_movements where variant_id='${variantId}' and movement_type='sale'`,
  );
const movementRows = (variantId) =>
  query(`select count(*) from inventory_movements where variant_id='${variantId}'`);

// Mandatory production-defect assertion: stock 1, quantity_on_hand 1, one qty-1
// COD order must commit stock 0, quantity_on_hand 0, exactly one sale delta -1.
const vMand = newVariant({ stock: 1, qoh: 1, reserved: 0 });
const ordersBeforeMand = Number(query("select count(*) from orders"));
const mand = JSON.parse(query(callVariant(vMand, 1)));
check("defect: order created", /^CM-\d{8}-[0-9A-F]{8}$/.test(mand.order_number), mand.order_number);
check(
  "defect: orders incremented by one",
  Number(query("select count(*) from orders")) === ordersBeforeMand + 1,
);
check(
  "defect: one order_item for the order",
  query(`select count(*) from order_items where order_id='${mand.order_id}'`) === "1",
);
check(
  "defect: stock 1 -> 0",
  query(`select stock from product_variants where id='${vMand}'`) === "0",
);
check(
  "defect: quantity_on_hand 1 -> 0",
  query(`select quantity_on_hand from inventory where variant_id='${vMand}'`) === "0",
);
check("defect: exactly one sale movement row", movementRows(vMand) === "1");
check("defect: sale movement delta is -1", saleUnits(vMand) === "-1");
// H. after a successful order, stock and quantity_on_hand agree.
check(
  "H: stock == quantity_on_hand after the sale",
  query(
    `select (v.stock = i.quantity_on_hand)::text from product_variants v join inventory i on i.variant_id = v.id where v.id='${vMand}'`,
  ) === "true",
);

// A. inventory row missing -> whole transaction fails, nothing survives.
const vMissing = newVariant({ stock: 5, qoh: null });
const ordersBeforeMissing = query("select count(*) from orders");
check(
  "A: missing inventory row rejected",
  expectError(callVariant(vMissing, 1), "COD_ORDER_INVENTORY_NOT_FOUND") === null,
);
check("A: no order created", query("select count(*) from orders") === ordersBeforeMissing);
check(
  "A: no order_item created",
  query(`select count(*) from order_items where variant_id='${vMissing}'`) === "0",
);
check(
  "A: stock unchanged",
  query(`select stock from product_variants where id='${vMissing}'`) === "5",
);
check("A: no inventory movement", movementRows(vMissing) === "0");

// B. inventory insufficient (reservation consumes the on-hand quantity) ->
//    rollback. stock still mirrors on-hand so the drift guard passes and the
//    sufficiency guard fires.
const vInsuff = newVariant({ stock: 3, qoh: 3, reserved: 2 });
const ordersBeforeInsuff = query("select count(*) from orders");
check(
  "B: insufficient available inventory rejected",
  expectError(callVariant(vInsuff, 2), "COD_ORDER_INVENTORY_INSUFFICIENT") === null,
);
check("B: no order created", query("select count(*) from orders") === ordersBeforeInsuff);
check(
  "B: stock unchanged",
  query(`select stock from product_variants where id='${vInsuff}'`) === "3",
);
check(
  "B: quantity_on_hand unchanged",
  query(`select quantity_on_hand from inventory where variant_id='${vInsuff}'`) === "3",
);
check("B: no inventory movement", movementRows(vInsuff) === "0");

// C. a decrement that would push quantity_on_hand below quantity_reserved is
//    refused rather than violating the A2 quantity_reserved <= quantity_on_hand
//    check. Without the guard, qty 1 would drive on-hand 1 -> 0 with reserved 1.
const vReserved = newVariant({ stock: 1, qoh: 1, reserved: 1 });
check(
  "C: order that would violate the reserved constraint is rejected",
  expectError(callVariant(vReserved, 1), "COD_ORDER_INVENTORY_INSUFFICIENT") === null,
);
check(
  "C: quantity_on_hand unchanged (constraint never risked)",
  query(`select quantity_on_hand from inventory where variant_id='${vReserved}'`) === "1",
);
check(
  "C: reserved constraint still holds",
  query(
    `select (quantity_reserved <= quantity_on_hand)::text from inventory where variant_id='${vReserved}'`,
  ) === "true",
);
check(
  "C: stock unchanged",
  query(`select stock from product_variants where id='${vReserved}'`) === "1",
);
check("C: no inventory movement", movementRows(vReserved) === "0");

// D. product stock insufficient -> existing oversell protection still fires
//    ahead of any inventory mutation, even with a healthy inventory row.
const vStock = newVariant({ stock: 1, qoh: 1, reserved: 0 });
check(
  "D: oversell of product stock still rejected",
  expectError(callVariant(vStock, 2), "COD_ORDER_INSUFFICIENT_STOCK") === null,
);
check(
  "D: stock unchanged",
  query(`select stock from product_variants where id='${vStock}'`) === "1",
);
check(
  "D: quantity_on_hand unchanged",
  query(`select quantity_on_hand from inventory where variant_id='${vStock}'`) === "1",
);

// E. duplicate requested lines for one variant normalise to a single coherent
//    decrement of both stores and a single sale movement.
const vDup = newVariant({ stock: 10, qoh: 10, reserved: 0 });
const dup = JSON.parse(
  query(
    `select public.place_cod_order_v1('${BUYER}'::uuid, '[{"variant_id":"${vDup}","qty":1},{"variant_id":"${vDup}","qty":2}]'::jsonb, '{"emirate":"DU"}'::jsonb, 0, 0, '{"accepted_at":"t"}'::jsonb)`,
  ),
);
check("E: duplicate lines priced once", Number(dup.subtotal_aed) === 30, `got ${dup.subtotal_aed}`);
check(
  "E: stock decremented once by the summed qty",
  query(`select stock from product_variants where id='${vDup}'`) === "7",
);
check(
  "E: quantity_on_hand decremented once by the summed qty",
  query(`select quantity_on_hand from inventory where variant_id='${vDup}'`) === "7",
);
check("E: exactly one sale movement", movementRows(vDup) === "1");
check("E: sale movement carries the summed delta", saleUnits(vDup) === "-3");

// F. a failure after order insertion but before inventory completion must roll
//    the whole thing back. A NOT VALID check on inventory_movements fails the
//    movement insert, which happens after the order, item, stock and inventory
//    writes in the same transaction.
const vLate = newVariant({ stock: 4, qoh: 4, reserved: 0 });
psql([
  "-q",
  "-c",
  "alter table inventory_movements add constraint cod_inventory_probe check (reason <> 'cod_order') not valid",
]);
const ordersBeforeLate = query("select count(*) from orders");
const lateError = expectError(callVariant(vLate, 1), "cod_inventory_probe");
check("F: late failure aborts the call", lateError === null, lateError ?? "");
check("F: no order survives", query("select count(*) from orders") === ordersBeforeLate);
check(
  "F: no order_item survives",
  query(`select count(*) from order_items where variant_id='${vLate}'`) === "0",
);
check(
  "F: stock not decremented",
  query(`select stock from product_variants where id='${vLate}'`) === "4",
);
check(
  "F: quantity_on_hand not decremented",
  query(`select quantity_on_hand from inventory where variant_id='${vLate}'`) === "4",
);
check("F: no inventory movement survives", movementRows(vLate) === "0");
psql(["-q", "-c", "alter table inventory_movements drop constraint cod_inventory_probe"]);

// G. a successful multi-line order decrements stock and quantity_on_hand
//    consistently for every affected variant.
const vG1 = newVariant({ stock: 5, qoh: 5, reserved: 0 });
const vG2 = newVariant({ stock: 3, qoh: 3, reserved: 0 });
JSON.parse(
  query(
    `select public.place_cod_order_v1('${BUYER}'::uuid, '[{"variant_id":"${vG1}","qty":2},{"variant_id":"${vG2}","qty":1}]'::jsonb, '{"emirate":"DU"}'::jsonb, 0, 0, '{"accepted_at":"t"}'::jsonb)`,
  ),
);
check(
  "G: line 1 stock decremented",
  query(`select stock from product_variants where id='${vG1}'`) === "3",
);
check(
  "G: line 1 quantity_on_hand decremented",
  query(`select quantity_on_hand from inventory where variant_id='${vG1}'`) === "3",
);
check(
  "G: line 2 stock decremented",
  query(`select stock from product_variants where id='${vG2}'`) === "2",
);
check(
  "G: line 2 quantity_on_hand decremented",
  query(`select quantity_on_hand from inventory where variant_id='${vG2}'`) === "2",
);
check(
  "G: every affected variant keeps stock == quantity_on_hand",
  query(
    `select bool_and(v.stock = i.quantity_on_hand)::text from product_variants v join inventory i on i.variant_id = v.id where v.id in ('${vG1}','${vG2}')`,
  ) === "true",
);
check(
  "G: one sale movement per affected variant",
  movementRows(vG1) === "1" && movementRows(vG2) === "1",
);

// Bonus fail-closed guard: a pre-existing drift (stock and on-hand disagree) is
// refused rather than compounded inside a sale.
const vDrift = newVariant({ stock: 2, qoh: 1, reserved: 0 });
check(
  "drift between stock and quantity_on_hand is rejected fail-closed",
  expectError(callVariant(vDrift, 1), "COD_ORDER_INVENTORY_DRIFT") === null,
);
check(
  "drift order leaves quantity_on_hand untouched",
  query(`select quantity_on_hand from inventory where variant_id='${vDrift}'`) === "1",
);
check(
  "drift order leaves stock untouched",
  query(`select stock from product_variants where id='${vDrift}'`) === "2",
);
check("drift order creates no movement", movementRows(vDrift) === "0");

// 11. CM-COM-3A.1 reconciliation artifact. These execute the ACTUAL file from
//     disk (never a reimplementation) against a dedicated disposable database,
//     so the global stock/quantity_on_hand drift universe is fully controlled.
console.log("CM-COM-3A.1 reconciliation artifact (executed from disk)");

const RDB = "cod_reconcile_contract_test";
const ARTIFACT = "scripts/cm-com-3a/reconcile-inventory-consistency.sql";
const RECONCILE_ORDER_NUMBER = "CM-20260810-51E1AC74";
const RBUYER = "11111111-1111-1111-1111-111111111111";

try {
  execFileSync(
    "psql",
    [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `drop database if exists ${RDB}`],
    {
      stdio: "ignore",
    },
  );
} catch {
  /* first run */
}
execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", `create database ${RDB}`], {
  stdio: "ignore",
});
const rpsql = (args) =>
  execFileSync("psql", ["-d", RDB, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
// -q suppresses command tags (e.g. "INSERT 0 1") so INSERT ... RETURNING yields
// only the returned value.
const rquery = (sql) => rpsql(["-q", "-t", "-A", "-c", sql]).trim();

applyRoleIdempotentPrelude("tests/fixtures/supabase-canonical-platform-prelude.sql", RDB);
for (const name of readdirSync(path.join(root, "supabase/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  rpsql(["-q", "-f", path.join(root, `supabase/migrations/${name}`)]);
}

// Execute the real artifact file with merged output so both success NOTICEs and
// fail-closed abort messages are captured.
const runReconcile = () => {
  try {
    const out = execFileSync(
      "bash",
      ["-c", `psql -d "${RDB}" -v ON_ERROR_STOP=1 -f "${path.join(root, ARTIFACT)}" 2>&1`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { ok: true, out };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

const rReset = () =>
  rpsql([
    "-q",
    "-c",
    `truncate public.inventory_movements, public.order_items, public.orders, public.inventory, public.product_variants, public.products restart identity cascade;
     insert into auth.users (id) values ('${RBUYER}') on conflict do nothing;`,
  ]);

// Build the canonical incident fixture in RDB; opts inject specific defects.
const rBuildIncident = ({
  paymentMethod = "cod",
  paymentStatus = "pending",
  stock = 0,
  qoh = 1,
  reserved = 0,
  hasInventory = true,
  itemQtys = [1], // [] => zero items; [1,1] => two items
  saleDeltas = [-1], // number of sale movement rows and their deltas
} = {}) => {
  const productId = rquery(
    "insert into public.products (slug, status) values ('rec-' || gen_random_uuid(), 'active') returning id",
  );
  const variantId = rquery(
    `insert into public.product_variants (product_id, price_aed, stock, is_active, is_default) values ('${productId}', 10.00, ${stock}, true, true) returning id`,
  );
  if (hasInventory) {
    rpsql([
      "-q",
      "-c",
      `insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved) values ('${variantId}', ${qoh}, ${reserved})`,
    ]);
  }
  const orderId = rquery(
    `insert into public.orders (order_number, buyer_id, status, payment_status, payment_method, subtotal_aed, shipping_aed, tax_aed, total_aed, shipping_address) values ('${RECONCILE_ORDER_NUMBER}', '${RBUYER}', 'pending', '${paymentStatus}', '${paymentMethod}', 10, 0, 0, 10, '{"emirate":"DU"}'::jsonb) returning id`,
  );
  for (const q of itemQtys) {
    rpsql([
      "-q",
      "-c",
      `insert into public.order_items (order_id, product_id, variant_id, product_name, qty, unit_price_aed, line_total_aed) values ('${orderId}', '${productId}', '${variantId}', 'contract item', ${q}, 10.00, ${(10 * q).toFixed(2)})`,
    ]);
  }
  for (const d of saleDeltas) {
    rpsql([
      "-q",
      "-c",
      `insert into public.inventory_movements (variant_id, movement_type, quantity_delta, reference_type, reference_id, reason) values ('${variantId}', 'sale', ${d}, 'order', '${orderId}', 'cod_order')`,
    ]);
  }
  return { productId, variantId, orderId };
};

// An unrelated variant that also drifts (stock 0, on-hand 1) with its own sale.
const rExtraDrift = () => {
  const productId = rquery(
    "insert into public.products (slug, status) values ('rec-extra-' || gen_random_uuid(), 'active') returning id",
  );
  const variantId = rquery(
    `insert into public.product_variants (product_id, price_aed, stock, is_active, is_default) values ('${productId}', 10.00, 0, true, true) returning id`,
  );
  rpsql([
    "-q",
    "-c",
    `insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved) values ('${variantId}', 1, 0);
     insert into public.orders (order_number, buyer_id, status, payment_status, payment_method, subtotal_aed, shipping_aed, tax_aed, total_aed, shipping_address) values ('CM-20260810-UNRELATED', '${RBUYER}', 'pending', 'pending', 'cod', 10, 0, 0, 10, '{"emirate":"DU"}'::jsonb);`,
  ]);
  const otherOrderId = rquery(
    "select id from public.orders where order_number = 'CM-20260810-UNRELATED'",
  );
  rpsql([
    "-q",
    "-c",
    `insert into public.inventory_movements (variant_id, movement_type, quantity_delta, reference_type, reference_id, reason) values ('${variantId}', 'sale', -1, 'order', '${otherOrderId}', 'cod_order')`,
  ]);
  return { variantId };
};

const rQoh = (variantId) =>
  rquery(`select quantity_on_hand from inventory where variant_id='${variantId}'`);
const rStock = (variantId) => rquery(`select stock from product_variants where id='${variantId}'`);
const rSnapshot = () =>
  rquery(
    "select (select count(*) from orders)||'|'||(select count(*) from order_items)||'|'||(select count(*) from inventory_movements)||'|'||(select coalesce(payment_method,'')||'/'||coalesce(payment_status,'') from orders order by created_at limit 1)",
  );

// R1 — exact known incident is reconciled: quantity_on_hand 1 -> 0, nothing else.
rReset();
const r1 = rBuildIncident();
const r1Before = rSnapshot();
const r1Run = runReconcile();
check("R1: reconciliation succeeds on the exact incident", r1Run.ok, r1Run.out.slice(-200));
check("R1: reports RECONCILED", /CM_COM_3A1_RECONCILED/.test(r1Run.out), r1Run.out.slice(-200));
check("R1: quantity_on_hand 1 -> 0", rQoh(r1.variantId) === "0");
check("R1: stock remains 0", rStock(r1.variantId) === "0");
check("R1: orders/items/movements/payment unchanged", rSnapshot() === r1Before);
check(
  "R1: still exactly one sale movement of -1",
  rquery(
    `select count(*) from inventory_movements where variant_id='${r1.variantId}' and movement_type='sale' and quantity_delta=-1`,
  ) === "1",
);

// R2 — idempotent rerun: no-op, zero writes.
const r2Before = rSnapshot();
const r2Run = runReconcile();
check("R2: rerun succeeds", r2Run.ok, r2Run.out.slice(-200));
check(
  "R2: reports ALREADY_RECONCILED no-op",
  /CM_COM_3A1_ALREADY_RECONCILED/.test(r2Run.out),
  r2Run.out.slice(-200),
);
check("R2: quantity_on_hand stays 0", rQoh(r1.variantId) === "0");
check("R2: orders/items/movements/payment unchanged", rSnapshot() === r2Before);

// R3 — a second unrelated matching drift must abort fail-closed, repairing none.
rReset();
const r3 = rBuildIncident();
const r3Extra = rExtraDrift();
const r3Run = runReconcile();
check("R3: aborts on unrelated extra drift", !r3Run.ok, r3Run.out.slice(-200));
check("R3: abort cites global drift", /GLOBAL_DRIFT/.test(r3Run.out), r3Run.out.slice(-200));
check("R3: Founder target remains quantity_on_hand 1", rQoh(r3.variantId) === "1");
check("R3: unrelated variant remains quantity_on_hand 1", rQoh(r3Extra.variantId) === "1");

// R4 — wrong movement cardinality (two sale rows summing to -1) aborts.
rReset();
const r4 = rBuildIncident({ saleDeltas: [-2, 1] });
const r4Run = runReconcile();
check("R4: aborts on multiple sale movements", !r4Run.ok, r4Run.out.slice(-200));
check(
  "R4: abort cites movement cardinality",
  /MOVEMENT_CARDINALITY/.test(r4Run.out),
  r4Run.out.slice(-200),
);
check("R4: quantity_on_hand untouched", rQoh(r4.variantId) === "1");

// R5 — missing sale movement aborts, no write.
rReset();
const r5 = rBuildIncident({ saleDeltas: [] });
const r5Run = runReconcile();
check("R5: aborts on missing movement", !r5Run.ok, r5Run.out.slice(-200));
check(
  "R5: abort cites movement cardinality",
  /MOVEMENT_CARDINALITY/.test(r5Run.out),
  r5Run.out.slice(-200),
);
check("R5: quantity_on_hand untouched", rQoh(r5.variantId) === "1");

// R6 — wrong order-item cardinality (two items) aborts.
rReset();
const r6 = rBuildIncident({ itemQtys: [1, 1] });
const r6Run = runReconcile();
check("R6: aborts on wrong item cardinality", !r6Run.ok, r6Run.out.slice(-200));
check(
  "R6: abort cites item cardinality",
  /ITEM_CARDINALITY/.test(r6Run.out),
  r6Run.out.slice(-200),
);
check("R6: quantity_on_hand untouched", rQoh(r6.variantId) === "1");

// R6b — zero order items aborts too.
rReset();
const r6b = rBuildIncident({ itemQtys: [] });
const r6bRun = runReconcile();
check(
  "R6b: aborts on zero items",
  !r6bRun.ok && /ITEM_CARDINALITY/.test(r6bRun.out),
  r6bRun.out.slice(-200),
);
check("R6b: quantity_on_hand untouched", rQoh(r6b.variantId) === "1");

// R7 — wrong item qty (qty != 1) aborts.
rReset();
const r7 = rBuildIncident({ itemQtys: [2] });
const r7Run = runReconcile();
check("R7: aborts on wrong item qty", !r7Run.ok, r7Run.out.slice(-200));
check("R7: abort cites item qty", /ITEM_QTY/.test(r7Run.out), r7Run.out.slice(-200));
check("R7: quantity_on_hand untouched", rQoh(r7.variantId) === "1");

// R8 — unexpected stock (stock != 0) aborts.
rReset();
const r8 = rBuildIncident({ stock: 1, qoh: 1 });
const r8Run = runReconcile();
check("R8: aborts on unexpected stock", !r8Run.ok, r8Run.out.slice(-200));
check(
  "R8: abort cites unexpected stock",
  /UNEXPECTED_STOCK/.test(r8Run.out),
  r8Run.out.slice(-200),
);
check("R8: quantity_on_hand untouched", rQoh(r8.variantId) === "1");

// R9 — unexpected quantity_on_hand (neither 1 nor 0) aborts.
rReset();
const r9 = rBuildIncident({ qoh: 2 });
const r9Run = runReconcile();
check("R9: aborts on unexpected on-hand", !r9Run.ok, r9Run.out.slice(-200));
check(
  "R9: abort cites unexpected on-hand",
  /UNEXPECTED_QOH/.test(r9Run.out),
  r9Run.out.slice(-200),
);
check("R9: quantity_on_hand untouched", rQoh(r9.variantId) === "2");

// R10 — quantity_reserved != 0 aborts.
rReset();
const r10 = rBuildIncident({ qoh: 1, reserved: 1 });
const r10Run = runReconcile();
check("R10: aborts on non-zero reserved", !r10Run.ok, r10Run.out.slice(-200));
check(
  "R10: abort cites unexpected reserved",
  /UNEXPECTED_RESERVED/.test(r10Run.out),
  r10Run.out.slice(-200),
);
check("R10: quantity_on_hand untouched", rQoh(r10.variantId) === "1");

// R11 — the artifact enforces an affected-row-count invariant, proven by R1
//       (exactly one row updated) and R2 (zero writes), and statically present.
const artifactSource = readFileSync(path.join(root, ARTIFACT), "utf8").toLowerCase();
check(
  "R11: artifact reads the affected row count",
  /get\s+diagnostics\s+\w+\s*=\s*row_count/.test(artifactSource),
);
check(
  "R11: artifact requires exactly one updated row",
  /row_count.*<>\s*1|<>\s*1[\s\S]{0,40}row/.test(artifactSource) ||
    artifactSource.includes("expected exactly 1 updated row"),
);
check("R11: artifact aborts on a row-count mismatch", artifactSource.includes("abort_rowcount"));

// R12 — write boundaries after a successful reconciliation: only
//       inventory.quantity_on_hand (+ updated_at) may change.
rReset();
const r12 = rBuildIncident();
const r12OrdersBefore = rquery(
  "select md5(coalesce(string_agg(order_number||'|'||status||'|'||payment_method||'|'||payment_status||'|'||total_aed::text, ',' order by order_number),''))  from orders",
);
const r12ItemsBefore = rquery(
  "select md5(coalesce(string_agg(order_id::text||'|'||qty::text||'|'||unit_price_aed::text, ',' order by id),'')) from order_items",
);
const r12MovesBefore = rquery(
  "select md5(coalesce(string_agg(variant_id::text||'|'||movement_type||'|'||quantity_delta::text||'|'||coalesce(reason,''), ',' order by id),'')) from inventory_movements",
);
const r12StockBefore = rStock(r12.variantId);
const r12Run = runReconcile();
check("R12: reconciliation succeeds", r12Run.ok, r12Run.out.slice(-200));
check(
  "R12: orders unchanged",
  rquery(
    "select md5(coalesce(string_agg(order_number||'|'||status||'|'||payment_method||'|'||payment_status||'|'||total_aed::text, ',' order by order_number),'')) from orders",
  ) === r12OrdersBefore,
);
check(
  "R12: order_items unchanged",
  rquery(
    "select md5(coalesce(string_agg(order_id::text||'|'||qty::text||'|'||unit_price_aed::text, ',' order by id),'')) from order_items",
  ) === r12ItemsBefore,
);
check(
  "R12: inventory_movements unchanged",
  rquery(
    "select md5(coalesce(string_agg(variant_id::text||'|'||movement_type||'|'||quantity_delta::text||'|'||coalesce(reason,''), ',' order by id),'')) from inventory_movements",
  ) === r12MovesBefore,
);
check("R12: product_variants.stock unchanged", rStock(r12.variantId) === r12StockBefore);
check("R12: only quantity_on_hand changed (1 -> 0)", rQoh(r12.variantId) === "0");

console.log(
  JSON.stringify({
    status: failures.length ? "cod_sql_contract_failed" : "cod_sql_contract_valid",
    failures,
  }),
);
process.exit(failures.length ? 1 : 0);
