import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const path = "contracts/application-schema-reference-baseline-v1.json";
execFileSync(
  process.execPath,
  ["scripts/supabase/generate-application-schema-reference-baseline.mjs", "--check"],
  { stdio: "ignore" },
);
const contract = JSON.parse(await readFile(path, "utf8"));
const allowed = new Set([
  "canonical_supported",
  "lovable_live_only",
  "unreachable_legacy",
  "requires_future_migration",
]);
for (const reference of contract.references) {
  if (!allowed.has(reference.classification))
    throw new Error(`invalid or unclassified reference: ${reference.kind}:${reference.name}`);
}
console.log(
  `application schema references valid: ${contract.references.length} classified identities`,
);
