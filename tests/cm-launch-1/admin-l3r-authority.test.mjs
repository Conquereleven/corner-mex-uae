import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const UNAVAILABLE_ROUTES = [
  "src/routes/_authenticated/admin.banners.tsx",
  "src/routes/_authenticated/admin.shipping.tsx",
  "src/routes/_authenticated/admin.shipments.tsx",
  "src/routes/_authenticated/admin.returns.tsx",
  "src/routes/_authenticated/admin.newsletter.tsx",
];

test("privileged admin functions use a server-side role boundary", async () => {
  const [guard, banners, shipping, shipments, returns, newsletter, reviews, coupons] = await Promise.all([
    read("src/lib/admin-authorization.server.ts"),
    read("src/lib/banners.functions.ts"),
    read("src/lib/shipping.functions.ts"),
    read("src/lib/shipments.functions.ts"),
    read("src/lib/returns.functions.ts"),
    read("src/lib/newsletter.functions.ts"),
    read("src/lib/reviews.functions.ts"),
    read("src/lib/coupons.functions.ts"),
  ]);

  assert.match(guard, /CM_ADMIN_ROLE_REQUIRED/);
  assert.match(guard, /\.eq\("role", "admin"\)/);

  for (const source of [banners, shipping, shipments, returns, newsletter, reviews, coupons]) {
    assert.match(source, /admin-authorization\.server/);
    assert.match(source, /assertAdmin/);
  }

  assert.match(shipments, /sendOrderEmail[\s\S]*middleware\(\[requireSupabaseAuth\]\)/);
  assert.doesNotMatch(shipments, /from\("orders"\)[\s\S]{0,160}\.update\(/);
});

test("non-canonical admin capabilities are not presented as operational", async () => {
  const nav = await read("src/routes/_authenticated/admin.tsx");
  for (const path of ["shipping", "shipments", "returns", "banners", "newsletter"]) {
    assert.match(nav, new RegExp(`to: "/admin/${path}"[^\n]*soon: true`));
  }

  for (const route of UNAVAILABLE_ROUTES) {
    const source = await read(route);
    assert.match(source, /AdminCapabilityUnavailable/);
    assert.doesNotMatch(source, /useServerFn/);
    assert.doesNotMatch(source, /useMutation/);
  }
});

test("admin settings links only to canonical actionable configuration", async () => {
  const settings = await read("src/routes/_authenticated/admin.settings.tsx");
  assert.match(settings, /\/admin\/categories/);
  assert.match(settings, /\/admin\/coupons/);
  for (const path of ["banners", "newsletter", "shipping", "shipments", "returns"]) {
    assert.doesNotMatch(settings, new RegExp(`/admin/${path}`));
  }
});

test("admin overview and sidebar counts use canonical lifecycle states", async () => {
  const [overview, counts, route] = await Promise.all([
    read("src/lib/admin-overview.functions.ts"),
    read("src/lib/admin-dashboard-counts.functions.ts"),
    read("src/routes/_authenticated/admin.index.tsx"),
  ]);

  assert.match(overview, /ORDER_STATES/);
  assert.match(overview, /PAYMENT_STATES/);
  assert.match(overview, /"pending", "confirmed", "processing"/);
  assert.doesNotMatch(overview, /"preparing"/);
  assert.match(counts, /"pending", "confirmed", "processing"/);
  assert.doesNotMatch(counts, /"preparing"/);
  assert.match(route, /Pending \+ confirmed \+ processing/);
});

test("coupon all-scope and review moderation remain admin-only", async () => {
  const [coupons, reviews] = await Promise.all([
    read("src/lib/coupons.functions.ts"),
    read("src/lib/reviews.functions.ts"),
  ]);

  assert.match(coupons, /data\.scope === "all"[\s\S]*assertAdmin\(context\.userId\)/);
  assert.match(reviews, /adminListReviews[\s\S]*assertAdmin\(context\.userId\)/);
  assert.match(reviews, /adminSetReviewStatus[\s\S]*assertAdmin\(context\.userId\)/);
});
