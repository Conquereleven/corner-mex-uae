import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { BUSINESS_IDENTITY, businessIdentityLine } from "../../src/lib/business-identity.ts";
import { isCheckoutExecutionEnabled } from "../../src/lib/checkout-execution.server.ts";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p) => readFile(path.join(root, p), "utf8");

const TRUST_ROUTES = [
  "src/routes/about.tsx",
  "src/routes/contact.tsx",
  "src/routes/delivery.tsx",
  "src/routes/returns.tsx",
  "src/routes/privacy.tsx",
  "src/routes/terms.tsx",
];

async function sourceFiles(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

test("all trust destinations exist as routes", async () => {
  for (const route of TRUST_ROUTES) {
    const text = await read(route);
    assert.match(text, /createFileRoute/, `${route} must be a route`);
  }
});

test("legacy /shipping route redirects to /delivery", async () => {
  const text = await read("src/routes/shipping.tsx");
  assert.match(text, /redirect\(\{ to: "\/delivery" \}\)/);
});

test("footer links every trust destination", async () => {
  const text = await read("src/components/site/Footer.tsx");
  for (const to of [
    "/about",
    "/contact",
    "/delivery",
    "/returns",
    "/privacy",
    "/terms",
    "/legal",
  ]) {
    assert.ok(text.includes(`"${to}"`), `footer missing link to ${to}`);
  }
  assert.doesNotMatch(text, /"\/shipping"/);
});

test("sitemaps include contact and delivery and drop the legacy shipping path", async () => {
  for (const file of ["src/routes/sitemap[.]xml.ts", "src/routes/api/public/sitemap[.]xml.ts"]) {
    const text = await read(file);
    for (const u of ["/contact", "/delivery", "/about", "/returns", "/privacy", "/terms"]) {
      assert.ok(text.includes(`"${u}"`), `${file} missing ${u}`);
    }
    assert.doesNotMatch(text, /"\/shipping"/);
  }
});

test("robots.txt references no retired origin and keeps private surfaces disallowed", async () => {
  const text = await read("public/robots.txt");
  assert.doesNotMatch(text, /lovable\.app/);
  assert.match(
    text,
    /Sitemap: https:\/\/corner-mex-uae-production\.up\.railway\.app\/sitemap\.xml/,
  );
  for (const p of ["/admin", "/account", "/checkout", "/cart"]) {
    assert.ok(text.includes(`Disallow: ${p}`), `robots must disallow ${p}`);
  }
});

test("business identity is centralized and contains only verified facts", async () => {
  assert.equal(BUSINESS_IDENTITY.legalEntity, "RodMor TradeCo LLC");
  assert.equal(BUSINESS_IDENTITY.tradeLicense, "2647014.01");
  assert.equal(BUSINESS_IDENTITY.phone, undefined, "phone must stay unset until verified");
  assert.equal(BUSINESS_IDENTITY.trn, undefined, "TRN must stay unset until verified");
  assert.match(businessIdentityLine(), /RodMor TradeCo LLC/);

  const files = await sourceFiles("src");
  for (const file of files) {
    // legal-docs.ts is the pre-existing review-gated legal template registry.
    if (file.endsWith("business-identity.ts") || file.endsWith("legal-docs.ts")) continue;
    const text = await readFile(file, "utf8");
    assert.ok(
      !text.includes("2647014.01"),
      `trade license hardcoded outside business-identity.ts: ${path.relative(root, file)}`,
    );
  }
});

test("trust surfaces contain no fabricated promises or fake badges", async () => {
  const banned = [
    /100% secure/i,
    /#1 (?:mexican )?store/i,
    /official (?:mexican )?distributor/i,
    /guaranteed delivery/i,
    /best price guaranteed/i,
    /free shipping/i,
    /same[- ]day delivery/i,
    /next[- ]day delivery/i,
    /\+971[\s\d-]{7,}/,
    /TRN[\s:]*\d/,
  ];
  const surfaces = [
    ...TRUST_ROUTES,
    "src/components/site/Trust.tsx",
    "src/components/site/Footer.tsx",
  ];
  for (const file of surfaces) {
    const text = await read(file);
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${file} matches banned pattern ${pattern}`);
    }
  }
});

test("trust routes declare titles, descriptions and canonical links", async () => {
  for (const route of TRUST_ROUTES) {
    const text = await read(route);
    assert.match(text, /title/, `${route} missing title`);
    assert.match(text, /description/, `${route} missing description`);
    assert.match(text, /canonical/, `${route} missing canonical link`);
  }
});

test("no unverified custom domain is hardcoded as canonical", async () => {
  const files = await sourceFiles("src");
  for (const file of files) {
    // legal-docs.ts is the pre-existing review-gated legal template registry.
    // shipments.functions.ts holds a pre-existing disabled-email fallback origin,
    // flagged in CM-COM-2A docs as a pending Founder/config correction.
    if (file.endsWith("legal-docs.ts") || file.endsWith("shipments.functions.ts")) continue;
    const text = await readFile(file, "utf8");
    assert.ok(
      !/https:\/\/(?:www\.)?cornermex\.ae/.test(text),
      `unverified domain hardcoded in ${path.relative(root, file)}`,
    );
  }
});

test("commercial execution remains disabled by default", () => {
  assert.equal(isCheckoutExecutionEnabled(undefined), false);
  assert.equal(isCheckoutExecutionEnabled("false"), false);
  assert.equal(isCheckoutExecutionEnabled(""), false);
});

test("contact and trust components use the central public contact registry", async () => {
  for (const file of [
    "src/routes/contact.tsx",
    "src/components/site/Trust.tsx",
    "src/components/site/Footer.tsx",
  ]) {
    const text = await read(file);
    assert.ok(
      !/mailto:[a-z0-9.]+@/i.test(text),
      `${file} hardcodes a mailto address instead of using public-contact`,
    );
  }
});

test("contextual trust bar is present on high-intent commerce surfaces", async () => {
  for (const file of [
    "src/routes/product.$slug.tsx",
    "src/routes/cart.tsx",
    "src/routes/checkout.tsx",
    "src/routes/b2b_.quote.tsx",
  ]) {
    const text = await read(file);
    assert.match(text, /<TrustBar /, `${file} missing TrustBar`);
  }
});
