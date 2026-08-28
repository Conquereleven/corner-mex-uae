import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const LEGACY_PUBLIC_BRAND = /CornerMex|Corner Mex|Corner-Mex/;

async function filesIn(directory, include) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && include(entry.name))
    .map((entry) => join(directory, entry.name));
}

test("public and customer routes expose Intermex as the only visible brand", async () => {
  const publicRoutes = await filesIn(
    "src/routes",
    (name) => name.endsWith(".tsx") && !name.startsWith("api") && name !== "_authenticated.tsx",
  );
  const accountRoutes = await filesIn("src/routes/_authenticated", (name) =>
    name.startsWith("account"),
  );
  const customerComponents = [
    ...(await filesIn("src/components/b2b", (name) => name.endsWith(".tsx"))),
    ...(await filesIn("src/components/account", (name) => name.endsWith(".tsx"))),
    "src/components/site/CookieConsent.tsx",
    "src/components/site/Footer.tsx",
    "src/components/site/Header.tsx",
    "src/components/site/LegalDocPage.tsx",
    "src/components/site/SiteLayout.tsx",
    "src/lib/business-identity.ts",
    "src/lib/catalog.functions.ts",
    "src/lib/email-templates.ts",
    "src/lib/external-email.server.ts",
    "src/lib/i18n.ts",
    "src/lib/legal-docs.ts",
    "scripts/seo-products.mjs",
  ];

  for (const path of [...publicRoutes, ...accountRoutes, ...customerComponents]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, LEGACY_PUBLIC_BRAND, `${path} leaks the legacy public brand`);
  }
});

test("public header keeps the simplified Intermex navigation contract", async () => {
  const header = await readFile("src/components/site/Header.tsx", "utf8");
  for (const label of ["Shop", "Wholesale", "About", "Find Us", "Search", "Account", "Cart"]) {
    assert.ok(header.includes(label), `missing first-level header destination: ${label}`);
  }
  for (const removed of ["NotificationsBell", "Manual quote", "Currency", "Language", ">Home<"])
    assert.ok(!header.includes(removed), `removed first-level control returned: ${removed}`);
});

test("Intermex shell uses the approved logo and structural palette", async () => {
  const [brand, styles, root] = await Promise.all([
    readFile("src/config/brand.ts", "utf8"),
    readFile("src/styles.css", "utf8"),
    readFile("src/routes/__root.tsx", "utf8"),
  ]);
  assert.match(brand, /intermex-logo-yellow\.png/);
  assert.match(brand, /verdeJalapeno: "#2d9849"/);
  assert.match(brand, /moleBrown: "#6e441d"/);
  assert.match(styles, /var\(--brand-structural-red\)/);
  assert.match(root, /Intermex(?: UAE)?/);
});
