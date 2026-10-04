// CornerMex MX — SQL contract test for the Mexico market foundation.
//
// Builds a Mexico database the way docs/cornermex-mx/DATABASE-BOOTSTRAP.md
// describes — platform prelude, every canonical migration, then every Mexico
// migration — in a DISPOSABLE local PostgreSQL database, and proves the launch
// gate, procurement, payment and label rules against it.
//
// It refuses a remote URL. Requires PGHOST/PGUSER or MX_SQL_TEST_DATABASE_URL;
// without either it reports itself skipped.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const url = process.env.MX_SQL_TEST_DATABASE_URL;
if (!url && !(process.env.PGHOST && process.env.PGUSER)) {
  console.log(
    JSON.stringify({
      status: "mx_sql_test_skipped",
      reason: "no disposable PostgreSQL configured",
    }),
  );
  process.exit(0);
}
if (url && /supabase\.(co|com)/i.test(url)) {
  console.error("MX_SQL_TEST_REFUSES_REMOTE_DATABASE");
  process.exit(1);
}

const base = url ? ["-d", url] : [];
const admin = (sql) =>
  execFileSync("psql", [...base, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], { stdio: "ignore" });

function database(name) {
  try {
    admin(`drop database if exists ${name}`);
  } catch {
    /* first run */
  }
  admin(`create database ${name}`);
  const psql = (args, input) =>
    execFileSync("psql", ["-d", name, "-v", "ON_ERROR_STOP=1", ...args], {
      encoding: "utf8",
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      ...(input === undefined ? {} : { input }),
    });
  return {
    query: (sql) => psql(["-t", "-A", "-c", sql]).trim(),
    // One transaction per file, as the Supabase CLI applies a migration.
    file: (relative) => psql(["-q", "--single-transaction", "-f", path.join(root, relative)]),
    script: (sql) => psql(["-q", "-f", "-"], sql),
    drop: () => admin(`drop database if exists ${name}`),
  };
}

const prelude = readFileSync(
  path.join(root, "tests/fixtures/supabase-canonical-platform-prelude.sql"),
  "utf8",
).replace(
  /create\s+role\s+([a-z_]+)\s+nologin\s*;/gi,
  (_m, role) =>
    `do $$ begin if not exists (select 1 from pg_roles where rolname='${role}') then create role ${role} nologin; end if; end $$;`,
);
const canonical = readdirSync(path.join(root, "supabase/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort();
const mexico = readdirSync(path.join(root, "supabase/mx/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort();

function bootstrapCanonical(db) {
  db.script(prelude);
  for (const name of canonical) db.file(`supabase/migrations/${name}`);
}

const failures = [];
const check = (name, condition, detail = "") => {
  if (condition) console.log(`  ok  ${name}`);
  else {
    console.log(`  FAIL ${name} ${detail}`);
    failures.push(name);
  }
};

const db = database("cm_mx_foundation_test");
const expectError = (name, sql, code) => {
  try {
    db.query(sql);
    check(name, false, `no error raised (expected ${code})`);
  } catch (error) {
    const text = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    check(name, text.includes(code), `expected ${code}, got: ${text.slice(0, 200)}`);
  }
};

// ── Bootstrap ────────────────────────────────────────────────────────────────
bootstrapCanonical(db);
for (const name of mexico) db.file(`supabase/mx/migrations/${name}`);
console.log(`bootstrap: ${canonical.length} canonical + ${mexico.length} Mexico migrations`);

check(
  "the database identifies itself as Mexico / MXN",
  db.query("select public.cm_market_identity_v1()::text") === '{"market": "MX", "currency": "MXN"}',
);
expectError(
  "the market identity cannot be changed to another market",
  "update commerce_private.market_identity set market = 'AE', currency = 'AED'",
  'violates check constraint "market_identity_',
);

// A database that already holds a catalogue (the UAE one does) is refused.
const dirty = database("cm_mx_foundation_dirty_test");
bootstrapCanonical(dirty);
dirty.query(`insert into public.products (id, slug, status) values ('99999999-9999-4999-8999-999999999999','uae-product','active');
  insert into public.product_variants (product_id, sku, price_aed, stock, is_active, is_default)
  values ('99999999-9999-4999-8999-999999999999','UAE-SKU', 20, 5, true, true);`);
try {
  dirty.file(`supabase/mx/migrations/${mexico[0]}`);
  check(
    "the Mexico migration refuses a database that already has a catalogue",
    false,
    "it applied",
  );
} catch (error) {
  check(
    "the Mexico migration refuses a database that already has a catalogue",
    `${error.stderr ?? ""}`.includes("MX_BOOTSTRAP_REFUSES_EXISTING_CATALOGUE"),
  );
}
check(
  "a refused bootstrap leaves no Mexico object behind",
  dirty.query("select count(*) from pg_proc where proname = 'cm_market_identity_v1'") === "0",
);
dirty.drop();

// ── Fixture: one product, two variants, starting inactive ────────────────────
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const V1 = "33333333-3333-4333-8333-333333333331";
const V2 = "33333333-3333-4333-8333-333333333332";
db.query(`
  insert into public.products (id, slug, status) values ('${PRODUCT}','salsa-valentina','inactive');
  insert into public.product_variants (id, product_id, sku, format_label, price_aed, weight_grams, stock, is_active, is_default)
  values ('${V1}','${PRODUCT}','MX-VAL-370','370 ml', 32.50, 420, 20, false, true),
         ('${V2}','${PRODUCT}','MX-VAL-1L','1 L', 68.00, null, 0, false, false);
  insert into public.inventory (variant_id, quantity_on_hand, quantity_reserved) values ('${V1}', 20, 0);
`);

// ── Launch assortment ────────────────────────────────────────────────────────
expectError(
  "a variant cannot be switched on behind the launch gate",
  `update public.product_variants set is_active = true where id = '${V1}'`,
  "MX_VARIANT_NOT_LAUNCH_ACTIVE",
);
check(
  "a variant with no commercial data reports every gap",
  db.query(`select array_to_string(commerce_private.variant_launch_gaps('${V2}'), ',')`) ===
    "weight,dimensions,b2b_price,inventory_record,case_pack,minimum_order_quantity,preferred_supplier",
  db.query(`select array_to_string(commerce_private.variant_launch_gaps('${V2}'), ',')`),
);
expectError(
  "an incomplete variant cannot become READY",
  `select public.cm_mx_set_launch_status_v1('${V1}', 'READY')`,
  "MX_LAUNCH_NOT_READY: dimensions,b2b_price,case_pack,minimum_order_quantity,preferred_supplier",
);
expectError(
  "an incomplete variant cannot become ACTIVE",
  `select public.cm_mx_set_launch_status_v1('${V2}', 'ACTIVE')`,
  "MX_LAUNCH_NOT_READY",
);
db.query(`select public.cm_mx_set_launch_status_v1('${V1}', 'SOURCING')`);
check(
  "DRAFT and SOURCING need no data and keep the variant unsellable",
  db.query(`select launch_status || ':' || (select is_active from public.product_variants where id='${V1}')
    from commerce_private.variant_launch_profiles where variant_id='${V1}'`) === "SOURCING:false",
);

// ── Procurement ──────────────────────────────────────────────────────────────
db.query(`
  insert into commerce_private.suppliers (id, name, location) values
    ('aaaaaaaa-0000-4000-8000-00000000000a','Abarrotes Central A','Central de Abastos de Tecámac'),
    ('aaaaaaaa-0000-4000-8000-00000000000b','Distribuidora B','Ecatepec');
  insert into commerce_private.variant_suppliers
    (variant_id, supplier_id, supplier_sku, supplier_cost, last_purchase_cost, lead_time_days, minimum_purchase_quantity, case_pack, is_preferred)
  values ('${V1}','aaaaaaaa-0000-4000-8000-00000000000a','A-VAL370', 21.00, 20.50, 1, 12, 12, true),
         ('${V1}','aaaaaaaa-0000-4000-8000-00000000000b','B-0042', 22.40, null, 3, 24, 24, false);
`);
check(
  "one SKU has several suppliers and exactly one preferred",
  db.query(
    `select count(*) || ':' || count(*) filter (where is_preferred) from commerce_private.variant_suppliers where variant_id='${V1}'`,
  ) === "2:1",
);
expectError(
  "a second preferred supplier for the same SKU is refused",
  `update commerce_private.variant_suppliers set is_preferred = true where supplier_sku = 'B-0042'`,
  "variant_suppliers_one_preferred_idx",
);
expectError(
  "a supplier cost in AED is refused",
  `insert into commerce_private.variant_suppliers (variant_id, supplier_id, supplier_cost, currency)
   values ('${V2}','aaaaaaaa-0000-4000-8000-00000000000a', 9, 'AED')`,
  "variant_suppliers_currency_check",
);
expectError(
  "a B2B customer account in AED is refused",
  `insert into commerce_private.b2b_customer_accounts (legal_name, currency_code) values ('Taquería Demo', 'AED')`,
  "b2b_customer_accounts_currency_code_check",
);
check(
  "a B2B customer account defaults to MXN",
  db
    .query(
      `insert into commerce_private.b2b_customer_accounts (legal_name) values ('Taquería Demo') returning currency_code`,
    )
    .startsWith("MXN"),
);

db.query(`
  update commerce_private.variant_launch_profiles set b2b_price = 27.00, length_cm = 6, width_cm = 6, height_cm = 19 where variant_id='${V1}';
  insert into commerce_private.inventory_policies (variant_id, lead_time_days, minimum_order_quantity, case_pack, reorder_point)
  values ('${V1}', 1, 1, 12, 24);
`);
check(
  "a complete variant has no gaps",
  db.query(`select coalesce(array_length(commerce_private.variant_launch_gaps('${V1}'), 1), 0)`) ===
    "0",
);
db.query(`select public.cm_mx_set_launch_status_v1('${V1}', 'READY')`);
check(
  "READY is not yet sellable",
  db.query(`select is_active from public.product_variants where id='${V1}'`) === "f",
);
db.query(`select public.cm_mx_set_launch_status_v1('${V1}', 'ACTIVE')`);
check(
  "ACTIVE makes the variant sellable and lists its product",
  db.query(
    `select v.is_active || ':' || p.status from public.product_variants v join public.products p on p.id=v.product_id where v.id='${V1}'`,
  ) === "true:active",
);
check(
  "the replenishment view reports stock, policy and the preferred supplier",
  db.query(`select launch_status||'|'||on_hand||'|'||available||'|'||reorder_point||'|'||preferred_supplier||'|'||supplier_cost||'|'||last_purchase_cost||'|'||lead_time_days||'|'||case_pack
    from public.cm_mx_launch_assortment_v1() where variant_id='${V1}'`) ===
    "ACTIVE|20|20|24|Abarrotes Central A|21.00|20.50|1|12",
);

// ── Orders ───────────────────────────────────────────────────────────────────
const LEGAL = `'{"terms":true,"privacy":true,"returns":true}'::jsonb`;
const ADDRESS = `'{"address_model":"mx-1","country":"MX","postal_code":"55764","state":"MEX"}'::jsonb`;
const order = (op, variant, qty, method, email = "cliente@example.invalid") =>
  `select public.cm_mx_create_order_v1(null, '${email}', '${op}'::uuid,
     '[{"variant_id":"${variant}","qty":${qty}}]'::jsonb, ${ADDRESS}, 149.00, 0, ${LEGAL}, '${method}')`;
const OP1 = "cccccccc-0000-4000-8000-000000000001";
const OP2 = "cccccccc-0000-4000-8000-000000000002";
const OP3 = "cccccccc-0000-4000-8000-000000000003";

expectError(
  "a variant that is not launch-ACTIVE cannot be ordered",
  order(OP3, V2, 1, "mercado_pago"),
  "MX_ORDER_VARIANT_NOT_ACTIVE",
);
expectError(
  "an unknown payment method is refused",
  order(OP3, V1, 1, "stripe"),
  "MX_ORDER_PAYMENT_METHOD_INVALID",
);

const created = JSON.parse(db.query(order(OP1, V1, 2, "mercado_pago")));
check(
  "an online order is priced by the database in MXN and takes stock",
  Number(created.total_aed) === 214 &&
    created.payment_method === "mercado_pago" &&
    created.replayed === false,
  JSON.stringify(created),
);
check(
  "the order is pending payment and records the chosen method",
  db.query(
    `select status||':'||payment_status||':'||payment_method from public.orders where id='${created.order_id}'`,
  ) === "pending:pending:mercado_pago",
);
check(
  "stock was taken once",
  db.query(`select stock from public.product_variants where id='${V1}'`) === "18",
);
const replay = JSON.parse(db.query(order(OP1, V1, 2, "mercado_pago")));
check(
  "replaying the operation returns the same order and takes no more stock",
  replay.order_id === created.order_id &&
    replay.replayed === true &&
    db.query(`select stock from public.product_variants where id='${V1}'`) === "18",
);
expectError(
  "the same operation cannot come back with another payment method",
  order(OP1, V1, 2, "clip"),
  "CHECKOUT_IDEMPOTENCY_CONFLICT",
);

// ── Payments ─────────────────────────────────────────────────────────────────
const KEY1 = "dddddddd-0000-4000-8000-000000000001";
const start = (orderId, provider, key) =>
  `select public.cm_mx_start_payment_attempt_v1('${orderId}'::uuid, '${provider}', '${key}'::uuid)`;
const attempt = JSON.parse(db.query(start(created.order_id, "mercado_pago", KEY1)));
check(
  "the payment amount is the order total, never a caller-supplied number",
  Number(attempt.amount) === 214 && attempt.currency === "MXN",
);
check(
  "the same idempotency key returns the same attempt",
  JSON.parse(db.query(start(created.order_id, "mercado_pago", KEY1))).attempt_id ===
    attempt.attempt_id &&
    db.query("select count(*) from commerce_private.mx_payment_attempts") === "1",
);
expectError(
  "an attempt cannot be opened with a provider the order did not choose",
  start(created.order_id, "clip", "dddddddd-0000-4000-8000-000000000009"),
  "MX_PAYMENT_PROVIDER_MISMATCH",
);
db.query(
  `select public.cm_mx_bind_payment_attempt_v1('${attempt.attempt_id}'::uuid, 'ORD-1', 'action_required', 'waiting_payment', null)`,
);
expectError(
  "an attempt cannot be re-bound to another provider payment",
  `select public.cm_mx_bind_payment_attempt_v1('${attempt.attempt_id}'::uuid, 'ORD-OTHER', null, null, null)`,
  "MX_PAYMENT_ATTEMPT_ALREADY_BOUND",
);
const apply = (id, status, amount, refunded = 0, late = false) =>
  `select public.cm_mx_apply_payment_state_v1('mercado_pago', '${id}', '${status}', ${amount}, ${refunded}, '${status}', null, ${late})`;

expectError(
  "no label can be reserved before payment is confirmed",
  `select public.cm_mx_reserve_label_v1('${created.order_id}'::uuid, 'skydropx', 'rate-1')`,
  "MX_LABEL_REQUIRES_CONFIRMED_PAYMENT",
);

const tampered = JSON.parse(db.query(apply("ORD-1", "paid", 1)));
check(
  "amount tampering: a payment for another amount is not applied and is flagged",
  tampered.applied === false &&
    tampered.reason === "AMOUNT_MISMATCH" &&
    db.query(`select o.payment_status||':'||o.status||':'||a.status||':'||a.attention from public.orders o
      join commerce_private.mx_payment_attempts a on a.order_id=o.id where o.id='${created.order_id}'`) ===
      "under_review:pending:pending:AMOUNT_MISMATCH",
);
db.query(`update public.orders set payment_status='pending' where id='${created.order_id}'`);

const paid = JSON.parse(db.query(apply("ORD-1", "paid", 214)));
check(
  "a verified payment confirms the order and makes it eligible for fulfilment",
  paid.applied === true &&
    paid.fulfillment_eligible === true &&
    db.query(
      `select status||':'||payment_status from public.orders where id='${created.order_id}'`,
    ) === "confirmed:paid",
);
check(
  "applying the same paid state again changes nothing",
  JSON.parse(db.query(apply("ORD-1", "paid", 214))).applied === true &&
    db.query(
      `select status||':'||payment_status from public.orders where id='${created.order_id}'`,
    ) === "confirmed:paid",
);
check(
  "the first label reservation is granted once payment is confirmed",
  db.query(
    `select public.cm_mx_reserve_label_v1('${created.order_id}'::uuid, 'skydropx', 'rate-1')`,
  ) === "t",
);
check(
  "a second label for the same order is never reserved",
  db.query(
    `select public.cm_mx_reserve_label_v1('${created.order_id}'::uuid, 'solo_envios', 'rate-2')`,
  ) === "f" &&
    db.query(
      `select count(*)||':'||min(provider) from commerce_private.shipments where order_id='${created.order_id}'`,
    ) === "1:skydropx",
);

const partial = JSON.parse(db.query(apply("ORD-1", "paid", 214, 50)));
check(
  "a partial refund keeps the order paid and records the refunded amount",
  partial.applied === true &&
    db.query(
      `select status||':'||refunded_amount from commerce_private.mx_payment_attempts where provider_payment_id='ORD-1'`,
    ) === "paid:50.00",
);
expectError(
  "a refund larger than the payment is refused",
  apply("ORD-1", "paid", 214, 999),
  "MX_PAYMENT_REFUND_AMOUNT_INVALID",
);

// A payment that fails: the order is cancelled and its stock comes back.
const second = JSON.parse(db.query(order(OP2, V1, 3, "clip", "otro@example.invalid")));
check(
  "the second order took stock",
  db.query(`select stock from public.product_variants where id='${V1}'`) === "15",
);
const a2 = JSON.parse(
  db.query(start(second.order_id, "clip", "dddddddd-0000-4000-8000-000000000002")),
);
db.query(
  `select public.cm_mx_bind_payment_attempt_v1('${a2.attempt_id}'::uuid, 'CLIP-1', 'CHECKOUT_CREATED', null, 'https://pago.example.invalid/x')`,
);
const failed = JSON.parse(
  db.query(
    `select public.cm_mx_apply_payment_state_v1('clip', 'CLIP-1', 'cancelled', null, 0, 'CHECKOUT_EXPIRED', null, false)`,
  ),
);
check(
  "a failed payment cancels the order and restores exactly its stock",
  failed.stock_released === true &&
    failed.fulfillment_eligible === false &&
    db.query(`select o.status||':'||o.payment_status||':'||v.stock||':'||i.quantity_on_hand
      from public.orders o, public.product_variants v join public.inventory i on i.variant_id=v.id
      where o.id='${second.order_id}' and v.id='${V1}'`) === "cancelled:cancelled:18:18",
);
expectError(
  "a cancelled order can never get a label",
  `select public.cm_mx_reserve_label_v1('${second.order_id}'::uuid, 'skydropx', 'rate-9')`,
  "MX_LABEL_ORDER_CANCELLED",
);
const late = JSON.parse(
  db.query(
    `select public.cm_mx_apply_payment_state_v1('clip', 'CLIP-1', 'paid', ${Number(second.total_aed)}, 0, 'CHECKOUT_COMPLETED', null, true)`,
  ),
);
check(
  "money arriving after cancellation is held for review and does not ship",
  late.fulfillment_eligible === false &&
    db.query(`select o.status||':'||o.payment_status||':'||a.attention from public.orders o
      join commerce_private.mx_payment_attempts a on a.order_id=o.id where o.id='${second.order_id}'`) ===
      "cancelled:under_review:CAPTURE_ON_CANCELLED_ORDER" &&
    db.query(`select stock from public.product_variants where id='${V1}'`) === "18",
);

// ── Webhook ledger ───────────────────────────────────────────────────────────
const claim = (id) =>
  `select public.cm_mx_claim_webhook_event_v1('mercado_pago', '${id}', 'hash', '{"action":"order.processed"}'::jsonb)`;
check("a new webhook event is claimed", db.query(claim("evt-1")) === "t");
check("a duplicate delivery is not claimed again", db.query(claim("evt-1")) === "f");
db.query(`select public.cm_mx_complete_webhook_event_v1('mercado_pago', 'evt-1', 'processed')`);
check("a processed event stays processed", db.query(claim("evt-1")) === "f");
db.query(claim("evt-2"));
db.query(`select public.cm_mx_complete_webhook_event_v1('mercado_pago', 'evt-2', 'failed')`);
check(
  "an event whose processing failed can be claimed once more",
  db.query(claim("evt-2")) === "t" && db.query(claim("evt-2")) === "f",
);
check(
  "the ledger keeps provider, event id, payload hash, raw payload and timestamps",
  db.query(`select provider||'|'||external_event_id||'|'||payload_hash||'|'||(raw_payload->>'action')||'|'||(received_at is not null)||'|'||(processed_at is not null)||'|'||processing_status
    from commerce_private.integration_webhook_events where external_event_id='evt-1'`) ===
    "mercado_pago|evt-1|hash|order.processed|true|true|processed",
);

// ── Access ───────────────────────────────────────────────────────────────────
check(
  "no Mexico function is executable by anon or authenticated",
  db.query(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'cm_m%' and p.proname ~ '^(cm_mx_|cm_market_)'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`) ===
    "0",
);
check(
  "every Mexico function is executable by the service role",
  db.query(`select count(*) filter (where not has_function_privilege('service_role', p.oid, 'execute'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname ~ '^(cm_mx_|cm_market_)'`) === "0",
);
check(
  "every Mexico table has row level security forced and no anon or authenticated grant",
  db.query(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='commerce_private' and c.relname in ('market_identity','variant_launch_profiles','suppliers','variant_suppliers','mx_payment_attempts','integration_webhook_events','shipments','shipment_events')
      and c.relrowsecurity and c.relforcerowsecurity
      and not has_table_privilege('anon', c.oid, 'select') and not has_table_privilege('authenticated', c.oid, 'select')`) ===
    "8",
);
check(
  "no stock drift",
  db.query(
    `select count(*) from public.product_variants v join public.inventory i on i.variant_id=v.id where v.stock <> i.quantity_on_hand`,
  ) === "0",
);

db.drop();
console.log(JSON.stringify({ status: failures.length ? "failed" : "passed", failures }));
process.exit(failures.length ? 1 : 0);
