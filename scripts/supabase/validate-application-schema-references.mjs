import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { validateApplicationSchemaReferenceContract } from "./application-schema-reference-contract.mjs";

const path = "contracts/application-schema-reference-baseline-v1.json";
execFileSync(
  process.execPath,
  ["scripts/supabase/generate-application-schema-reference-baseline.mjs", "--check"],
  { stdio: "ignore" },
);
const contract = JSON.parse(await readFile(path, "utf8"));
const errors = validateApplicationSchemaReferenceContract(contract);
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `application schema references valid: ${contract.references.length} classified identities`,
);
