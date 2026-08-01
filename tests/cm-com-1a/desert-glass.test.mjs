import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Desert Glass exports the six bounded primitives", async () => {
  const source = await read("src/components/site/DesertGlass.tsx");
  for (const name of [
    "DesertGlassSurface",
    "DesertGlassHeader",
    "DesertGlassControl",
    "DesertGlassDrawerShell",
    "DesertGlassOverlay",
    "DesertGlassBadge",
  ])
    assert.match(source, new RegExp(`export function ${name}`));
});

test("Desert Glass has solid, transparency and motion fallbacks", async () => {
  const css = await read("src/styles.css");
  assert.match(css, /@supports not \(\(-webkit-backdrop-filter:/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /background: var\(--card\)/);
});

test("single-merchant navigation hides Phase 2 marketplace operations", async () => {
  const nav = await read("src/routes/_authenticated/admin.tsx");
  for (const route of ["/admin/sellers", "/admin/sellers/kyc", "/admin/payouts"]) {
    assert.doesNotMatch(nav, new RegExp(`to: \"${route}\"`));
  }
});

test("direct Phase 2 admin routes redirect before rendering or querying", async () => {
  for (const path of [
    "src/routes/_authenticated/admin.sellers.tsx",
    "src/routes/_authenticated/admin.sellers.kyc.tsx",
    "src/routes/_authenticated/admin.payouts.tsx",
  ]) {
    const route = await read(path);
    assert.match(route, /beforeLoad: \(\) => \{\s+throw redirect\(\{ to: \"\/admin\" \}\);\s+\}/);
  }
});

test("admin overview contains seven first-party KPIs and no seller KPI", async () => {
  const overview = await read("src/routes/_authenticated/admin.index.tsx");
  assert.equal((overview.match(/<Kpi\b/g) ?? []).length, 7);
  assert.doesNotMatch(overview, /Commission earned|Active sellers|Top sellers/);
});

test("checkout controls fail closed while the capability is off", async () => {
  const product = await read("src/routes/product.$slug.tsx");
  const cart = await read("src/routes/cart.tsx");
  for (const source of [product, cart]) {
    assert.match(source, /VITE_CORNERMEX_CHECKOUT_ENABLED === \"true\"/);
  }
  assert.match(product, /disabled=\{!checkoutEnabled\}/);
  assert.match(cart, /Checkout coming soon/);
});

test("commercial capabilities remain false by default", async () => {
  const config = await read("src/config/commerce-env.ts");
  for (const flag of ["MARKETPLACE", "CHECKOUT", "EXTERNAL_MESSAGES", "REAL_PAYMENT_EXECUTION"]) {
    assert.match(config, new RegExp(`CORNERMEX_${flag}_ENABLED: falseByDefault`));
  }
});
