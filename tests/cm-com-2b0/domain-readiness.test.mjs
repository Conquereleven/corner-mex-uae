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
  assert.equal(state.platforms.railway.reobservedByCurrentSprint, false);
  assert.equal(state.platforms.railway.productionDeploymentPerformedByThisSprint, false);
  assert.equal(state.platforms.railway.productionDeploymentAuthorizedByThisSprint, false);

  const closure = state.program.completedSprints.find((s) => s.sprint.startsWith("CM-COM-2A"));
  assert.ok(closure, "CM-COM-2A closure must be recorded");
  assert.equal(closure.pullRequest, 23);
  assert.equal(closure.mergeSha, "acb1723095471786e904825042c1b9745f120504");
  assert.equal(closure.reviewedHeadSha, "f0dfbb71a8978583c78aed0181078aa25b36f8f7");
  assert.equal(closure.deployed, false, "CM-COM-2A must not be recorded as deployed");
  assert.equal(closure.founderVisualAcceptance.status, "approved");
});

test("the CM-COM-2A remediation sequence is exactly R1 rejected, R2 rejected, R3 approved", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  const closure = state.program.completedSprints.find((s) => s.sprint.startsWith("CM-COM-2A"));
  assert.deepEqual(
    closure.remediationRounds.map((r) => [r.round, r.independentReviewOutcome]),
    [
      ["R1", "rejected"],
      ["R2", "rejected"],
      ["R3", "approved"],
    ],
    "remediation history must record the exact review outcome per round",
  );
  assert.equal(closure.remediationRounds.find((r) => r.round === "R1").remediated, true);
  assert.equal(closure.remediationRounds.find((r) => r.round === "R2").remediated, true);
  assert.equal(closure.finalIndependentReviewRound, "R3");
  assert.equal(closure.founderVisualAcceptance.followedRound, "R3");

  const sprint = await read("docs/program/ACTIVE_SPRINT.md");
  assert.match(
    sprint,
    /R1 and R2 were each independently\s+rejected and remediated; R3 was independently approved/,
  );
});

test("the active sprint is not presented as independently reviewed or ready", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  const currentSprint = state.readiness.currentSprintReadiness;
  assert.ok(currentSprint, "current-sprint readiness must be recorded");
  assert.equal(currentSprint.sprint, "CM-COM-2B0_DOMAIN_READINESS");
  assert.equal(currentSprint.independentReviewComplete, false);
  assert.equal(currentSprint.declaredReady, false);
  assert.equal(currentSprint.reviewedHeadSha, null);
  assert.equal(currentSprint.status, "pending_independent_review");
  assert.equal(currentSprint.state, "draft");
  assert.match(state.readiness.scope, /A3\.2b/);
  assert.match(state.readiness.scope, /do NOT describe CM-COM-2B0/i);
});

test("evidence separates re-verified repository identity from carried-forward runtime identity", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  const ev = state.evidence;
  assert.equal(ev.class, "verified_repository");
  assert.equal(ev.repositoryEvidence.class, "verified_repository");
  assert.equal(ev.repositoryEvidence.verifiedBy, "CM-COM-2B0");
  assert.equal(
    ev.repositoryEvidence.identity,
    "github:acb1723095471786e904825042c1b9745f120504",
    "repository evidence identity must match current main",
  );
  assert.equal(ev.runtimeEvidence.class, "historical");
  assert.equal(ev.runtimeEvidence.observedBy, "CM-GOV-3");
  assert.equal(ev.runtimeEvidence.reobservedByCurrentSprint, false);
  assert.equal(ev.runtimeEvidence.currentRuntimeState, "unknown_not_reobserved");
  assert.equal(ev.sourceIdentity, undefined);
  assert.ok(
    !JSON.stringify(ev.repositoryEvidence).includes("77e5d24"),
    "repository identity must not carry the historical main SHA",
  );
});

test("current runtime state is recorded as unknown rather than asserted", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.equal(state.platforms.railway.productionServingCommit, "unknown_not_reobserved");
  assert.equal(state.platforms.railway.stagingServingCommit, "unknown_not_reobserved");
  assert.equal(state.readiness.runtime.currentStatus, "unknown_not_reobserved");
  assert.doesNotMatch(
    state.platforms.railway.note,
    /production does NOT run current main/i,
    "unobserved current runtime must not be asserted",
  );
  assert.match(state.platforms.railway.note, /UNKNOWN/);
});

test("generatedAt is a repository-reconciliation time, distinct from runtime observation", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.match(state.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.match(state.generatedAtMeaning, /NOT a runtime observation timestamp/i);
  assert.notEqual(state.generatedAt, state.evidence.runtimeEvidence.observedAt);
});

test("deployment registry separates repository source from deployed source", async () => {
  const registry = JSON.parse(await read("docs/program/DEPLOYMENT_REGISTRY.json"));
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.equal(registry.currentSourceCommit, state.authority.observedMainSha);
  assert.match(registry.currentSourceCommitMeaning, /REPOSITORY current source/);
  assert.match(registry.currentSourceCommitMeaning, /NOT deployed source/i);
  const production = registry.governance.contexts.find((c) => c.environment === "production");
  assert.ok(production, "production context must be declared");
  assert.notEqual(
    production.currentSourceSha,
    registry.currentSourceCommit,
    "deployed production SHA is currently behind main; the two fields must stay distinct",
  );
});

test("safety and commercial gates remain closed in program state", async () => {
  const state = JSON.parse(await read("docs/program/CURRENT_STATE.json"));
  assert.equal(state.safety.writesBlocked, true);
  assert.equal(state.safety.externalSendsBlocked, true);
  assert.equal(state.safety.customerImpactBlocked, true);
  assert.equal(state.platforms.supabase.writePerformed, false);
  assert.equal(state.platforms.lovable.writePerformed, false);
});

// ---------------------------------------------------------------------------
// CM-COM-2B0-R1: SSR vs browser canonical origin precedence (§8)
// ---------------------------------------------------------------------------

test("browser origin takes precedence over the server canonical override", async () => {
  // Proven behaviourally: siteOrigin() consults window first, so the env
  // override governs SSR output but is bypassed in the browser. This is why a
  // domain cutover cannot rely on the variable alone for canonical determinism.
  const { siteOrigin: resolve } = await import("../../src/lib/site-url.ts?precedence");
  const originalWindow = globalThis.window;
  const originalValue = process.env.CORNERMEX_PUBLIC_APPLICATION_URL;
  process.env.CORNERMEX_PUBLIC_APPLICATION_URL = "https://override.example.invalid";
  try {
    // SSR context: no window => override wins.
    assert.equal(globalThis.window, undefined);
    assert.equal(resolve(), "https://override.example.invalid");

    // Browser context: window present => browser origin wins, override ignored.
    globalThis.window = { location: { origin: "https://browser.example.invalid" } };
    assert.equal(
      resolve(),
      "https://browser.example.invalid",
      "the env override must NOT win once a browser origin exists",
    );
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalValue === undefined) delete process.env.CORNERMEX_PUBLIC_APPLICATION_URL;
    else process.env.CORNERMEX_PUBLIC_APPLICATION_URL = originalValue;
  }
});

test("the SSR-vs-browser divergence is recorded as a cutover preflight, not assumed away", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  assert.match(readiness, /SSR vs browser semantics — verified/);
  // The uncertainty about router head() recomputation must stay explicit.
  assert.match(readiness, /P1 — Does route metadata recompute on client-side navigation\?/);
  assert.match(readiness, /was \*\*not\*\* determined in\s*\n?\s*this sprint/);
  // P2 must record that the env override alone is NOT deterministic.
  assert.match(
    readiness,
    /P2 — Is `CORNERMEX_PUBLIC_APPLICATION_URL` a deterministic canonical origin\?/,
  );
  assert.match(readiness, /P2 —[\s\S]{0,400}only consulted when `window` is undefined/);
  assert.match(readiness, /P2 —[\s\S]{0,400}bypassed in the browser/);
});

test("the runbook puts the OAuth allow-list before any DNS change", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  const allowList = readiness.indexOf("Update the Supabase Auth redirect allow-list");
  const dnsRecords = readiness.indexOf("Create DNS records as Railway specifies");
  const binding = readiness.indexOf("Bind the Railway custom domain");
  assert.ok(allowList > 0 && dnsRecords > 0 && binding > 0, "runbook steps must be present");
  assert.ok(
    allowList < dnsRecords && allowList < binding,
    "the Auth allow-list must precede DNS records and custom-domain binding",
  );
  assert.match(readiness, /BEFORE any DNS change makes the new host\s*\n?\s*reachable/i);
});

test("the runbook models the code release lifecycle and dual-layer rollback", async () => {
  const readiness = await read("docs/program/CM-COM-2B0_DOMAIN_READINESS.md");
  // Source changes must go through review/merge/deploy, not a platform toggle.
  assert.match(readiness, /Prepare the exact-domain \*\*code delta\*\*/);
  assert.match(readiness, /Independent review of that delta/);
  assert.match(readiness, /Deploy the merged code delta to production under a separate deployment/);
  assert.match(
    readiness,
    /cannot change in\s*\n?\s*production by editing DNS or a Railway variable/,
  );
  // Rollback must cover both platform and deployed source.
  assert.match(readiness, /Rollback — platform AND source/);
  assert.match(readiness, /Revert the exact-domain code delta/);
});
