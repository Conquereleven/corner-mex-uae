// Founder decision 2026-09-19 (docs/cornermex-2/LEGAL-IDENTITY.md):
//   CornerMex = public brand · RodMor TradeCo LLC = seller of record ·
//   Intermex = supplier only.
// This file previously enforced Intermex as the only public brand (workstream
// CM-INTERMEX-STOREFRONT-2). It keeps its path so CI wiring is unchanged, and
// now enforces the inverse: no customer-facing surface presents Intermex as the
// brand or merchant. Intermex may appear only in supplier/sourcing context.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// A line may name Intermex only when it is plainly about supply or sourcing.
const SUPPLIER_CONTEXT =
  /supplier|sourc|purchase order|incl\. Intermex|such as Intermex|e\.g\. Intermex|including Intermex/i;

async function filesIn(directory, include) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && include(entry.name))
    .map((entry) => join(directory, entry.name));
}

async function customerFacingFiles() {
  const publicRoutes = await filesIn(
    "src/routes",
    (name) => name.endsWith(".tsx") && !name.startsWith("api") && name !== "_authenticated.tsx",
  );
  const accountRoutes = await filesIn("src/routes/_authenticated", (name) =>
    name.startsWith("account"),
  );
  return [
    ...publicRoutes,
    ...accountRoutes,
    ...(await filesIn("src/components/b2b", (name) => name.endsWith(".tsx"))),
    ...(await filesIn("src/components/account", (name) => name.endsWith(".tsx"))),
    "src/routes/_authenticated/admin.legal.tsx",
    "src/components/site/CookieConsent.tsx",
    "src/components/site/Footer.tsx",
    "src/components/site/Header.tsx",
    "src/components/site/LegalDocPage.tsx",
    "src/components/site/ProductCard.tsx",
    "src/components/site/SiteLayout.tsx",
    "src/lib/catalog.functions.ts",
    "src/lib/email-templates.ts",
    "src/lib/external-email.server.ts",
    "src/lib/i18n.ts",
    "src/lib/legal-docs.ts",
    "src/lib/payments.functions.ts",
    "scripts/seo-products.mjs",
  ];
}

// Files whose Intermex references are persisted compatibility keys, not branding.
// They must NOT be renamed without an approved migration (see LEGAL-IDENTITY.md).
const PERSISTED_KEY_FILES = new Set([
  "src/routes/order-confirmed.tsx",
  "src/lib/checkout-operation.ts",
]);

test("no customer-facing surface presents Intermex as brand or merchant", async () => {
  const offenders = [];
  for (const path of await customerFacingFiles()) {
    if (PERSISTED_KEY_FILES.has(path)) continue;
    const lines = (await readFile(path, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (/Intermex UAE/.test(line))
        offenders.push(`${path}:${index + 1} (brand name "Intermex UAE")`);
      else if (/\bIntermex\b/.test(line) && !SUPPLIER_CONTEXT.test(line))
        offenders.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `Intermex outside supplier context:\n${offenders.join("\n")}`);
});

test("CornerMex is the public site identity in document metadata", async () => {
  const root = await readFile("src/routes/__root.tsx", "utf8");
  assert.match(root, /property: "og:site_name", content: "CornerMex"/);
  assert.doesNotMatch(root, /\bIntermex\b/);
});

test("public header keeps the simplified navigation contract", async () => {
  const header = await readFile("src/components/site/Header.tsx", "utf8");
  for (const label of ["Shop", "Wholesale", "About", "Find Us", "Search", "Account", "Cart"]) {
    assert.ok(header.includes(label), `missing first-level header destination: ${label}`);
  }
  for (const removed of ["NotificationsBell", "Manual quote", ">Home<"])
    assert.ok(!header.includes(removed), `removed first-level control returned: ${removed}`);
  const firstLevelHeader = header.slice(header.indexOf("return ("), header.indexOf("<Sheet>"));
  for (const nested of ["Currency", "Language"])
    assert.ok(!firstLevelHeader.includes(nested), `${nested} returned to first-level navigation`);
  assert.doesNotMatch(header, /fixed inset-x-3 bottom-3/, "mobile bottom navigation returned");
  assert.match(header, /aria-label="Open menu"/);
  assert.match(header, /aria-label="Mobile menu"/);
});
