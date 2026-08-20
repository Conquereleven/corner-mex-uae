import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  expandApplicationSchemaReferenceContract,
  validateApplicationSchemaReferenceContract,
  validateApplicationSchemaReferenceExtensions,
} from "./application-schema-reference-contract.mjs";

const basePath = "contracts/application-schema-reference-baseline-v1.json";
const extensionPath = "contracts/application-schema-reference-extensions-v1.json";
execFileSync(
  process.execPath,
  ["scripts/supabase/generate-application-schema-reference-baseline.mjs", "--check"],
  { stdio: "inherit" },
);
const base = JSON.parse(await readFile(basePath, "utf8"));
const extensions = JSON.parse(await readFile(extensionPath, "utf8"));
const extensionErrors = validateApplicationSchemaReferenceExtensions(base, extensions);
if (extensionErrors.length) throw new Error(extensionErrors.join("\n"));
const contract = expandApplicationSchemaReferenceContract(base, extensions);
const errors = validateApplicationSchemaReferenceContract(contract);
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `application schema references valid: ${contract.references.length} classified identities`,
);
