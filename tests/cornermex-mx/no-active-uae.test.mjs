// The UAE implementation may stay in the repository, but it must not appear in
// the active CornerMex Mexico customer experience.
//
// This guard reads the source of every active customer-facing surface: public
// routes, the customer account area, storefront chrome and the copy and money
// helpers they render. Retired UAE modules (legal-docs.ts, the UAE commercial
// config, the Arabic dictionary, admin/seller back-office) are out of scope here
// and are listed in docs/cornermex-mx/DEFERRED-UAE.md.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const FORBIDDEN =
  /\bUAE\b|\bEAU\b|United Arab Emirates|Dubai|Abu Dhabi|Sharjah|Ajman|Fujairah|\bAED\b|[Ee]mirat|Talabat|Deliveroo|\bnoon\b|\bTRN\b|\+971|\bVAT\b|Middle East|RodMor/;

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

async function activeSurfaces() {
  const publicRoutes = (await readdir("src/routes", { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join("src/routes", entry.name));
  const account = (await readdir("src/routes/_authenticated"))
    .filter((name) => name.startsWith("account"))
    .map((name) => path.join("src/routes/_authenticated", name));
  return [
    ...publicRoutes,
    ...account,
    "src/components/site/Header.tsx",
    "src/components/site/Footer.tsx",
    "src/components/site/Trust.tsx",
    "src/components/site/ShopFilters.tsx",
    "src/components/site/ProductCard.tsx",
    "src/components/site/SiteLayout.tsx",
    "src/components/b2b/B2bCatalogHero.tsx",
    "src/components/b2b/ManualQuoteRequestForm.tsx",
    "src/features/b2b-catalog/manual-quote-request.ts",
    "src/lib/email-templates.ts",
    "src/lib/order-experience-contract.ts",
    "src/lib/cart.ts",
    "src/lib/currency.ts",
    "src/lib/use-currency.ts",
    "src/lib/site-url.ts",
    "src/lib/mx-checkout.functions.ts",
    "src/lib/mx-checkout-config.server.ts",
    "src/config/brand.ts",
  ];
}

test("no active customer surface names the UAE, its currency or its tax", async () => {
  const offenders = [];
  for (const file of await activeSurfaces()) {
    const lines = stripComments(await readFile(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      // `address.emirate` is read only to display historical UAE orders.
      if (/address\.emirate|addr\.emirate/.test(line)) return;
      const hit = FORBIDDEN.exec(line);
      if (hit) offenders.push(`${file}:${index + 1} "${hit[0]}"`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("the English and Spanish dictionaries carry no UAE copy", async () => {
  const i18n = await readFile("src/lib/i18n.ts", "utf8");
  // The Arabic dictionary belongs to the deferred UAE market and is not offered.
  const offered = i18n.slice(0, i18n.indexOf("const ar = {"));
  assert.doesNotMatch(offered, FORBIDDEN);
  assert.match(i18n, /lng: ACTIVE_MARKET\.defaultLanguage/);

  const { LANGS } = await import("../../src/lib/i18n.ts");
  assert.deepEqual(
    LANGS.map((language) => language.code),
    ["es", "en"],
  );
});

test("the active checkout has no emirate, no UAE payment copy and no UAE config", async () => {
  const checkout = await readFile("src/routes/checkout.tsx", "utf8");
  assert.doesNotMatch(checkout, /emirate|EmirateCode|commercial-config|payment-methods|delivery-sla/i);
  assert.doesNotMatch(checkout, /cod-order\.functions|card-checkout/);
  assert.match(checkout, /from "@\/lib\/mx-checkout\.functions"/);
  assert.match(checkout, /MX_STATE_OPTIONS/);
  assert.match(checkout, /formatMoney/);
});

test("no customer-facing link can be built from an infrastructure host", async () => {
  for (const file of await activeSurfaces()) {
    assert.doesNotMatch(await readFile(file, "utf8"), /railway\.app/, file);
  }
});

test("the retired UAE modules still exist: history is deferred, not deleted", async () => {
  for (const file of [
    "src/lib/commercial-config.server.ts",
    "src/lib/cod-order.functions.ts",
    "src/lib/payment-methods.ts",
    "src/lib/delivery-sla.ts",
    "src/lib/legal-docs.ts",
  ]) {
    assert.ok((await readFile(file, "utf8")).length > 0, file);
  }
});
