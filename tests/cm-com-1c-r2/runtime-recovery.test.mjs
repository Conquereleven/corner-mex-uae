import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { safeInternalRedirect } from "../../src/lib/safe-internal-redirect.ts";
import { B2B_CATEGORIES, WAVE_1_PRODUCTS } from "../../src/features/b2b-catalog/wave1-products.ts";

const read = (file) => readFileSync(join(process.cwd(), file), "utf8");
const vite = read("vite.config.ts");
const shop = read("src/routes/shop.tsx");
const login = read("src/routes/login.tsx");
const callback = read("src/routes/auth.callback.tsx");
const supabaseClient = read("src/integrations/supabase/client.ts");
const checkout = read("src/routes/checkout.tsx");
const orders = read("src/lib/orders.functions.ts");
const payments = read("src/lib/payments.functions.ts");
const b2bActions = read("src/components/b2b/ManualContactActions.tsx");
const b2bNav = read("src/components/b2b/B2bCategoryNav.tsx");
const previewFormatter = read("src/features/b2b-catalog/manual-quote-request.ts");

test("async-hooks shim is resolved only for the Vite client environment", () => {
  assert.match(vite, /this\.environment\.name === "client"/);
  assert.match(vite, /configEnvironment\(environmentName\)[\s\S]*environmentName !== "client"/);
  assert.match(
    vite,
    /environmentName !== "client"[\s\S]*resolve:[\s\S]*"node:async_hooks"[\s\S]*exclude:[\s\S]*@tanstack\/start-client-core/,
  );
  assert.doesNotMatch(vite, /vite:\s*\{\s*resolve:\s*\{[\s\S]{0,300}"node:async_hooks"/);
});

test("native AsyncLocalStorage retains context through awaited continuations", async () => {
  const storage = new AsyncLocalStorage();
  const value = await storage.run("r2-context", async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return storage.getStore();
  });
  assert.equal(value, "r2-context");
});

test("Shop distinguishes a retryable error from a successful empty state", () => {
  assert.match(shop, /products\.isError[\s\S]*catalogue is temporarily unavailable/i);
  assert.match(shop, /onClick=\{\(\) => void products\.refetch\(\)\}/);
  assert.match(shop, /products\.isSuccess && productItems\.length === 0/);
  assert.match(shop, /The pantry is being curated/);
});

test("category and facet failures do not become zero-product claims", () => {
  assert.match(shop, /const supportingDataError = cats\.isError \|\| facets\.isError/);
  assert.match(shop, /Retry filters/);
  assert.match(shop, /Product results remain separate\s+from this filter error/);
});

test("Google sign-in uses direct Supabase OAuth and an internal callback", () => {
  assert.match(login, /supabase\.auth\.signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.match(login, /new URL\("\/auth\/callback", window\.location\.origin\)/);
  assert.doesNotMatch(login, /lovableAuth|integrations\/lovable/i);
});

test("PKCE callback exchanges the code without exposing provider tokens", () => {
  assert.match(supabaseClient, /flowType: "pkce"/);
  assert.match(supabaseClient, /detectSessionInUrl: false/);
  assert.match(callback, /exchangeCodeForSession\(search\.code\)/);
  assert.doesNotMatch(callback, /access_token|refresh_token|provider_token/);
});

test("OAuth callback destinations reject external and encoded escapes", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/%2f%2fevil.example",
    "/%255c%255cevil.example",
    "/%",
  ]) {
    assert.equal(safeInternalRedirect(value, "/account"), "/account");
  }
  assert.equal(safeInternalRedirect("/account?tab=orders", "/"), "/account?tab=orders");
});

test("email/password login and protected admin boundaries remain present", () => {
  assert.match(login, /signInWithPassword/);
  assert.doesNotMatch(`${login}\n${callback}`, /Claim admin|AdminBootstrapCard|adminBootstrap/i);
});

test("all nine checkout delivery controls have stable ids and names", () => {
  const ids =
    checkout.match(
      /id="checkout-(?:recipient-name|phone|emirate|area|street|building|floor-apartment|landmark|notes)"/g,
    ) ?? [];
  const names =
    checkout.match(
      /name="(?:recipient_name|phone|emirate|area|street|building|floor_apt|landmark|notes)"/g,
    ) ?? [];
  assert.equal(new Set(ids).size, 9);
  assert.equal(new Set(names).size, 9);
  assert.match(checkout, /htmlFor=\{id\}/);
  assert.match(checkout, /aria-labelledby="checkout-emirate-label"/);
});

test("checkout layout is bounded without using overflow hiding as the fix", () => {
  assert.match(checkout, /grid min-w-0 max-w-full/);
  assert.match(checkout, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,380px\)\]/);
  assert.doesNotMatch(checkout, /overflow-x-hidden/);
});

test("checkout order and payment execution remain fail closed", () => {
  assert.match(checkout, /VITE_CORNERMEX_CHECKOUT_ENABLED === "true"/);
  assert.match(orders, /assertCheckoutExecutionEnabled\(\);/);
  assert.equal((payments.match(/assertCheckoutExecutionEnabled\(\);/g) ?? []).length, 3);
});

test("B2B copy feedback is accessible and never implies sending", () => {
  assert.match(b2bActions, /role="status" aria-live="polite"/);
  assert.match(b2bActions, /copied locally — not submitted or sent/i);
  assert.match(previewFormatter, /Prepared locally — not submitted/);
});

test("B2B touch target correction preserves the exact approved catalogue", () => {
  assert.match(b2bNav, /min-h-12/);
  assert.equal(WAVE_1_PRODUCTS.length, 15);
  assert.deepEqual(
    B2B_CATEGORIES.map((category) => category.count),
    [7, 5, 3],
  );
});

test("R2 commands are wired additively into CI and merged-tree validation", () => {
  const packageJson = read("package.json");
  const ci = read(".github/workflows/ci.yml");
  const mergedTree = read("scripts/ci/validate-merged-tree.sh");
  for (const command of [
    "validate:cm-com-1c-r2",
    "test:cm-com-1c-r2",
    "validate:ssr-async-context",
  ]) {
    assert.match(packageJson, new RegExp(command));
    assert.match(ci, new RegExp(command));
    assert.match(mergedTree, new RegExp(command));
  }
});
