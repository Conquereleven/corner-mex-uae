import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  B2B_PORTAL_MAX_QUANTITY,
  buildEligibleReorderIntent,
  canAccessB2bPortalAccount,
  filterQuickOrderVariants,
  isB2bPortalQuantity,
} from "../../src/lib/b2b-portal.ts";

const read = (path) => readFile(path, "utf8");
const migrationPath = "supabase/migrations/20260823040000_cm_b2b_portal_1a_boundary.sql";

test("account scope denies an inactive or unrelated membership", () => {
  assert.equal(
    canAccessB2bPortalAccount({
      accountId: "a",
      memberships: [{ accountId: "a", membershipStatus: "inactive", accountStatus: "active" }],
    }),
    false,
  );
  assert.equal(
    canAccessB2bPortalAccount({
      accountId: "a",
      memberships: [{ accountId: "other", membershipStatus: "active", accountStatus: "active" }],
    }),
    false,
  );
  assert.equal(
    canAccessB2bPortalAccount({
      accountId: "a",
      memberships: [{ accountId: "a", membershipStatus: "active", accountStatus: "active" }],
    }),
    true,
  );
});

test("quick-order filters inactive variants and inactive products", () => {
  assert.deepEqual(
    filterQuickOrderVariants([
      { id: 1, active: true, productActive: true },
      { id: 2, active: false, productActive: true },
      { id: 3, active: true, productActive: false },
    ]).map((item) => item.id),
    [1],
  );
});

test("saved-list quantities reject negative, NaN, overflow, and unsafe values", () => {
  for (const value of [
    -1,
    0,
    NaN,
    Infinity,
    B2B_PORTAL_MAX_QUANTITY + 1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(isB2bPortalQuantity(value), false);
  assert.equal(isB2bPortalQuantity(1), true);
  assert.equal(isB2bPortalQuantity(B2B_PORTAL_MAX_QUANTITY), true);
});

test("reorder intent omits inactive and unavailable historical lines", () => {
  assert.deepEqual(
    buildEligibleReorderIntent([
      { variantId: "one", active: true, productActive: true, availableStock: 3, quantity: 2 },
      { variantId: "two", active: false, productActive: true, availableStock: 3, quantity: 2 },
      { variantId: "three", active: true, productActive: true, availableStock: 0, quantity: 2 },
    ]).map((line) => line.variantId),
    ["one"],
  );
});

test("boundary migration verifies account scope, ownership, and current availability", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
  assert.match(
    sql,
    /au\.user_id = v_actor[\s\S]*?au\.status = 'active'[\s\S]*?a\.status = 'active'/,
  );
  assert.match(sql, /saved_lists where id = v_list_id and account_id = p_account_id/);
  assert.match(sql, /public\.orders where id = v_order_id and buyer_id = v_actor/);
  assert.match(sql, /quantity_on_hand - i\.quantity_reserved/);
  assert.match(sql, /pv\.is_active = true/);
});

test("saved-list upsert is deterministic and quantity bounded", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /on conflict \(saved_list_id, variant_id\) do update/i);
  assert.match(sql, /least\(100000,[\s\S]*desired_quantity \+ excluded\.desired_quantity\)/i);
  assert.match(sql, /CM_B2B_INVALID_DESIRED_QUANTITY/);
});

test("portal has no order, payment, inventory, or supplier creation side effect", async () => {
  const sql = await read(migrationPath);
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.(orders|payments|inventory|inventory_movements)/i,
  );
  assert.doesNotMatch(sql, /update\s+public\.(orders|payments|inventory)/i);
  assert.match(sql, /no order, payment, inventory, supplier or automatic checkout mutation/i);
});

test("browser route has no private-table access or service role credential", async () => {
  const route = await read("src/routes/_authenticated/account.b2b-portal.tsx");
  const server = await read("src/lib/b2b-portal.functions.ts");
  const intent = await read("src/lib/b2b-reorder-intent.ts");
  assert.doesNotMatch(route, /commerce_private|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(server, /supabaseAdmin|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(server, /requireSupabaseAuth/);
  assert.match(server, /b2b_portal_v1/);
  assert.match(intent, /B2bCartDraftItem/);
  assert.doesNotMatch(intent, /cornermex-cart-v1|useCart/);
});
