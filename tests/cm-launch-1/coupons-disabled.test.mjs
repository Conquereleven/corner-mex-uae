// Coupons are disabled until canonical coupon support exists: the previous
// module targeted legacy columns the canonical coupons table lacks, so it
// failed against production. See docs/cornermex-2/LAUNCH-READINESS-PLAN.md §3.2.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(p, "utf8");

test("every coupon server function fails closed before touching the database", async () => {
  const source = await read("src/lib/coupons.functions.ts");
  assert.match(source, /export const COUPONS_ENABLED = false as const;/);
  for (const name of ["validateCoupon", "upsertCoupon", "listCoupons", "deleteCoupon"]) {
    const start = source.indexOf(`export const ${name} = createServerFn`);
    assert.notEqual(start, -1, name);
    const next = source.indexOf("export const", start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);
    const gate = body.indexOf("assertCouponsAvailable()");
    assert.ok(gate > -1, `${name} must call assertCouponsAvailable()`);
    const db = body.search(/supabaseAdmin|isAdminUser|evaluateCoupon\(data/);
    if (db > -1) assert.ok(gate < db, `${name} must gate before any database access`);
  }
  const evaluate = source.slice(source.indexOf("export async function evaluateCoupon"));
  assert.ok(
    evaluate.indexOf("if (!COUPONS_ENABLED)") < evaluate.indexOf("supabaseAdmin"),
    "evaluateCoupon must refuse before querying",
  );
});

test("admin navigation no longer links to the coupon editor", async () => {
  for (const path of [
    "src/routes/_authenticated/admin.tsx",
    "src/routes/_authenticated/admin.settings.tsx",
  ]) {
    assert.doesNotMatch(await read(path), /"\/admin\/coupons"/, path);
  }
});

test("the coupon admin route explains the unavailability instead of calling the API", async () => {
  const page = await read("src/routes/_authenticated/admin.coupons.tsx");
  assert.match(page, /Coupons are not available yet/);
  assert.doesNotMatch(page, /listCoupons|upsertCoupon|deleteCoupon|useServerFn/);
});
