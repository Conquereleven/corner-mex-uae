import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contract = JSON.parse(
  await readFile(path.join(root, "contracts/lovable-cloud-migration-ownership-v1.json"), "utf8"),
);
const extensions = JSON.parse(
  await readFile(
    path.join(root, "contracts/canonical-active-migration-extensions-v1.json"),
    "utf8",
  ),
);
const files = async (dir) =>
  (await readdir(path.join(root, dir))).filter((name) => name.endsWith(".sql")).sort();
const active = await files("supabase/migrations");
const legacy = await files("supabase/legacy-lovable");
const pending = await files("supabase/pending-canonical");
const errors = [];
const canonical = JSON.parse(
  await readFile(
    path.join(root, "contracts/canonical-supabase-schema-fingerprint-v1.json"),
    "utf8",
  ),
);

if (contract.canonicalProjectRef !== "wlrfknmrhowldygmvtvn")
  errors.push("canonical project mismatch");
if (extensions.canonicalProjectRef !== contract.canonicalProjectRef)
  errors.push("canonical migration extension project mismatch");
if (extensions.contractVersion !== "canonical-active-migration-extensions-v1")
  errors.push("canonical migration extension version mismatch");

const EXPECTED_EXTENSION_PRODUCTION_MIGRATIONS = new Map([
  [
    "20260820100000_cm_launch_1_l3p_admin_product_management.sql",
    {
      version: "20260820204004",
      name: "cm_launch_1_l3p_admin_product_management",
    },
  ],
  [
    "20260820210000_cm_launch_1_l5r_canonical_b2b_lead_pipeline.sql",
    {
      version: "20260820225944",
      name: "cm_launch_1_l5r_canonical_b2b_lead_pipeline",
    },
  ],
  [
    "20260820213000_cm_launch_1_l5r_pipeline_operations.sql",
    {
      version: "20260820230032",
      name: "cm_launch_1_l5r_pipeline_operations",
    },
  ],
  [
    "20260820214500_cm_launch_1_l5r_quote_draft_integrity.sql",
    {
      version: "20260820230100",
      name: "cm_launch_1_l5r_quote_draft_integrity",
    },
  ],
  [
    "20260821023000_cm_launch_1_l5r_b2b_intake_anti_abuse.sql",
    {
      version: "20260821033221",
      name: "cm_launch_1_l5r_b2b_intake_anti_abuse",
    },
  ],
  [
    "20260822034500_sec_rls_1_b2b_private_rls.sql",
    {
      version: "20260823004146",
      name: "sec_rls_1_b2b_private_rls",
    },
  ],
]);

const extensionMigrations = (extensions.migrations ?? []).map((item) => item.filename).sort();
const extensionProductionMigrations = [];
for (const item of extensions.migrations ?? []) {
  if (item.owner !== "canonical_cornermex")
    errors.push(`invalid canonical extension owner: ${item.filename}`);
  if (item.requiresFounderProductionGate !== true)
    errors.push(`canonical extension lacks Founder production gate: ${item.filename}`);

  const expectedProduction = EXPECTED_EXTENSION_PRODUCTION_MIGRATIONS.get(item.filename);
  if (item.productionApplied === true) {
    if (!expectedProduction) {
      errors.push(`unverified canonical extension claims production application: ${item.filename}`);
    } else {
      if (item.productionVersion !== expectedProduction.version) {
        errors.push(`canonical extension production version mismatch: ${item.filename}`);
      }
      if (item.purpose !== expectedProduction.name) {
        errors.push(`canonical extension production name mismatch: ${item.filename}`);
      }
      if (item.productionProjectRef !== extensions.canonicalProjectRef) {
        errors.push(`canonical extension production project mismatch: ${item.filename}`);
      }
    }

    if (typeof item.productionVersion === "string" && typeof item.purpose === "string") {
      extensionProductionMigrations.push([item.productionVersion, item.purpose]);
    }
  } else if (item.productionApplied === false) {
    if (expectedProduction) {
      errors.push(
        `verified canonical extension is not marked production applied: ${item.filename}`,
      );
    }
    if ("productionVersion" in item || "productionProjectRef" in item) {
      errors.push(`unapplied canonical extension carries production evidence: ${item.filename}`);
    }
  } else {
    errors.push(`canonical extension productionApplied must be boolean: ${item.filename}`);
  }
}
for (const filename of EXPECTED_EXTENSION_PRODUCTION_MIGRATIONS.keys()) {
  if (!(extensions.migrations ?? []).some((item) => item.filename === filename)) {
    errors.push(`verified canonical production extension missing: ${filename}`);
  }
}
if (new Set(extensionMigrations).size !== extensionMigrations.length)
  errors.push("duplicate canonical migration extension");

const expectedActive = [...contract.activeCanonicalMigrations, ...extensionMigrations].sort();
if (JSON.stringify(active) !== JSON.stringify(expectedActive))
  errors.push("active migration set drift");
if (JSON.stringify(pending) !== JSON.stringify(contract.pendingCanonicalMigrations))
  errors.push("pending migration set drift");
if (JSON.stringify(legacy) !== JSON.stringify(contract.migrations.map((item) => item.filename)))
  errors.push("quarantine set drift");

for (const item of contract.migrations) {
  if (item.databaseOwner !== "lovable_cloud_db" || item.mustNotApplyToCanonicalCornerMex !== true) {
    errors.push(`ambiguous owner: ${item.filename}`);
  }
  if (active.includes(item.filename)) errors.push(`quarantined migration active: ${item.filename}`);
  const sql = await readFile(path.join(root, contract.quarantineDirectory, item.filename), "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");
  if (hash !== item.sha256) errors.push(`checksum drift: ${item.filename}`);
}

if (active.length !== expectedActive.length)
  errors.push(
    `expected ${expectedActive.length} active canonical source migrations, found ${active.length}`,
  );

const REQUIRED_PENDING = ["catalog_import_foundation_a3_2b"];
if (pending.length !== REQUIRED_PENDING.length) {
  errors.push("pending canonical migration count drift");
}
for (const required of REQUIRED_PENDING) {
  if (!pending.some((name) => name.includes(required))) {
    errors.push(`pending canonical boundary is missing: ${required}`);
  }
}

const EXPECTED_PRODUCTION_MIGRATIONS = [
  ["20260713223138", "revoke_public_rls_auto_enable_execution_a1"],
  ["20260713230958", "commerce_foundation_a2"],
  ["20260713231133", "private_admin_boundary_a2"],
  ["20260713234156", "public_read_policy_boundary_a2"],
  ["20260809221200", "place_cod_order_v1"],
  ["20260819181510", "cm_com_4a_post_order_lifecycle"],
  ["20260819202909", "cm_launch_1_lifecycle_acl_hardening"],
  ["20260819215938", "cm_launch_1_notifications_canonical"],
  ["20260820204004", "cm_launch_1_l3p_admin_product_management"],
  ["20260820225944", "cm_launch_1_l5r_canonical_b2b_lead_pipeline"],
  ["20260820230032", "cm_launch_1_l5r_pipeline_operations"],
  ["20260820230100", "cm_launch_1_l5r_quote_draft_integrity"],
  ["20260821033221", "cm_launch_1_l5r_b2b_intake_anti_abuse"],
  ["20260823004146", "sec_rls_1_b2b_private_rls"],
];
const recordedProductionMigrations = [
  ...(contract.canonicalProductionMigrations ?? []).map(({ version, name }) => [version, name]),
  ...extensionProductionMigrations,
].sort(([a], [b]) => a.localeCompare(b));
const expectedProductionMigrations = [...EXPECTED_PRODUCTION_MIGRATIONS].sort(([a], [b]) =>
  a.localeCompare(b),
);
if (JSON.stringify(recordedProductionMigrations) !== JSON.stringify(expectedProductionMigrations)) {
  errors.push("canonical production migration history drift");
}
if (
  new Set(recordedProductionMigrations.map(([version]) => version)).size !==
  recordedProductionMigrations.length
) {
  errors.push("duplicate canonical production migration version");
}
if (
  new Set(recordedProductionMigrations.map(([, name]) => name)).size !==
  recordedProductionMigrations.length
) {
  errors.push("duplicate canonical production migration name");
}
for (const record of contract.canonicalProductionMigrations ?? []) {
  if (!Array.isArray(record.sourceFiles) || record.sourceFiles.length === 0) {
    errors.push(`canonical production migration source missing: ${record.name}`);
    continue;
  }
  for (const filename of record.sourceFiles) {
    if (!active.includes(filename)) {
      errors.push(`canonical production migration source is not active: ${filename}`);
    }
  }
}
for (const item of extensions.migrations ?? []) {
  if (item.productionApplied === true && !active.includes(item.filename)) {
    errors.push(`canonical extension production source is not active: ${item.filename}`);
  }
}

const activeSql = (
  await Promise.all(
    active.map((filename) => readFile(path.join(root, "supabase/migrations", filename), "utf8")),
  )
).join("\n");
const createdPublicTables = [...activeSql.matchAll(/create\s+table\s+public\.([a-z0-9_]+)/gi)]
  .map((match) => match[1])
  .sort();
if (JSON.stringify(createdPublicTables) !== JSON.stringify([...canonical.publicTables].sort())) {
  errors.push(`active SQL public table identity mismatch: ${JSON.stringify(createdPublicTables)}`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `migration ownership valid: active=${active.length}, pending=${pending.length}, quarantined=${legacy.length}`,
);
