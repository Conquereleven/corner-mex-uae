import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { siteOrigin, siteUrl } from "../../src/lib/site-url.ts";
import { PRIMARY_PUBLIC_EMAIL } from "../../src/lib/public-contact.ts";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p) => readFile(path.join(root, p), "utf8");

// Composed so this file commits no raw address literal (A3 privacy guard).
const UNOWNED_DOMAIN = ["cornermex", "ae"].join(".");
const RAILWAY_ORIGIN = "https://corner-mex-uae-production.up.railway.app";

async function sourceFiles(dir) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

// ---------------------------------------------------------------------------
// Canonical origin authority stays centralized and falls back safely
// ---------------------------------------------------------------------------

test("the verified Railway origin remains the fallback before any cutover", () => {
  // No browser origin and no override configured => verified Railway origin.
  assert.equal(siteOrigin(), RAILWAY_ORIGIN);
  assert.equal(siteUrl("/"), `${RAILWAY_ORIGIN}/`);
  assert.equal(siteUrl("/delivery"), `${RAILWAY_ORIGIN}/delivery`);
});

test("canonical origin authority is centralized in one module", async () => {
  const files = await sourceFiles("src");
  for (const file of files) {
    if (file.endsWith("site-url.ts")) continue;
    const text = await readFile(file, "utf8");
    const relative = path.relative(root, file);
    // Only site-url.ts may name the verified origin; everyone else derives it.
    assert.ok(
      !text.includes("corner-mex-uae-production.up.railway.app"),
      `origin literal outside site-url.ts: ${relative}`,
    );
  }
});

test("a partial source edit cannot activate a custom domain", async () => {
  // Activation requires the runtime override, not a source literal. No source
  // file may hardcode an https origin as the canonical site origin.
  const siteUrlSource = await read("src/lib/site-url.ts");
  assert.match(siteUrlSource, /CORNERMEX_PUBLIC_APPLICATION_URL/);
  assert.match(siteUrlSource, /VERIFIED_PUBLIC_ORIGIN/);
  // The fallback constant must be the Railway origin, not a speculative domain.
  assert.match(
    siteUrlSource,
    new RegExp(
      `VERIFIED_PUBLIC_ORIGIN\\s*=\\s*"${RAILWAY_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
    ),
  );
  assert.ok(!siteUrlSource.includes(UNOWNED_DOMAIN), "site-url must not name the unowned domain");
});

// ---------------------------------------------------------------------------
// The unapproved domain cannot return as active
// ---------------------------------------------------------------------------

test("no application source presents the unapproved domain as an active origin", async () => {
  const files = await sourceFiles("src");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.ok(
      !new RegExp(`https?://(?:www\\.)?${UNOWNED_DOMAIN.replace(".", "\\.")}`).test(text),
      `unapproved domain used as an origin in ${path.relative(root, file)}`,
    );
  }
});

test("the legal website field stays pending until an authorized cutover", async () => {
  const legal = await read("src/lib/legal-docs.ts");
  assert.match(legal, /PENDING CUSTOM DOMAIN ACTIVATION/);
  assert.doesNotMatch(legal, /Website: https:\/\//, "no branded website may be claimed");
});

test("robots and sitemap remain coherent with the pre-cutover origin", async () => {
  const robots = await read("public/robots.txt");
  assert.match(
    robots,
    new RegExp(`Sitemap: ${RAILWAY_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml`),
  );
  assert.ok(!robots.includes(UNOWNED_DOMAIN), "robots must not reference the unapproved domain");
  assert.doesNotMatch(robots, /lovable\.app/);

  // Both sitemaps derive absolute URLs from the REQUEST origin, not siteUrl().
  // That is a distinct origin authority and must stay that way knowingly: it
  // follows the serving host, so it cannot silently emit an unapproved domain.
  for (const file of ["src/routes/sitemap[.]xml.ts", "src/routes/api/public/sitemap[.]xml.ts"]) {
    const text = await read(file);
    assert.match(
      text,
      /new URL\(request\.url\)\.origin/,
      `${file} must derive URLs from the request origin`,
    );
    assert.ok(!text.includes(UNOWNED_DOMAIN), `${file} must not name the unapproved domain`);
  }
});

// ---------------------------------------------------------------------------
// Web-domain state and email-domain state cannot be conflated
// ---------------------------------------------------------------------------

test("public contact does not depend on the web domain", async () => {
  // The temporary mailbox is on an unrelated provider domain and must not be
  // derived from, or invalidated by, the web origin.
  assert.ok(!PRIMARY_PUBLIC_EMAIL.includes(UNOWNED_DOMAIN));
  assert.ok(!PRIMARY_PUBLIC_EMAIL.includes("railway.app"));
  const contactSource = await read("src/lib/public-contact.ts");
  assert.ok(
    !/siteOrigin|siteUrl|CORNERMEX_PUBLIC_APPLICATION_URL/.test(contactSource),
    "the contact registry must not derive addresses from the web origin",
  );
});

test("readiness documentation keeps web-domain and email-domain status separate", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  assert.match(readiness, /Email-domain status, recorded separately from web-domain status/i);
  assert.match(readiness, /must never be conflated/i);
});

// ---------------------------------------------------------------------------
// Cutover remains blocked and documented
// ---------------------------------------------------------------------------

test("CM-COM-2B1 is recorded as blocked with a complete approval contract", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  assert.match(readiness, /CM-COM-2B1[\s\S]{0,200}BLOCKED/i);
  for (const requirement of [
    /Exact domain string/i,
    /Founder approval/i,
    /Ownership\/control attestation/i,
    /custody/i,
    /Apex vs/i,
    /Canonical application URL decision/i,
    /Rollback origin/i,
    /OAuth redirect impact/i,
    /Sitemap\/robots impact/i,
    /TLS readiness/i,
  ]) {
    assert.match(readiness, requirement, `approval contract missing: ${requirement}`);
  }
  // Credentials must never be required by the contract.
  assert.match(readiness, /never\*{0,2}\s*commit registrar passwords/i);
});

test("the runbook records the manual robots step and the OAuth allow-list dependency", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  assert.match(readiness, /robots\.txt[\s\S]{0,120}by hand/i);
  assert.match(readiness, /allow-list/i);
  assert.match(readiness, /window\.location\.origin/);
});

test("pre-activation email debt stays visible", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  assert.match(readiness, /skipped/i);
  assert.match(readiness, /sendOrderEmail/);
  assert.match(readiness, /opaque/i);
});

// ---------------------------------------------------------------------------
// Program state truthfulness
// ---------------------------------------------------------------------------

test("program state records current main and does not claim PR #23 is deployed", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.equal(state.authority.expectedMainSha, state.authority.observedMainSha);
  assert.equal(
    state.authority.observedMainSha,
    "acb1723095471786e904825042c1b9745f120504",
    "program state must record the PR #23 merge commit as main",
  );
  assert.equal(state.program.activeSprint, "CM-COM-2B0_DOMAIN_READINESS");
  assert.equal(state.platforms.railway.currentMainDeployedToProduction, false);
  assert.equal(state.platforms.railway.reobservedByCurrentSprint, false);

  const closure = state.program.completedSprints.find((s) => s.sprint.startsWith("CM-COM-2A"));
  assert.ok(closure, "CM-COM-2A closure must be recorded");
  assert.equal(closure.pullRequest, 23);
  assert.equal(closure.mergeSha, "acb1723095471786e904825042c1b9745f120504");
  assert.equal(closure.reviewedHeadSha, "f0dfbb71a8978583c78aed0181078aa25b36f8f7");
  assert.equal(closure.deployed, false, "CM-COM-2A must not be recorded as deployed");
  assert.equal(closure.founderVisualAcceptance.status, "approved");
  // The rejection trail must not be erased.
  assert.ok(closure.remediationRounds.some((r) => /rejected/i.test(r)));
});

test("safety and commercial gates remain closed in program state", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.equal(state.safety.writesBlocked, true);
  assert.equal(state.safety.externalSendsBlocked, true);
  assert.equal(state.safety.customerImpactBlocked, true);
  assert.equal(state.platforms.supabase.writePerformed, false);
  assert.equal(state.platforms.lovable.writePerformed, false);
});
