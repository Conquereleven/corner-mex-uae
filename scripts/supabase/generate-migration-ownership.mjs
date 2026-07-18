import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const legacyDir = path.join(root, "supabase/legacy-lovable");
const activeDir = path.join(root, "supabase/migrations");
const pendingDir = path.join(root, "supabase/pending-canonical");
const output = path.join(root, "contracts/lovable-cloud-migration-ownership-v1.json");
const julyHardening = new Set([
  "20260716211510_55693588-9ba2-4bc5-99f3-26955db02981.sql",
  "20260716211529_171c3105-811f-4a6b-be3a-f3ff6a1a8890.sql",
]);

const sqlFiles = async (directory) =>
  (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
const digest = (text) => createHash("sha256").update(text).digest("hex");

const migrations = [];
for (const filename of await sqlFiles(legacyDir)) {
  const sql = await readFile(path.join(legacyDir, filename), "utf8");
  migrations.push({
    filename,
    sha256: digest(sql),
    databaseOwner: "lovable_cloud_db",
    lovableProjectId: "d9495376-339d-44dd-9c8a-db0f7b451f96",
    applicationStatus: julyHardening.has(filename)
      ? "verified_applied_to_lovable_cloud_db"
      : "live_history_attributed_not_individually_verified",
    purpose: julyHardening.has(filename)
      ? "legitimate_lovable_cloud_security_hardening"
      : "lovable_cloud_schema_history",
    sourceEvidence: julyHardening.has(filename)
      ? "fable5_live_acl_verification_and_git_history"
      : "git_history_and_fable5_live_schema_corroboration",
    containsRls: /row level security|create\s+policy/i.test(sql),
    containsGrant: /\bgrant\b/i.test(sql),
    containsRevoke: /\brevoke\b/i.test(sql),
    containsSecurityDefiner: /security\s+definer/i.test(sql),
    mustNotApplyToCanonicalCornerMex: true,
  });
}

const contract = {
  contractVersion: "lovable-cloud-migration-ownership-v1",
  canonicalProjectRef: "wlrfknmrhowldygmvtvn",
  lovableCloudProjectId: "d9495376-339d-44dd-9c8a-db0f7b451f96",
  quarantineDirectory: "supabase/legacy-lovable",
  activeCanonicalMigrations: await sqlFiles(activeDir),
  pendingCanonicalMigrations: await sqlFiles(pendingDir),
  migrations,
};

await writeFile(output, `${JSON.stringify(contract, null, 2)}\n`);
console.log(`migration ownership manifest written: ${migrations.length} quarantined files`);
