import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("L3P admin product surfaces are single-merchant and seller-independent", async () => {
  const [server, importer, editor, newRoute, importRoute] = await Promise.all([
    read("src/lib/admin-products.functions.ts"),
    read("src/lib/admin-products-import.functions.ts"),
    read("src/components/site/AdminProductEditor.tsx"),
    read("src/routes/_authenticated/admin.products.new.tsx"),
    read("src/routes/_authenticated/admin.products.import.tsx"),
  ]);
  for (const source of [server, importer, editor, newRoute, importRoute]) {
    assert.doesNotMatch(source, /seller_id|sellerId|adminListSellers|seller\.functions/);
  }
  assert.match(server, /assertAdmin\(context\.userId\)/);
  assert.match(importer, /assertAdmin\(context\.userId\)/);
  assert.match(importRoute, /Single-merchant CornerMex import/);
});

test("L3P product, variant and CSV row writes use authenticated transactional RPCs", async () => {
  const [server, importer, migration] = await Promise.all([
    read("src/lib/admin-products.functions.ts"),
    read("src/lib/admin-products-import.functions.ts"),
    read("supabase/migrations/20260820100000_cm_launch_1_l3p_admin_product_management.sql"),
  ]);
  assert.match(server, /admin_upsert_product_v1/);
  assert.match(server, /admin_upsert_product_variant_v1/);
  assert.match(importer, /admin_import_product_row_v1/);
  assert.doesNotMatch(importer, /supabaseAdmin\.from/);
  assert.match(migration, /create or replace function public\.admin_import_product_row_v1/);
  assert.match(migration, /security definer/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /role = 'admin'/);
  assert.match(migration, /grant execute .* to authenticated/);
  assert.match(migration, /revoke all .* service_role/);
});

test("L3P variant transaction preserves canonical inventory equality and reservations", async () => {
  const migration = await read(
    "supabase/migrations/20260820100000_cm_launch_1_l3p_admin_product_management.sql",
  );
  assert.match(migration, /stock = p_stock/);
  assert.match(migration, /quantity_on_hand, quantity_reserved/);
  assert.match(migration, /values \(v_variant_id, p_stock, 0, now\(\)\)/);
  assert.match(migration, /quantity_on_hand = excluded\.quantity_on_hand/);
  assert.match(migration, /quantity_reserved/);
  assert.match(migration, /p_stock < v_reserved/);
  assert.match(migration, /CM_ADMIN_PRODUCT_STOCK_BELOW_RESERVED/);
});

test("L3P activation fails closed without an active positive-price variant", async () => {
  const migration = await read(
    "supabase/migrations/20260820100000_cm_launch_1_l3p_admin_product_management.sql",
  );
  assert.match(migration, /v_effective_status := 'draft'/);
  assert.match(migration, /is_active = true and price_aed > 0/);
  assert.match(migration, /CM_ADMIN_PRODUCT_ACTIVE_VARIANT_REQUIRED/);
});

test("L3P CSV row transaction composes product, variant, inventory and images atomically", async () => {
  const migration = await read(
    "supabase/migrations/20260820100000_cm_launch_1_l3p_admin_product_management.sql",
  );
  const start = migration.indexOf("create or replace function public.admin_import_product_row_v1");
  assert.notEqual(start, -1);
  const source = migration.slice(start);
  assert.match(source, /admin_upsert_product_v1/);
  assert.match(source, /admin_upsert_product_variant_v1/);
  assert.match(source, /delete from public\.product_images/);
  assert.match(source, /insert into public\.product_images/);
});

test("L3P dashboard exposes products, create and import without soon flags", async () => {
  const source = await read("src/routes/_authenticated/admin.tsx");
  assert.match(source, /to: "\/admin\/products", label: "Products"/);
  assert.match(source, /to: "\/admin\/products\/new", label: "New product", icon: Plus \}/);
  assert.match(source, /to: "\/admin\/products\/import"/);
  assert.doesNotMatch(source, /\/admin\/products\/new"[^\n]*soon: true/);
  assert.doesNotMatch(source, /\/admin\/products\/import"[^\n]*soon: true/);
});

test(
  "L3P migration records ratified production application and remains Founder-gated",
  async () => {
    const extension = JSON.parse(
      await read("contracts/canonical-active-migration-extensions-v1.json"),
    );
    const entry = extension.migrations.find(
      (migration) =>
        migration.filename === "20260820100000_cm_launch_1_l3p_admin_product_management.sql",
    );

    assert.ok(entry);
    assert.equal(entry.owner, "canonical_cornermex");
    assert.equal(entry.purpose, "cm_launch_1_l3p_admin_product_management");
    assert.equal(entry.productionApplied, true);
    assert.equal(entry.productionVersion, "20260820204004");
    assert.equal(entry.productionProjectRef, "wlrfknmrhowldygmvtvn");
    assert.equal(entry.requiresFounderProductionGate, true);
  },
);
