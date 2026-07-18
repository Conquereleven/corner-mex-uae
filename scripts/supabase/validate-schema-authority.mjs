import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const checks = [
  "scripts/supabase/validate-migration-ownership.mjs",
  "scripts/supabase/validate-canonical-types.mjs",
  "scripts/supabase/validate-application-schema-references.mjs",
];
for (const check of checks) execFileSync(process.execPath, [check], { stdio: "inherit" });

const securityDefinerEvidence = JSON.parse(
  await readFile("contracts/security-definer-evidence-v1.json", "utf8"),
);
for (const entry of securityDefinerEvidence.functions) {
  for (const field of [
    "identity",
    "owner",
    "searchPath",
    "callerIdentitySource",
    "executionGrants",
    "mutationScope",
    "rlsImplications",
  ]) {
    if (!entry[field])
      throw new Error(
        `incomplete SECURITY DEFINER evidence: ${entry.identity ?? "unknown"}.${field}`,
      );
  }
}

const sensitivePatterns = [/service_role/i, /sb_secret_/i, /SUPABASE_SERVICE_ROLE_KEY/];
const browserFiles = ["src/integrations/supabase/client.ts", "src/integrations/supabase/types.ts"];
for (const file of browserFiles) {
  const source = await readFile(file, "utf8");
  for (const pattern of sensitivePatterns) {
    if (pattern.test(source))
      throw new Error(`sensitive server credential reference in browser surface: ${file}`);
  }
}
console.log("schema authority valid: canonical DB2 only; browser secret checks passed");
