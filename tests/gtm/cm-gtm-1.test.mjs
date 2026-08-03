import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCsv, serializeCsv, validateCmGtm1 } from "../../scripts/gtm/validate-cm-gtm-1.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function fixture() {
  const baseDir = await mkdtemp(path.join(tmpdir(), "cm-gtm-1-"));
  await cp(path.join(ROOT, "docs"), path.join(baseDir, "docs"), { recursive: true });
  return baseDir;
}

async function mutateCsv(baseDir, filename, mutate) {
  const target = path.join(baseDir, "docs/gtm", filename);
  const { headers, records } = parseCsv(await readFile(target, "utf8"));
  mutate(records);
  await writeFile(target, serializeCsv(headers, records));
}

async function rejectsCode(baseDir, code) {
  await assert.rejects(validateCmGtm1({ baseDir }), (error) =>
    error.message.startsWith(`${code}:`),
  );
}

test("accepts the fail-closed 30-account, three-quote baseline", async () => {
  const result = await validateCmGtm1({ baseDir: ROOT });
  assert.deepEqual(result, {
    status: "ok",
    accountSlots: 30,
    activeAccounts: 0,
    quoteSlots: 3,
    sentQuotes: 0,
    funnel: {
      target: { accounts: 30, conversations: 10, meetings: 5, quotes: 3, orders: 1 },
      current: { accounts: 0, conversations: 0, meetings: 0, quotes: 0, orders: 0 },
    },
  });
});

test("rejects invented or placeholder public contacts", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_ACCOUNT_PIPELINE.csv", ([lead]) =>
    Object.assign(lead, {
      business_name: "Verified Business",
      priority: "P1",
      stage: "PROSPECT_IDENTIFIED",
      owner: "Founder",
      next_action: "Manual review",
      source_url: "https://verified.invalid/source",
      public_contact: "https://example.com/contact",
      notes: "BUSINESS_SOURCE_VERIFIED CONTACT_SOURCE_VERIFIED",
    }),
  );
  await rejectsCode(baseDir, "CM_GTM_1_CONTACT_UNVERIFIED_OR_INVENTED");
});

test("rejects active leads without source provenance", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_ACCOUNT_PIPELINE.csv", ([lead]) =>
    Object.assign(lead, {
      business_name: "Observed Business",
      priority: "P1",
      stage: "PROSPECT_IDENTIFIED",
      owner: "Founder",
      next_action: "Verify source",
    }),
  );
  await rejectsCode(baseDir, "CM_GTM_1_LEAD_PROVENANCE_REQUIRED");
});

test("rejects active leads without an explicit business-source verification record", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_ACCOUNT_PIPELINE.csv", ([lead]) =>
    Object.assign(lead, {
      business_name: "Observed Business",
      priority: "P1",
      stage: "PROSPECT_IDENTIFIED",
      owner: "Founder",
      next_action: "Verify source",
      source_url: "https://source.invalid/business",
      notes: "Public page captured",
    }),
  );
  await rejectsCode(baseDir, "CM_GTM_1_BUSINESS_PROVENANCE_REQUIRED");
});

test("rejects invalid commercial stages", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_ACCOUNT_PIPELINE.csv", ([lead]) => {
    lead.stage = "AUTO_CONTACTED";
  });
  await rejectsCode(baseDir, "CM_GTM_1_STAGE_INVALID");
});

test("rejects SENT quotes without Founder approval before other send checks", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_QUOTE_TEMPLATE.csv", ([quote]) => {
    quote.status = "SENT";
  });
  await rejectsCode(baseDir, "CM_GTM_1_QUOTE_SENT_WITHOUT_FOUNDER_APPROVAL");
});

for (const [field, value, code] of [
  ["quantity", "-1", "CM_GTM_1_QUOTE_QUANTITY_INVALID"],
  ["unit_price_aed", "-1", "CM_GTM_1_QUOTE_MONEY_INVALID"],
  ["delivery_fee_aed", "-0.01", "CM_GTM_1_QUOTE_MONEY_INVALID"],
  ["unit_price_aed", "USD 12", "CM_GTM_1_QUOTE_CURRENCY_NOT_AED"],
])
  test(`rejects invalid quote ${field} value ${value}`, async () => {
    const baseDir = await fixture();
    await mutateCsv(baseDir, "CM-GTM-1_QUOTE_TEMPLATE.csv", ([quote]) => {
      quote[field] = value;
    });
    await rejectsCode(baseDir, code);
  });

test("rejects approved quote data unless the quote is complete and tied to an active lead", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_QUOTE_TEMPLATE.csv", ([quote]) =>
    Object.assign(quote, { founder_approved: "true", status: "APPROVED" }),
  );
  await rejectsCode(baseDir, "CM_GTM_1_APPROVED_QUOTE_INCOMPLETE");
});

test("rejects KPI progress without evidence", async () => {
  const baseDir = await fixture();
  await mutateCsv(baseDir, "CM-GTM-1_KPI_SCOREBOARD.csv", ([account]) =>
    Object.assign(account, { current: "1", remaining: "29", status: "IN_PROGRESS" }),
  );
  await rejectsCode(baseDir, "CM_GTM_1_KPI_EVIDENCE_REQUIRED");
});

test("rejects unauthorized automation markers in manual workflows", async () => {
  const baseDir = await fixture();
  const target = path.join(baseDir, "docs/gtm/CM-GTM-1_OUTREACH_LIBRARY.md");
  await writeFile(target, `${await readFile(target, "utf8")}\nAUTO_SEND_ENABLED\n`);
  await rejectsCode(baseDir, "CM_GTM_1_UNAUTHORIZED_AUTOMATION");
});

test("validator source stays local and read-only", async () => {
  const source = await readFile(path.join(ROOT, "scripts/gtm/validate-cm-gtm-1.mjs"), "utf8");
  for (const forbidden of [
    "node:http",
    "node:https",
    "child_process",
    "fetch(",
    "createClient(",
    "writeFile(",
    "appendFile(",
  ])
    assert.equal(source.includes(forbidden), false, forbidden);
});
