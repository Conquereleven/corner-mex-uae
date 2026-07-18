import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contract = JSON.parse(
  await readFile(path.join(root, "contracts/lovable-cloud-migration-ownership-v1.json"), "utf8"),
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
if (JSON.stringify(active) !== JSON.stringify(contract.activeCanonicalMigrations))
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

if (active.length !== 4)
  errors.push(`expected 4 applied canonical migrations, found ${active.length}`);
if (pending.length !== 1 || !pending[0].includes("catalog_import_foundation_a3_2b")) {
  errors.push("A3.2b pending canonical boundary is missing");
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
