import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  BUSINESS_IDENTITY,
  BUSINESS_IDENTITY_DECISION_ID,
  BUSINESS_IDENTITY_EVIDENCE_CLASS,
  businessIdentityLine,
} from "../../src/lib/business-identity.ts";
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

// ---------------------------------------------------------------------------
// Founder-attested identity (FD-CM-BUSINESS-IDENTITY-001)
// ---------------------------------------------------------------------------

test("business identity matches the exact Founder-attested values", () => {
  assert.equal(BUSINESS_IDENTITY.brandName, "CornerMex");
  assert.equal(BUSINESS_IDENTITY.legalEntity, "RodMor TradeCo LLC");
  assert.equal(BUSINESS_IDENTITY.location, "Sharjah Media City, Free Zone, UAE");
  assert.equal(BUSINESS_IDENTITY.licensingAuthority, "Sharjah Media City");
  assert.equal(BUSINESS_IDENTITY.tradeLicense, "2647014.01");
  assert.equal(BUSINESS_IDENTITY_EVIDENCE_CLASS, "FOUNDER-ATTESTED");
  assert.equal(BUSINESS_IDENTITY_DECISION_ID, "FD-CM-BUSINESS-IDENTITY-001");
  assert.match(businessIdentityLine(), /RodMor TradeCo LLC/);
  assert.match(businessIdentityLine(), /Sharjah Media City, Free Zone, UAE/);
  assert.match(businessIdentityLine(), /2647014\.01/);
});

test("unattested identity fields stay undefined and are never fabricated", () => {
  for (const field of ["phone", "streetAddress", "supportHours", "trn"]) {
    assert.equal(BUSINESS_IDENTITY[field], undefined, `${field} must stay unset until attested`);
  }
  const line = businessIdentityLine();
  assert.doesNotMatch(line, /undefined/);
  assert.doesNotMatch(line, /\+971/);
});

test("bank beneficiary is the exact attested entity with no spelling drift", async () => {
  assert.equal(BUSINESS_IDENTITY.bankAccountBeneficiary, "RodMor TradeCo LLC");

  const payment = await read("src/lib/payment-methods.ts");
  assert.match(payment, /BUSINESS_IDENTITY\.bankAccountBeneficiary/);

  // The prior conflicting spelling must not reappear anywhere in the app.
  const files = await sourceFiles("src");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.ok(
      !/RodMor\s+Trade\s+Co\b/.test(text),
      `conflicting entity spelling in ${path.relative(root, file)}`,
    );
  }
});

test("identity literals are centralized in business-identity.ts", async () => {
  const files = await sourceFiles("src");
  for (const file of files) {
    if (file.endsWith("business-identity.ts")) continue;
    const text = await readFile(file, "utf8");
    for (const literal of ["2647014.01", "RodMor TradeCo LLC"]) {
      assert.ok(
        !text.includes(literal),
        `identity literal "${literal}" hardcoded outside business-identity.ts: ${path.relative(root, file)}`,
      );
    }
  }
});

test("the Founder decision record exists and states its evidence limits", async () => {
  const record = await read(
    "docs/engineering-playbook/founder-decisions/FD-CM-BUSINESS-IDENTITY-001.md",
  );
  assert.match(record, /FD-CM-BUSINESS-IDENTITY-001/);
  assert.match(record, /FOUNDER-ATTESTED/);
  assert.match(record, /RodMor TradeCo LLC/);
  assert.match(record, /2647014\.01/);
  assert.match(record, /Sharjah Media City, Free Zone, UAE/);
  // Must not claim verification it does not have.
  assert.match(record, /does \*\*not\*\* claim independent documentary verification/i);

  const index = await read("docs/program/FOUNDER_DECISIONS_INDEX.md");
  assert.match(index, /FD-CM-BUSINESS-IDENTITY-001/);
});

// ---------------------------------------------------------------------------
// Delivery truthfulness
// ---------------------------------------------------------------------------

test("/delivery discloses that ordering and delivery execution are not enabled", async () => {
  const delivery = await read("src/routes/delivery.tsx");
  assert.match(delivery, /not currently enabled on this website/i);
  assert.match(delivery, /should be treated as confirmed/i);
});

test("/delivery makes no unsupported absolute guarantee", async () => {
  const delivery = await read("src/routes/delivery.tsx");
  const bannedAbsolutes = [
    /there are no charges added after the fact/i,
    /no hidden (?:fees|charges)/i,
    /always free/i,
    /guaranteed (?:delivery|arrival|time)/i,
    /we guarantee/i,
  ];
  for (const pattern of bannedAbsolutes) {
    assert.doesNotMatch(delivery, pattern, `absolute guarantee present: ${pattern}`);
  }
});

test("/delivery keeps availability qualified and hides COD thresholds", async () => {
  const delivery = await read("src/routes/delivery.tsx");
  assert.match(delivery, /can differ between emirates and order types/i);
  // Internal COD eligibility numbers must never surface as a public promise.
  assert.doesNotMatch(delivery, /cash on delivery/i);
  assert.doesNotMatch(delivery, /\bAED\s?\d/);
});

test("/delivery heading outline is sequential (no skipped levels)", async () => {
  const delivery = await read("src/routes/delivery.tsx");
  assert.doesNotMatch(delivery, /<h3/, "delivery must not jump from h1/h2 to h3");
  assert.match(delivery, /headingLevel=\{2\}/, "trust cards must render as h2 on this page");
});

test("legacy /shipping route redirects to /delivery", async () => {
  const text = await read("src/routes/shipping.tsx");
  assert.match(text, /redirect\(\{ to: "\/delivery" \}\)/);
  assert.doesNotMatch(text, /SiteLayout/, "redirect route must not render a page body");
});

// ---------------------------------------------------------------------------
// Contact stays manual-only
// ---------------------------------------------------------------------------

test("contact remains manual mailto only — no form, POST, CRM or automation", async () => {
  const contact = await read("src/routes/contact.tsx");
  for (const pattern of [
    /<form/i,
    /onSubmit/,
    /fetch\s*\(/,
    /useServerFn/,
    /createServerFn/,
    /method\s*=\s*["']post["']/i,
    /webhook/i,
  ]) {
    assert.doesNotMatch(contact, pattern, `contact must stay manual-only: ${pattern}`);
  }
  assert.match(contact, /mailto\(/, "contact must use the central mailto helper");
  assert.match(contact, /does not\s+create an order/i);
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

// ---------------------------------------------------------------------------
// Routing, metadata, SEO
// ---------------------------------------------------------------------------

test("all trust destinations exist as routes", async () => {
  for (const route of TRUST_ROUTES) {
    const text = await read(route);
    assert.match(text, /createFileRoute/, `${route} must be a route`);
  }
});

test("trust routes declare unique titles, descriptions and canonical links", async () => {
  const titles = [];
  for (const route of TRUST_ROUTES) {
    const text = await read(route);
    assert.match(text, /const title =/, `${route} missing title`);
    assert.match(text, /const description =/, `${route} missing description`);
    assert.match(text, /rel: "canonical"/, `${route} missing canonical link`);
    const literal = /const title =\s*\n?\s*"([^"]+)"/.exec(text);
    if (literal) titles.push(literal[1]);
  }
  assert.ok(titles.length >= 4, "expected literal titles to compare");
  assert.equal(new Set(titles).size, titles.length, `duplicate metadata titles: ${titles}`);
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

// ---------------------------------------------------------------------------
// Trust surfaces and commercial state
// ---------------------------------------------------------------------------

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

test("commercial execution remains disabled by default", () => {
  assert.equal(isCheckoutExecutionEnabled(undefined), false);
  assert.equal(isCheckoutExecutionEnabled("false"), false);
  assert.equal(isCheckoutExecutionEnabled(""), false);
  assert.equal(isCheckoutExecutionEnabled("0"), false);
});

test("bank transfer stays configuration-gated and is not activated by identity", async () => {
  const payment = await read("src/lib/payment-methods.ts");
  assert.match(
    payment,
    /BANK_TRANSFER_CONFIGURED = Boolean\(envBankName && envBankIban\)/,
    "bank transfer must remain gated on configured bank name and IBAN",
  );
});

// ---------------------------------------------------------------------------
// CI enforcement of this suite
// ---------------------------------------------------------------------------

test("CM-COM-2A suite is wired into CI and merged-tree validation", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  assert.match(workflow, /npm run test:cm-com-2a/, "test:cm-com-2a must run in the CI workflow");
  const mergedTree = await read("scripts/ci/validate-merged-tree.sh");
  assert.match(
    mergedTree,
    /npm run test:cm-com-2a/,
    "test:cm-com-2a must run in merged-tree validation",
  );
  const pkg = JSON.parse(await read("package.json"));
  assert.ok(pkg.scripts["test:cm-com-2a"], "package.json must define test:cm-com-2a");
});
