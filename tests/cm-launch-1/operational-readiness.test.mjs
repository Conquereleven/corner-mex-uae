import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cartTotals } from "../../src/lib/cart.ts";
import { productCopyToPlainText } from "../../src/lib/product-copy.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("account route is a layout and its index owns the account surface", async () => {
  const [layout, index] = await Promise.all([
    read("src/routes/_authenticated/account.tsx"),
    read("src/routes/_authenticated/account.index.tsx"),
  ]);
  assert.match(layout, /<Outlet \/>/);
  assert.doesNotMatch(layout, /My account|Recent orders/);
  assert.match(index, /My account/);
  assert.match(index, /CustomerOrderHistorySurface/);
});

test("browser-persisted auth is not rejected during SSR", async () => {
  const [protectedLayout, adminLayout] = await Promise.all([
    read("src/routes/_authenticated.tsx"),
    read("src/routes/_authenticated/admin.tsx"),
  ]);
  assert.match(protectedLayout, /typeof window === "undefined"\) return/);
  assert.match(adminLayout, /typeof window === "undefined"\) return/);
  assert.match(protectedLayout, /supabase\.auth\.getUser\(\)/);
  assert.match(adminLayout, /await isAdmin\(\{\}\)/);
});

test("catalog HTML is rendered as readable plain text", () => {
  const html =
    '<p data-start="1">Nixtamalized <strong>corn</strong>.</p><ul><li>Gluten&nbsp;free</li></ul>';
  assert.equal(productCopyToPlainText(html), "Nixtamalized corn. Gluten free");
  assert.equal(productCopyToPlainText("A &amp; B &#x2F; C"), "A & B / C");
  assert.equal(productCopyToPlainText("Keep &#99999999; literal"), "Keep &#99999999; literal");
});

test("cart VAT and total use one coherent fils rounding policy", () => {
  const totals = cartTotals([
    {
      productId: "product",
      variantId: "variant",
      slug: "maseca",
      name: "Maseca",
      variantLabel: null,
      image: null,
      unitPrice: 25.5,
      sellerId: "seller",
      sellerSlug: "corner-mex",
      sellerName: "CornerMex",
      qty: 1,
      stock: 10,
    },
  ]);
  assert.deepEqual(
    { subtotal: totals.subtotal, tax: totals.tax, total: totals.totalBeforeShipping },
    { subtotal: 25.5, tax: 1.28, total: 26.78 },
  );
});

test("pending lifecycle migration removes all service-role table writes", async () => {
  const [foundation, corrective] = await Promise.all([
    read("supabase/pending-canonical/20260812180442_cm_com_4a_post_order_lifecycle.sql"),
    read("supabase/pending-canonical/20260819190000_cm_launch_1_lifecycle_acl_hardening.sql"),
  ]);
  assert.match(
    foundation,
    /revoke all on public\.order_lifecycle_events from public, anon, authenticated, service_role/,
  );
  assert.match(
    corrective,
    /revoke all privileges on table public\.order_lifecycle_events from service_role/,
  );
  assert.match(corrective, /grant select on table public\.order_lifecycle_events to service_role/);
  assert.match(corrective, /insert,update,delete,truncate,references,trigger/);
});

test("tablet header retains compact navigation until the desktop breakpoint", async () => {
  const header = await read("src/components/site/Header.tsx");
  assert.match(header, /text-muted-foreground lg:flex/);
  assert.match(header, /grid-cols-5 rounded-2xl p-1\.5 lg:hidden/);
});
