import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PIPELINE_SCHEMA = [
  "account_id",
  "business_name",
  "emirate",
  "business_type",
  "website",
  "public_contact",
  "decision_maker",
  "qualification_score",
  "priority",
  "stage",
  "last_contact",
  "next_action",
  "owner",
  "source_url",
  "notes",
];

export const QUOTE_SCHEMA = [
  "quote_id",
  "account_id",
  "product",
  "presentation",
  "quantity",
  "unit_price_aed",
  "delivery_fee_aed",
  "vat_status",
  "availability",
  "valid_until",
  "payment_terms",
  "founder_approved",
  "status",
];

const KPI_SCHEMA = [
  "metric_id",
  "metric",
  "target",
  "current",
  "remaining",
  "status",
  "evidence_source",
  "last_updated",
  "notes",
];

const EMIRATES = new Set([
  "UNKNOWN",
  "ABU_DHABI",
  "DUBAI",
  "SHARJAH",
  "AJMAN",
  "UMM_AL_QUWAIN",
  "RAS_AL_KHAIMAH",
  "FUJAIRAH",
]);
const BUSINESS_TYPES = new Set([
  "UNKNOWN",
  "HOTEL",
  "RESTAURANT",
  "CAFE",
  "CATERER",
  "RETAILER",
  "DISTRIBUTOR",
  "CORPORATE_BUYER",
  "OTHER",
]);
const PRIORITIES = new Set(["UNASSIGNED", "P0", "P1", "P2", "P3"]);
const STAGES = new Set([
  "EMPTY",
  "PROSPECT_IDENTIFIED",
  "QUALIFIED",
  "OUTREACH_READY",
  "CONTACTED",
  "CONVERSATION",
  "MEETING_SCHEDULED",
  "MEETING_COMPLETED",
  "SAMPLE_REQUESTED",
  "SAMPLE_APPROVED",
  "SAMPLE_DECLINED",
  "SAMPLE_HANDOFF_RECORDED",
  "QUOTE_DRAFT",
  "QUOTE_PENDING_APPROVAL",
  "QUOTE_SENT",
  "NEGOTIATION",
  "ORDER_CONFIRMED",
  "DISQUALIFIED",
  "ON_HOLD",
]);
const QUOTE_STATUSES = new Set([
  "DRAFT",
  "PENDING_FOUNDER_APPROVAL",
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "VOID",
]);
const POST_APPROVAL_STATUSES = new Set(["APPROVED", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]);
const VAT_STATUSES = new Set([
  "UNKNOWN",
  "VAT_INCLUDED",
  "VAT_EXCLUDED",
  "VAT_NOT_APPLICABLE",
  "VAT_PENDING_REVIEW",
]);
const AVAILABILITY = new Set([
  "UNKNOWN",
  "PENDING_CONFIRMATION",
  "CONFIRMED_FOR_QUOTE",
  "NOT_AVAILABLE",
]);
const REQUIRED_POLICY_MARKERS = [
  "MANUAL_SEND_ONLY",
  "NO_EMAIL_AUTOMATION",
  "NO_WHATSAPP_API",
  "NO_REMOTE_WRITES",
  "NO_CHECKOUT_OR_PAYMENTS",
  "NO_INVENTORY_MUTATION",
  "NO_A3_2B",
  "NO_PUBLICATION",
];
const FORBIDDEN_AUTOMATION_MARKERS = [
  "AUTO_SEND_ENABLED",
  "AUTOMATION_ENABLED",
  "WEBHOOK_URL=",
  "CRON_ENABLED",
  "REMOTE_WRITE_ENABLED",
];
const UNKNOWN_FIELDS = [
  "business_name",
  "emirate",
  "business_type",
  "website",
  "public_contact",
  "decision_maker",
  "qualification_score",
  "last_contact",
  "next_action",
  "owner",
  "source_url",
  "notes",
];

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) fail("CM_GTM_1_CSV_INVALID", "unterminated quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length === 0) fail("CM_GTM_1_CSV_INVALID", "empty CSV");
  const headers = rows[0];
  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length)
      fail(
        "CM_GTM_1_CSV_INVALID",
        `row ${index + 2} has ${values.length} columns; expected ${headers.length}`,
      );
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
  return { headers, records };
}

export function serializeCsv(headers, records) {
  const encode = (value) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${[headers, ...records.map((record) => headers.map((header) => record[header]))].map((row) => row.map(encode).join(",")).join("\n")}\n`;
}

function assertSchema(actual, expected, label) {
  if (actual.join(",") !== expected.join(","))
    fail("CM_GTM_1_SCHEMA_INVALID", `${label} schema must match the contract exactly`);
}

function isUnknown(value) {
  return value === "UNKNOWN";
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validatePipeline(records) {
  if (records.length !== 30)
    fail("CM_GTM_1_ACCOUNT_COUNT_INVALID", `expected 30 account slots; found ${records.length}`);
  const activeAccounts = new Set();
  const names = new Set();
  records.forEach((record, index) => {
    const expectedId = `CM-GTM-${String(index + 1).padStart(3, "0")}`;
    if (record.account_id !== expectedId)
      fail("CM_GTM_1_ACCOUNT_ID_INVALID", `row ${index + 2} must be ${expectedId}`);
    if (!EMIRATES.has(record.emirate)) fail("CM_GTM_1_EMIRATE_INVALID", record.account_id);
    if (!BUSINESS_TYPES.has(record.business_type))
      fail("CM_GTM_1_BUSINESS_TYPE_INVALID", record.account_id);
    if (!PRIORITIES.has(record.priority)) fail("CM_GTM_1_PRIORITY_INVALID", record.account_id);
    if (!STAGES.has(record.stage)) fail("CM_GTM_1_STAGE_INVALID", record.account_id);
    if (!isUnknown(record.website) && !isHttpUrl(record.website))
      fail("CM_GTM_1_WEBSITE_INVALID", record.account_id);
    if (
      !isUnknown(record.qualification_score) &&
      (!/^\d+$/.test(record.qualification_score) || Number(record.qualification_score) > 100)
    )
      fail("CM_GTM_1_QUALIFICATION_SCORE_INVALID", record.account_id);
    if (!isUnknown(record.last_contact) && !/^\d{4}-\d{2}-\d{2}$/.test(record.last_contact))
      fail("CM_GTM_1_LAST_CONTACT_INVALID", record.account_id);

    if (record.stage === "EMPTY") {
      if (
        record.priority !== "UNASSIGNED" ||
        UNKNOWN_FIELDS.some((field) => !isUnknown(record[field]))
      )
        fail("CM_GTM_1_EMPTY_SLOT_NOT_FAIL_CLOSED", record.account_id);
      return;
    }

    activeAccounts.add(record.account_id);
    if (
      isUnknown(record.business_name) ||
      isUnknown(record.owner) ||
      isUnknown(record.next_action) ||
      record.priority === "UNASSIGNED"
    )
      fail("CM_GTM_1_ACTIVE_LEAD_INCOMPLETE", record.account_id);
    if (isUnknown(record.source_url) || !isHttpUrl(record.source_url))
      fail("CM_GTM_1_LEAD_PROVENANCE_REQUIRED", record.account_id);
    if (!record.notes.includes("BUSINESS_SOURCE_VERIFIED"))
      fail("CM_GTM_1_BUSINESS_PROVENANCE_REQUIRED", record.account_id);
    const normalizedName = record.business_name.trim().toLowerCase();
    if (names.has(normalizedName)) fail("CM_GTM_1_DUPLICATE_ACCOUNT", record.business_name);
    names.add(normalizedName);

    if (!isUnknown(record.public_contact)) {
      const contact = record.public_contact.trim();
      const validContact =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ||
        /^\+?[0-9 ()-]{7,20}$/.test(contact) ||
        isHttpUrl(contact);
      const fakeContact =
        /(?:example\.com|test@|fake|placeholder|john[ ._-]*doe|jane[ ._-]*doe|555|^\+?0+$)/i.test(
          contact,
        );
      if (!validContact || fakeContact)
        fail("CM_GTM_1_CONTACT_UNVERIFIED_OR_INVENTED", record.account_id);
      if (!record.notes.includes("CONTACT_SOURCE_VERIFIED"))
        fail("CM_GTM_1_CONTACT_PROVENANCE_REQUIRED", record.account_id);
    }
    if (
      !isUnknown(record.decision_maker) &&
      !record.notes.includes("DECISION_MAKER_SOURCE_VERIFIED")
    )
      fail("CM_GTM_1_DECISION_MAKER_PROVENANCE_REQUIRED", record.account_id);
  });
  return activeAccounts;
}

function validateNonNegativeAed(value, field, quoteId) {
  if (isUnknown(value)) return;
  if (/\b(?:USD|EUR|GBP|SAR|MXN)\b/i.test(value))
    fail("CM_GTM_1_QUOTE_CURRENCY_NOT_AED", `${quoteId}.${field}`);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    fail("CM_GTM_1_QUOTE_MONEY_INVALID", `${quoteId}.${field}`);
}

function validateQuotes(records, activeAccounts) {
  if (records.length !== 3)
    fail("CM_GTM_1_QUOTE_SLOT_COUNT_INVALID", `expected 3 quote slots; found ${records.length}`);
  let sentQuotes = 0;
  records.forEach((record, index) => {
    const expectedId = `CM-GTM-Q-${String(index + 1).padStart(3, "0")}`;
    if (record.quote_id !== expectedId)
      fail("CM_GTM_1_QUOTE_ID_INVALID", `row ${index + 2} must be ${expectedId}`);
    if (!QUOTE_STATUSES.has(record.status)) fail("CM_GTM_1_QUOTE_STATUS_INVALID", record.quote_id);
    if (!["true", "false"].includes(record.founder_approved))
      fail("CM_GTM_1_FOUNDER_APPROVAL_INVALID", record.quote_id);
    if (
      (record.status === "SENT" || POST_APPROVAL_STATUSES.has(record.status)) &&
      record.founder_approved !== "true"
    )
      fail("CM_GTM_1_QUOTE_SENT_WITHOUT_FOUNDER_APPROVAL", record.quote_id);
    if (
      !isUnknown(record.quantity) &&
      (!/^\d+$/.test(record.quantity) || Number(record.quantity) <= 0)
    )
      fail("CM_GTM_1_QUOTE_QUANTITY_INVALID", record.quote_id);
    validateNonNegativeAed(record.unit_price_aed, "unit_price_aed", record.quote_id);
    validateNonNegativeAed(record.delivery_fee_aed, "delivery_fee_aed", record.quote_id);
    if (!VAT_STATUSES.has(record.vat_status)) fail("CM_GTM_1_VAT_STATUS_INVALID", record.quote_id);
    if (!AVAILABILITY.has(record.availability))
      fail("CM_GTM_1_AVAILABILITY_INVALID", record.quote_id);
    if (!isUnknown(record.valid_until) && !/^\d{4}-\d{2}-\d{2}$/.test(record.valid_until))
      fail("CM_GTM_1_VALID_UNTIL_INVALID", record.quote_id);

    if (record.founder_approved === "true") {
      const required = [
        "account_id",
        "product",
        "presentation",
        "quantity",
        "unit_price_aed",
        "delivery_fee_aed",
        "vat_status",
        "availability",
        "valid_until",
        "payment_terms",
      ];
      if (required.some((field) => isUnknown(record[field])))
        fail("CM_GTM_1_APPROVED_QUOTE_INCOMPLETE", record.quote_id);
      if (!activeAccounts.has(record.account_id))
        fail("CM_GTM_1_QUOTE_ACCOUNT_NOT_ACTIVE", record.quote_id);
      if (!POST_APPROVAL_STATUSES.has(record.status))
        fail("CM_GTM_1_APPROVED_QUOTE_STATUS_INVALID", record.quote_id);
    }
    if (record.status === "SENT") sentQuotes += 1;
  });
  return sentQuotes;
}

function validateKpis(records) {
  const expected = [
    ["accounts", "30"],
    ["conversations", "10"],
    ["meetings", "5"],
    ["quotes", "3"],
    ["orders", "1"],
  ];
  if (records.length !== expected.length)
    fail("CM_GTM_1_KPI_COUNT_INVALID", `expected ${expected.length} KPI rows`);
  const current = {};
  records.forEach((record, index) => {
    const [metric, target] = expected[index];
    if (
      record.metric_id !== `CM-GTM-KPI-${String(index + 1).padStart(2, "0")}` ||
      record.metric !== metric ||
      record.target !== target
    )
      fail("CM_GTM_1_KPI_TARGET_INVALID", metric);
    if (!/^\d+$/.test(record.current) || Number(record.current) > Number(target))
      fail("CM_GTM_1_KPI_CURRENT_INVALID", metric);
    if (Number(record.remaining) !== Number(target) - Number(record.current))
      fail("CM_GTM_1_KPI_REMAINING_INVALID", metric);
    const expectedStatus =
      Number(record.current) === 0
        ? "NOT_STARTED"
        : Number(record.current) === Number(target)
          ? "TARGET_MET"
          : "IN_PROGRESS";
    if (record.status !== expectedStatus && record.status !== "BLOCKED")
      fail("CM_GTM_1_KPI_STATUS_INVALID", metric);
    if (
      Number(record.current) > 0 &&
      (isUnknown(record.evidence_source) ||
        !isHttpUrl(record.evidence_source) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(record.last_updated))
    )
      fail("CM_GTM_1_KPI_EVIDENCE_REQUIRED", metric);
    current[metric] = Number(record.current);
  });
  if (
    current.accounts < current.conversations ||
    current.conversations < current.meetings ||
    current.conversations < current.quotes ||
    current.quotes < current.orders
  )
    fail("CM_GTM_1_KPI_FUNNEL_INVALID", "current counts violate funnel ordering");
  return current;
}

function validatePolicyDocument(contents, label) {
  for (const marker of REQUIRED_POLICY_MARKERS)
    if (!contents.includes(marker)) fail("CM_GTM_1_POLICY_MARKER_MISSING", `${label}: ${marker}`);
  for (const marker of FORBIDDEN_AUTOMATION_MARKERS)
    if (contents.includes(marker)) fail("CM_GTM_1_UNAUTHORIZED_AUTOMATION", `${label}: ${marker}`);
}

export async function validateCmGtm1({ baseDir = process.cwd() } = {}) {
  const paths = {
    pipeline: "docs/gtm/CM-GTM-1_ACCOUNT_PIPELINE.csv",
    quotes: "docs/gtm/CM-GTM-1_QUOTE_TEMPLATE.csv",
    kpis: "docs/gtm/CM-GTM-1_KPI_SCOREBOARD.csv",
    outreach: "docs/gtm/CM-GTM-1_OUTREACH_LIBRARY.md",
    samples: "docs/gtm/CM-GTM-1_SAMPLE_WORKFLOW.md",
    decisions: "docs/gtm/CM-GTM-1_FOUNDER_DECISIONS.md",
  };
  const [pipelineText, quoteText, kpiText, outreach, samples, decisions] = await Promise.all(
    Object.values(paths).map((relative) => readFile(path.join(baseDir, relative), "utf8")),
  );
  const pipeline = parseCsv(pipelineText);
  const quotes = parseCsv(quoteText);
  const kpis = parseCsv(kpiText);
  assertSchema(pipeline.headers, PIPELINE_SCHEMA, "account pipeline");
  assertSchema(quotes.headers, QUOTE_SCHEMA, "quote template");
  assertSchema(kpis.headers, KPI_SCHEMA, "KPI scoreboard");
  const activeAccounts = validatePipeline(pipeline.records);
  const sentQuotes = validateQuotes(quotes.records, activeAccounts);
  const current = validateKpis(kpis.records);
  validatePolicyDocument(outreach, "outreach library");
  validatePolicyDocument(samples, "sample workflow");
  if (!decisions.includes("15 Wave 1 products") || !decisions.includes("Founder-approved"))
    fail(
      "CM_GTM_1_WAVE_1_APPROVAL_MISSING",
      "Founder decision record must preserve the approved Wave 1 scope",
    );
  return {
    status: "ok",
    accountSlots: pipeline.records.length,
    activeAccounts: activeAccounts.size,
    quoteSlots: quotes.records.length,
    sentQuotes,
    funnel: {
      target: { accounts: 30, conversations: 10, meetings: 5, quotes: 3, orders: 1 },
      current,
    },
  };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    console.log(JSON.stringify(await validateCmGtm1(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
