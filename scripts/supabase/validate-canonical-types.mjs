import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateCanonicalProvenance } from "./canonical-provenance.mjs";

const contract = JSON.parse(
  await readFile("contracts/canonical-supabase-schema-fingerprint-v1.json", "utf8"),
);
const types = await readFile("src/integrations/supabase/types.ts", "utf8");
const activeSql = await readFile(
  "supabase/migrations/20260714010000_commerce_foundation_a2.sql",
  "utf8",
);
const replayPrelude = await readFile(
  "tests/fixtures/supabase-canonical-platform-prelude.sql",
  "utf8",
);
const tableBlock = types.match(/Tables:\s*\{([\s\S]*?)\n    Views:/)?.[1] ?? "";
const tables = [...tableBlock.matchAll(/^      ([a-z0-9_]+): \{$/gm)]
  .map((match) => match[1])
  .sort();
const expected = [...contract.publicTables].sort();
const errors = validateCanonicalProvenance(contract);

if (contract.canonicalProjectRef !== "wlrfknmrhowldygmvtvn")
  errors.push("canonical project ref mismatch");
if (JSON.stringify(tables) !== JSON.stringify(expected))
  errors.push(`table identity mismatch: ${JSON.stringify(tables)}`);
if (createHash("sha256").update(types).digest("hex") !== contract.typesSha256)
  errors.push("generated types checksum mismatch");
const fingerprintPayload = {
  canonicalProjectRef: contract.canonicalProjectRef,
  publicTables: [...contract.publicTables].sort(),
  publicFunctions: [...contract.publicFunctions].sort(),
  rlsEnabledTables: contract.rlsEnabledTables,
  policyCount: contract.policyCount,
  typesSha256: contract.typesSha256,
};
if (
  createHash("sha256").update(JSON.stringify(fingerprintPayload)).digest("hex") !==
  contract.schemaFingerprint
) {
  errors.push("canonical schema fingerprint mismatch");
}
if (!/function public\.set_updated_at\(\)/i.test(activeSql))
  errors.push("canonical set_updated_at function evidence missing");
if (!/function public\.rls_auto_enable\(\)/i.test(replayPrelude))
  errors.push("Supabase platform rls_auto_enable evidence missing");
for (const phantom of contract.forbiddenLovableOnlyEntities) {
  if (new RegExp(`\\b${phantom}\\b`).test(tableBlock))
    errors.push(`phantom entity in generated types: ${phantom}`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `canonical types valid: project=${contract.canonicalProjectRef}, tables=${tables.length}, publicFunctions=${contract.publicFunctions.length}`,
);
