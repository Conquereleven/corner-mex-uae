import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getB2bAvailabilityStatus,
  hasSpecialAccountPrice,
  resolveB2bPricePresentation,
} from "../../src/lib/b2b-portal.ts";

const migrationPath =
  "supabase/migrations/20260823041625_cm_b2b_portal_1b_pricing_availability.sql";
const read = (path) => readFile(path, "utf8");

test("active applicable account override wins over the canonical catalogue price", () => {
  const terms = resolveB2bPricePresentation({
    catalogPriceAed: 30,
    overridePriceAed: 24,
    overrideActive: true,
    validFrom: new Date("2026-08-01T00:00:00Z"),
    validUntil: new Date("2026-09-01T00:00:00Z"),
    now: new Date("2026-08-23T00:00:00Z"),
  });
  assert.deepEqual(terms, {
    catalogPriceAed: 30,
    effectivePriceAed: 24,
    priceStatus: "special_account",
  });
  assert.equal(hasSpecialAccountPrice(terms.priceStatus), true);
  assert.equal(hasSpecialAccountPrice("default"), false);
});

test("expired, inactive, future, and removed overrides fall back to catalogue without fabricating zero", () => {
  const now = new Date("2026-08-23T00:00:00Z");
  assert.deepEqual(
    resolveB2bPricePresentation({
      catalogPriceAed: 30,
      overridePriceAed: 24,
      overrideActive: true,
      validUntil: new Date("2026-08-22T23:59:59Z"),
      now,
    }),
    { catalogPriceAed: 30, effectivePriceAed: 30, priceStatus: "expired_override" },
  );
  assert.equal(
    resolveB2bPricePresentation({
      catalogPriceAed: 30,
      overridePriceAed: 24,
      overrideActive: true,
      validFrom: new Date("2026-08-24T00:00:00Z"),
      now,
    }).priceStatus,
    "default",
  );
  assert.equal(resolveB2bPricePresentation({ catalogPriceAed: 30, now }).effectivePriceAed, 30);
  assert.throws(
    () => resolveB2bPricePresentation({ catalogPriceAed: undefined, now }),
    /CM_B2B_CATALOG_PRICE_REQUIRED/,
  );
});

test("availability distinguishes current partial, out-of-stock, and inactive states", () => {
  assert.equal(getB2bAvailabilityStatus({ availableStock: 10, requestedQuantity: 4 }), "available");
  assert.equal(getB2bAvailabilityStatus({ availableStock: 2, requestedQuantity: 4 }), "partial");
  assert.equal(
    getB2bAvailabilityStatus({ availableStock: 0, requestedQuantity: 4 }),
    "out_of_stock",
  );
  assert.equal(
    getB2bAvailabilityStatus({ availableStock: 10, requestedQuantity: 4, sellable: false }),
    "unavailable",
  );
});

test("RPC revalidates account scope before account-specific price reads", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
  assert.match(
    sql,
    /au\.account_id = p_account_id[\s\S]*au\.user_id = v_actor[\s\S]*au\.status = 'active'[\s\S]*a\.status = 'active'/,
  );
  assert.match(
    sql,
    /from commerce_private\.b2b_account_variant_prices ap[\s\S]*ap\.account_id = p_account_id[\s\S]*ap\.variant_id = pv\.id/,
  );
});

test("RPC applies canonical precedence and never uses a zero or historical price fallback", async () => {
  const sql = await read(migrationPath);
  assert.match(
    sql,
    /effectivePriceAed', case when price\.active_applicable then price\.price_aed else pv\.price_aed end/,
  );
  assert.match(sql, /ap\.valid_from is null or ap\.valid_from <= statement_timestamp\(\)/);
  assert.match(sql, /ap\.valid_until is null or ap\.valid_until > statement_timestamp\(\)/);
  assert.doesNotMatch(sql, /effectivePriceAed'[\s\S]{0,100}coalesce\([^)]*,\s*0\)/i);
  assert.doesNotMatch(sql, /oi\.unit_price_aed/);
});

test("quick order excludes inactive variants and reorder uses current public inventory", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /where pv\.is_active = true/);
  assert.match(sql, /left join public\.inventory i on i\.variant_id = pv\.id/);
  assert.match(
    sql,
    /greatest\(coalesce\(i\.quantity_on_hand, 0\) - coalesce\(i\.quantity_reserved, 0\), 0\)/,
  );
  assert.match(sql, /Historical price and stock are never reused as current values/);
});

test("browser code receives only the typed RPC result and exposes no private credentials", async () => {
  const [route, server] = await Promise.all([
    read("src/routes/_authenticated/account.b2b-portal.tsx"),
    read("src/lib/b2b-portal.functions.ts"),
  ]);
  for (const source of [route, server]) {
    assert.doesNotMatch(source, /commerce_private|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/i);
  }
  assert.match(server, /requireSupabaseAuth/);
  assert.match(server, /b2b_portal_v1/);
});

test("migration is additive, gated, and does not grant private-table access", async () => {
  const [sql, manifestText] = await Promise.all([
    read(migrationPath),
    read("contracts/canonical-active-migration-extensions-v1.json"),
  ]);
  const manifest = JSON.parse(manifestText);
  const entry = manifest.migrations.find(
    (item) => item.filename === migrationPath.split("/").at(-1),
  );
  assert.equal(entry.productionApplied, false);
  assert.equal(entry.requiresFounderProductionGate, true);
  assert.doesNotMatch(sql, /grant\s+[^;]*on\s+(table\s+)?commerce_private\./i);
  assert.match(
    sql,
    /revoke all on function public\.b2b_portal_v1\(text, uuid, jsonb\) from public, anon, service_role/,
  );
  assert.match(
    sql,
    /grant execute on function public\.b2b_portal_v1\(text, uuid, jsonb\) to authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.(orders|inventory|inventory_movements|payments)/i,
  );
  assert.doesNotMatch(sql, /update\s+public\.(orders|inventory|inventory_movements|payments)/i);
});
