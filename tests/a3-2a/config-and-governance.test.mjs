import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getCommerceSafetyStatus,
  validateCommerceEnvironment,
} from "../../src/config/commerce-env.ts";
import { scanContent } from "../../scripts/a3/privacy-guard.mjs";
import { validateCallbackInventory } from "../../scripts/a3/validate-callback-inventory.mjs";
import { validateFounderDecisions } from "../../scripts/a3/validate-founder-decisions.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("all production action flags default false", () => {
  const status = getCommerceSafetyStatus({});
  for (const field of [
    "checkoutEnabled",
    "externalEmailEnabled",
    "externalMessagesEnabled",
    "realPaymentExecutionEnabled",
    "automaticImportEnabled",
    "automaticInventorySyncEnabled",
    "openClawEnabled",
    "cornerOpsWriteEnabled",
  ])
    assert.equal(status[field], false);
});

test("malformed booleans and partial payment configuration fail closed", () => {
  const base = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" };
  assert.equal(
    validateCommerceEnvironment({ ...base, CORNERMEX_CHECKOUT_ENABLED: "yes" }).valid,
    false,
  );
  const payment = validateCommerceEnvironment({
    ...base,
    CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED: "true",
  });
  assert.equal(payment.valid, false);
  assert.ok(payment.errors.includes("payment_requires_checkout"));
  assert.ok(payment.errors.includes("payment_requires_STRIPE_SECRET_KEY"));
});

test("public secret variable and browser service-role use are rejected", async () => {
  const result = validateCommerceEnvironment({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public",
    VITE_SUPABASE_SERVICE_ROLE_KEY: "forbidden",
  });
  assert.equal(result.valid, false);
  const browserClient = await readFile("src/integrations/supabase/client.ts", "utf8");
  assert.doesNotMatch(browserClient, /SERVICE_ROLE/);
});

test("callback inventory is complete and fails closed on omissions or secrets", async () => {
  const original = await readJson("contracts/cornermex-callback-inventory-v1.json");
  assert.equal((await validateCallbackInventory(original)).entries, 12);
  for (const mutate of [
    (value) => value.entries.shift(),
    (value) => (value.entries[0].rollbackStep = ""),
    (value) => (value.entries[0].owner = ""),
    (value) => (value.entries[0].futureTarget = "whsec_" + "A".repeat(24)),
  ]) {
    const invalid = structuredClone(original);
    mutate(invalid);
    await assert.rejects(validateCallbackInventory(invalid));
  }
});

test("founder decisions remain explicit blockers", async () => {
  const original = await readJson("contracts/cornermex-founder-decisions-v1.json");
  const result = await validateFounderDecisions(original);
  assert.equal(result.readyForA3_2bReview, false);
  assert.equal(result.unanswered.length, 13);
  const missingOwner = structuredClone(original);
  missingOwner.decisions[0].owner = "";
  await assert.rejects(validateFounderDecisions(missingOwner));
});

test("new configuration canaries are detected without disclosure", () => {
  const railway = "RAILWAY_TOKEN=" + "R".repeat(24);
  const oauth = "OAUTH_CLIENT_SECRET=" + "O".repeat(24);
  const email = "RESEND_API_KEY=" + "E".repeat(24);
  const findings = scanContent("docs/activation/canary", [railway, oauth, email].join("\n"));
  assert.deepEqual(
    new Set(findings.map(({ category }) => category)),
    new Set(["railway_token", "oauth_client_secret", "email_provider_key"]),
  );
  const output = JSON.stringify(findings);
  for (const secret of [railway, oauth, email]) assert.equal(output.includes(secret), false);
});

test("empty secret placeholders do not consume the following environment line", () => {
  const template = [
    "RAILWAY_TOKEN=",
    "CORNERMEX_CHECKOUT_ENABLED=false",
    "OAUTH_CLIENT_SECRET=",
    "CORNERMEX_EXTERNAL_EMAIL_ENABLED=false",
    "RESEND_API_KEY=",
    "CORNERMEX_OPENCLAW_ENABLED=false",
  ].join("\n");
  assert.deepEqual(scanContent(".env.example", template), []);
});
