// COD idempotency wiring. The SQL contract itself is proven against a
// disposable PostgreSQL by scripts/cm2/test-launch-hardening-sql.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(p, "utf8");

// Minimal browser stubs so the real module logic runs, rather than being grepped.
function installBrowserStubs() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  // node exposes `navigator` as a read-only getter, so define over it.
  Object.defineProperty(globalThis, "navigator", {
    value: { locks: { request: async (_name, fn) => fn() } },
    configurable: true,
    writable: true,
  });
  return store;
}

test("the COD operation id is stable for the same cart and new for a changed cart", async () => {
  const store = installBrowserStubs();
  const { codCheckoutOperation, clearCodCheckoutOperation } =
    await import("../../src/lib/checkout-operation.ts");
  const buyer = "11111111-1111-1111-1111-111111111111";
  const cart = { items: [{ variant_id: "v1", qty: 2 }] };

  const first = await codCheckoutOperation(buyer, cart);
  const again = await codCheckoutOperation(buyer, cart);
  assert.equal(again, first, "a retry with the same cart must reuse the id");

  const changed = await codCheckoutOperation(buyer, { items: [{ variant_id: "v1", qty: 3 }] });
  assert.notEqual(changed, first, "a changed cart must mint a new id, never strand the customer");

  clearCodCheckoutOperation(buyer);
  assert.equal(store.size, 0, "the id is cleared once the order exists");
  const afterClear = await codCheckoutOperation(buyer, cart);
  assert.notEqual(afterClear, first, "a new checkout starts a new operation");
});

test("the COD key namespace never collides with the persisted card keys", async () => {
  const store = installBrowserStubs();
  const { codCheckoutOperation } = await import("../../src/lib/checkout-operation.ts");
  await codCheckoutOperation("buyer-1", { a: 1 });
  const keys = [...store.keys()];
  assert.deepEqual(keys, ["cornermex-cod-operation:buyer-1"]);
  for (const key of keys) assert.doesNotMatch(key, /intermex-card-operation|intermex-checkout/);
});

test("the server sends the operation id to the idempotent order function", async () => {
  const source = await read("src/lib/cod-order.functions.ts");
  assert.match(source, /"cm_create_cod_order_v2" as never/);
  assert.match(source, /p_operation_id: data\.operationId/);
  assert.match(source, /operationId: z\.string\(\)\.uuid\(\)/);
  assert.doesNotMatch(
    source,
    /"place_cod_order_v1" as never/,
    "the raw non-idempotent RPC must not be called directly",
  );
  assert.match(source, /CHECKOUT_\[A-Z_\]\+/, "idempotency error codes must reach the UI");
});

test("checkout obtains and clears the COD operation id around the order", async () => {
  const checkout = await read("src/routes/checkout.tsx");
  const call = checkout.indexOf("codCheckoutOperation(user.id, input)");
  const place = checkout.indexOf("placeCod({ data: { ...input, operationId } })");
  const clear = checkout.indexOf("clearCodCheckoutOperation(user.id)");
  assert.ok(call > -1 && place > -1 && clear > -1, "COD checkout must use the operation helpers");
  assert.ok(call < place, "the id must be obtained before the order call");
  assert.ok(place < clear, "the id must only be cleared once the order exists");
});

test("the migrations keep place_cod_order_v1 as the single pricing authority", async () => {
  const migration = await read("supabase/migrations/20260919121000_cm2_cod_order_idempotency.sql");
  assert.match(migration, /create or replace function public\.cm_create_cod_order_v2/);
  assert.match(migration, /public\.place_cod_order_v1\(/, "must delegate, not reimplement pricing");
  assert.match(migration, /'cod', v_norm/, "the fingerprint must distinguish COD from card");
  assert.match(migration, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
  assert.match(
    migration,
    /grant execute on function public\.cm_create_cod_order_v2[\s\S]{0,120}to service_role;/,
  );
  assert.doesNotMatch(migration, /drop function|alter table public\.orders/, "must stay additive");
});

test("the cancellation release migration is additive and locks in the checkout order", async () => {
  const migration = await read(
    "supabase/migrations/20260919120000_cm2_release_stock_on_cancellation.sql",
  );
  assert.match(migration, /create or replace function public\.cm_release_order_stock_v1/);
  // same global lock order as place_cod_order_v1: variants by id, then inventory by variant_id
  const variants = migration.indexOf("from public.product_variants v");
  const inventory = migration.indexOf("from public.inventory i");
  assert.ok(variants > -1 && inventory > variants, "variants must be locked before inventory");
  assert.match(migration, /order by v\.id\s+for update/);
  assert.match(migration, /order by i\.variant_id\s+for update/);
  assert.match(migration, /already_released/, "release must be idempotent");
  assert.match(
    migration,
    /STOCK_RELEASE_INVENTORY_NOT_FOUND/,
    "must fail closed on a missing inventory row",
  );
  assert.match(
    migration,
    /perform public\.cm_release_order_stock_v1\(p_order_id, 'order_cancelled'\)/,
  );
  assert.doesNotMatch(migration, /drop function|drop table|delete from/, "must stay additive");
});
