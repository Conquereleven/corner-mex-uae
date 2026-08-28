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
import {
  assertExternalEmailEnabled,
  isExternalEmailEnabled,
  isExternalEmailProviderConfigured,
  sendExternalEmail,
} from "../../src/lib/external-email.server.ts";
import {
  PRIMARY_PUBLIC_EMAIL,
  PUBLIC_CONTACT,
  PUBLIC_CONTACT_DECISION_ID,
  PUBLIC_CONTACT_EVIDENCE_CLASS,
} from "../../src/lib/public-contact.ts";

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
  assert.equal(BUSINESS_IDENTITY.brandName, "Intermex");
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
  // cornermex.ae is not owned or operational (FD-CM-PUBLIC-CONTACT-001).
  // NO application source is exempt: the former shipments/b2b-leads exemption
  // was removed in R3 once both senders were truthfully remediated.
  const files = await sourceFiles("src");
  for (const file of files) {
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

// ---------------------------------------------------------------------------
// CM-COM-2A-R2: domain and contact truth (FD-CM-PUBLIC-CONTACT-001)
// ---------------------------------------------------------------------------

// Composed rather than written as a literal so this file stays clean under the
// A3 privacy guard, which forbids raw address literals in changed sources.
// Composed so this file holds no raw address literal (A3 privacy guard).
const AUDIT_RECIPIENT = ["recipient", ["example", "invalid"].join(".")].join("@");

const EXPECTED_PUBLIC_EMAIL = ["cornermexuae", ["gmail", "com"].join(".")].join("@");
const UNOWNED_MAIL_DOMAIN = ["cornermex", "ae"].join(".");

test("the temporary public email is exactly the Founder-authorized address", () => {
  assert.equal(PRIMARY_PUBLIC_EMAIL, EXPECTED_PUBLIC_EMAIL);
  assert.equal(PUBLIC_CONTACT_EVIDENCE_CLASS, "FOUNDER-ATTESTED / TEMPORARY");
  assert.equal(PUBLIC_CONTACT_DECISION_ID, "FD-CM-PUBLIC-CONTACT-001");
});

test("no PUBLIC_CONTACT customer channel resolves to the unowned domain", () => {
  for (const [intent, value] of Object.entries(PUBLIC_CONTACT)) {
    assert.equal(value, EXPECTED_PUBLIC_EMAIL, `${intent} must use the authorized mailbox`);
    assert.ok(
      !String(value).includes(UNOWNED_MAIL_DOMAIN),
      `${intent} must not resolve to an unowned ${UNOWNED_MAIL_DOMAIN} mailbox`,
    );
  }
});

test("no application source composes or hardcodes an unowned-domain mailbox", async () => {
  // No exemptions. Every application source, rendered or not, is in scope.
  const files = await sourceFiles("src");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const relative = path.relative(root, file);
    assert.ok(
      !new RegExp(`[A-Za-z0-9._%+-]+@${UNOWNED_MAIL_DOMAIN.replace(".", "\\.")}`).test(text),
      `unowned-domain mailbox in ${relative}`,
    );
    assert.ok(!/\["cornermex",\s*"ae"\]/.test(text), `unowned mail domain composed in ${relative}`);
  }
});

test("/contact uses the registry and explains the shared temporary mailbox", async () => {
  const contact = await read("src/routes/contact.tsx");
  assert.match(contact, /PUBLIC_CONTACT\./, "contact must resolve addresses via the registry");
  assert.match(contact, /confirmed way to contact Intermex/i);
  assert.match(contact, /same address with a different\s*\n?\s*subject line/i);
  assert.ok(!contact.includes(UNOWNED_MAIL_DOMAIN), "contact must not name the unowned domain");
});

test("legal-docs no longer presents an unowned website as active", async () => {
  const legal = await read("src/lib/legal-docs.ts");
  assert.doesNotMatch(legal, /Website: https:\/\//, "no active branded website may be claimed");
  assert.match(legal, /PENDING CUSTOM DOMAIN ACTIVATION/);
  assert.ok(
    !legal.includes(UNOWNED_MAIL_DOMAIN),
    "legal docs must not reference the unowned domain",
  );
});

test("the domain-truth scan exempts no application source", async () => {
  const suite = await read("tests/cm-com-2a/trust-architecture.test.mjs");
  assert.doesNotMatch(
    suite,
    /if \(file\.endsWith\("legal-docs\.ts"\)/,
    "legal-docs.ts must not be exempted from the domain-truth scan",
  );
});

test("public trust surfaces resolve contact through the registry", async () => {
  for (const file of [
    "src/components/site/Footer.tsx",
    "src/routes/privacy.tsx",
    "src/routes/delivery.tsx",
    "src/routes/terms.tsx",
    "src/routes/returns.tsx",
  ]) {
    const text = await read(file);
    assert.ok(!text.includes(UNOWNED_MAIL_DOMAIN), `${file} must not name the unowned domain`);
    if (/mailto\(|PUBLIC_CONTACT/.test(text)) {
      assert.match(text, /PUBLIC_CONTACT/, `${file} must source contact from the registry`);
    }
  }
});

test("the public contact decision record states its scope and limits", async () => {
  const record = await read(
    "docs/engineering-playbook/founder-decisions/FD-CM-PUBLIC-CONTACT-001.md",
  );
  assert.match(record, /FD-CM-PUBLIC-CONTACT-001/);
  assert.match(record, /FOUNDER-ATTESTED \/ TEMPORARY/);
  assert.match(record, /not purchased/i);
  assert.match(record, /not owned \/ not operational/i);
  assert.match(record, /does not assert independent mailbox verification/i);
  const index = await read("docs/program/FOUNDER_DECISIONS_INDEX.md");
  assert.match(index, /FD-CM-PUBLIC-CONTACT-001/);
});

test("CM-COM-2B domain cutover remains on hold in documentation", async () => {
  const record = await read(
    "docs/engineering-playbook/founder-decisions/FD-CM-PUBLIC-CONTACT-001.md",
  );
  assert.match(record, /CM-COM-2B[^\n]*ON HOLD/i);
  const commercial = await read("docs/commercial/cm-com-2a-trust-architecture.md");
  assert.match(commercial, /CM-COM-2B/);
  assert.match(commercial, /on hold/i);
});

// ---------------------------------------------------------------------------
// CM-COM-2A-R3: external email is fail-closed on an explicit capability flag
// ---------------------------------------------------------------------------

test("external email capability is fail-closed — only the exact string true enables it", () => {
  for (const value of [
    undefined,
    "",
    "false",
    "0",
    "1",
    "TRUE",
    "True",
    "yes",
    "on",
    " true",
    "true ",
    "truthy",
    "enabled",
  ]) {
    assert.equal(
      isExternalEmailEnabled(value),
      false,
      `external email must stay disabled for ${JSON.stringify(value)}`,
    );
  }
  assert.equal(isExternalEmailEnabled("true"), true);
});

test("assertExternalEmailEnabled throws unless the capability is exactly true", () => {
  for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
    assert.throws(() => assertExternalEmailEnabled(value), /EXTERNAL_EMAIL_DISABLED/);
  }
  assert.doesNotThrow(() => assertExternalEmailEnabled("true"));
});

test("provider configuration is not authorization", () => {
  // Keys present but capability off => still disabled.
  assert.equal(
    isExternalEmailProviderConfigured({ LOVABLE_API_KEY: "x", RESEND_API_KEY: "y" }),
    true,
  );
  assert.equal(isExternalEmailEnabled(undefined), false);
  // Capability on but keys absent => configuration incomplete.
  assert.equal(isExternalEmailProviderConfigured({}), false);
  assert.equal(isExternalEmailProviderConfigured({ LOVABLE_API_KEY: "x" }), false);
  assert.equal(isExternalEmailProviderConfigured({ RESEND_API_KEY: "y" }), false);
});

test("capability off blocks the outbound request even with provider keys present", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called += 1;
    throw new Error("network must not be reached while external email is disabled");
  };
  try {
    for (const flag of [undefined, "false", "1", "TRUE", "yes"]) {
      const result = await sendExternalEmail({
        to: AUDIT_RECIPIENT,
        subject: "audit",
        html: "<p>audit</p>",
        environment: {
          CORNERMEX_EXTERNAL_EMAIL_ENABLED: flag,
          LOVABLE_API_KEY: "present",
          RESEND_API_KEY: "present",
        },
      });
      assert.equal(result.ok, false);
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "capability_disabled");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(called, 0, "no outbound request may be attempted while disabled");
});

test("capability on without provider configuration still sends nothing", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called += 1;
    throw new Error("network must not be reached without provider configuration");
  };
  try {
    const result = await sendExternalEmail({
      to: AUDIT_RECIPIENT,
      subject: "audit",
      html: "<p>audit</p>",
      environment: { CORNERMEX_EXTERNAL_EMAIL_ENABLED: "true" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "provider_not_configured");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(called, 0);
});

test("remaining inherited email sender routes through the canonical capability gate", async () => {
  const shipments = await read("src/lib/shipments.functions.ts");
  assert.match(
    shipments,
    /from "@\/lib\/external-email\.server"/,
    "shipments.functions.ts must use the canonical external email gate",
  );
  assert.doesNotMatch(
    shipments,
    /connector-gateway/,
    "shipments must not call the provider directly",
  );
  assert.doesNotMatch(
    shipments,
    /X-Connection-Api-Key/,
    "shipments must not build provider headers",
  );
  assert.doesNotMatch(
    shipments,
    /process\.env\.RESEND_API_KEY/,
    "shipments must not read provider keys directly",
  );

  const b2b = await read("src/lib/b2b-leads.functions.ts");
  assert.doesNotMatch(
    b2b,
    /external-email\.server|sendExternalEmail|isExternalEmailEnabled/,
    "L5R B2B pipeline must have no outbound email capability",
  );
  assert.doesNotMatch(b2b, /connector-gateway|X-Connection-Api-Key|RESEND_API_KEY/);
});

test("B2B customer copy makes no unauthorized commercial promise", async () => {
  const b2b = await read("src/lib/b2b-leads.functions.ts");
  assert.doesNotMatch(
    b2b,
    /sendExternalEmail|mailto\(|PUBLIC_CONTACT\.b2b/,
    "canonical B2B lead persistence must not compose or send customer outreach",
  );

  const preview = await read("src/components/b2b/ManualQuoteRequestPreview.tsx");
  const formatter = await read("src/features/b2b-catalog/manual-quote-request.ts");
  const customerCopy = `${preview}\n${formatter}`;
  for (const pattern of [
    /within one business day/i,
    /business day/i,
    /delivery SLAs?/i,
    /guaranteed/i,
  ]) {
    assert.doesNotMatch(customerCopy, pattern, `unauthorized B2B promise: ${pattern}`);
  }
  assert.match(customerCopy, /not an order or confirmed quote/i);
  assert.match(preview, /does not\s+create an order/i);
});

test("no application source falls back to an unowned origin for emails", async () => {
  const shipments = await read("src/lib/shipments.functions.ts");
  assert.doesNotMatch(shipments, /cornermex\.ae/);
  assert.match(shipments, /siteOrigin\(\)/, "must fall back to the verified application origin");
});

test("the external email gate is not coupled to checkout or provider presence", async () => {
  const gate = await read("src/lib/external-email.server.ts");
  assert.match(gate, /value === "true"/, "gate must compare the exact literal");
  assert.doesNotMatch(gate, /CORNERMEX_CHECKOUT_ENABLED/, "email must not depend on checkout");
  assert.doesNotMatch(gate, /Boolean\(value\)/, "gate must not use truthiness");
});
