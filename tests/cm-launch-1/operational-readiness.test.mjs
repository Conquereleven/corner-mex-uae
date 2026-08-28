import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cartTotals } from "../../src/lib/cart.ts";
import { productCopyToPlainText } from "../../src/lib/product-copy.ts";
import { resolveRouteAccess } from "../../src/lib/route-auth.ts";

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
  assert.match(index, /admin\.data\?\.admin &&[\s\S]*to="\/admin"/);
  assert.match(index, /supabase\.auth\.signOut\(\)/);
});

function protectedGet(pathname, auth) {
  const access = resolveRouteAccess(pathname, auth);
  if (access === "login") return { status: 302, location: `/login?redirect=${pathname}` };
  if (access === "account") return { status: 302, location: "/account" };
  return { status: 200, body: `SSR:${pathname}` };
}

test("protected GET auth decisions fail closed during SSR", () => {
  assert.deepEqual(protectedGet("/account", { authenticated: false, admin: false }), {
    status: 302,
    location: "/login?redirect=/account",
  });
  assert.deepEqual(protectedGet("/account", { authenticated: true, admin: false }), {
    status: 200,
    body: "SSR:/account",
  });
  assert.deepEqual(protectedGet("/admin", { authenticated: false, admin: false }), {
    status: 302,
    location: "/login?redirect=/admin",
  });
  assert.deepEqual(protectedGet("/admin", { authenticated: true, admin: false }), {
    status: 302,
    location: "/account",
  });
  assert.deepEqual(protectedGet("/admin", { authenticated: true, admin: true }), {
    status: 200,
    body: "SSR:/admin",
  });
});

test("cookie-backed PKCE session is shared by browser and SSR clients", async () => {
  const [browserClient, serverClient, callback] = await Promise.all([
    read("src/integrations/supabase/client.ts"),
    read("src/integrations/supabase/client.ssr.server.ts"),
    read("src/routes/auth.callback.tsx"),
  ]);
  assert.match(browserClient, /createBrowserClient/);
  assert.match(browserClient, /flowType: "pkce"/);
  assert.doesNotMatch(browserClient, /localStorage/);
  assert.match(serverClient, /createServerClient/);
  assert.match(serverClient, /getCookies\(\)/);
  assert.match(serverClient, /setCookie\(name, value, options\)/);
  assert.match(callback, /exchangeCodeForSession\(search\.code\)/);
});

test("nested account order GET passes the shared gate and renders through Outlet", async () => {
  const [layout, order] = await Promise.all([
    read("src/routes/_authenticated/account.tsx"),
    read("src/routes/_authenticated/account.orders.$id.tsx"),
  ]);
  assert.deepEqual(protectedGet("/account/orders/order-1", { authenticated: true, admin: false }), {
    status: 200,
    body: "SSR:/account/orders/order-1",
  });
  assert.match(layout, /<Outlet \/>/);
  assert.match(order, /createFileRoute\("\/_authenticated\/account\/orders\/\$id"\)/);
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
    read("supabase/migrations/20260812180442_cm_com_4a_post_order_lifecycle.sql"),
    read("supabase/migrations/20260819190000_cm_launch_1_lifecycle_acl_hardening.sql"),
  ]);
  assert.equal(
    createHash("sha256").update(foundation).digest("hex"),
    "b2850c7a814b8f1ac4249eb7c187c83401c416d0e810add204688fa66f233608",
  );
  assert.match(
    corrective,
    /revoke all privileges on table public\.order_lifecycle_events from service_role/,
  );
  assert.match(corrective, /grant select on table public\.order_lifecycle_events to service_role/);
  assert.match(corrective, /insert,update,delete,truncate,references,trigger/);
});

test("mobile and tablet use one compact top-header menu until the desktop breakpoint", async () => {
  const header = await read("src/components/site/Header.tsx");
  assert.match(header, /font-semibold lg:flex/);
  assert.match(header, /aria-label="Open menu"/);
  assert.match(header, /className="ms-1 lg:hidden"/);
  assert.doesNotMatch(header, /fixed inset-x-3 bottom-3/);
});
