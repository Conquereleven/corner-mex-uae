import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  expandApplicationSchemaReferenceContract,
  validateApplicationSchemaReferenceExtensions,
} from "./application-schema-reference-contract.mjs";

const roots = ["src", "scripts"];
const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(target);
  }
};
for (const root of roots) await walk(root);

const found = new Map();
for (const file of files.sort()) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/\.(from|rpc)\(\s*["']([^"']+)["']/g)) {
    const kind = match[1] === "rpc" ? "function" : "table_or_storage_bucket";
    const key = `${kind}:${match[2]}`;
    if (!found.has(key)) found.set(key, { kind, name: match[2], files: [] });
    found.get(key).files.push(file);
  }
}

const outputPath = "contracts/application-schema-reference-baseline-v1.json";
const extensionPath = "contracts/application-schema-reference-extensions-v1.json";
const committed = await readFile(outputPath, "utf8").catch(() => null);
const committedContract = committed ? JSON.parse(committed) : null;
const extensions = JSON.parse(await readFile(extensionPath, "utf8"));
const extensionErrors = validateApplicationSchemaReferenceExtensions(committedContract, extensions);
if (extensionErrors.length) throw new Error(extensionErrors.join("\n"));
const expectedContract = expandApplicationSchemaReferenceContract(committedContract, extensions);
const expectedOrder = new Map(
  expectedContract.references.map((reference, index) => [
    `${reference.kind}:${reference.name}`,
    index,
  ]),
);
const expectedByIdentity = new Map(
  expectedContract.references.map((reference) => [
    `${reference.kind}:${reference.name}`,
    reference,
  ]),
);

const references = [...found.values()]
  .map((reference) => {
    const identity = `${reference.kind}:${reference.name}`;
    const authority = expectedByIdentity.get(identity);
    return {
      ...reference,
      files: [...new Set(reference.files)].sort(),
      classification: authority?.classification ?? "lovable_live_only",
      rationale:
        authority?.rationale ?? "preexisting_lovable_runtime_reference_not_in_canonical_db2",
    };
  })
  .sort((left, right) => {
    const leftKey = `${left.kind}:${left.name}`;
    const rightKey = `${right.kind}:${right.name}`;
    const leftIndex = expectedOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = expectedOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || leftKey.localeCompare(rightKey);
  });

const generated = {
  contractVersion: committedContract.contractVersion,
  canonicalProjectRef: committedContract.canonicalProjectRef,
  references,
};
const output = `${JSON.stringify(generated, null, 2)}\n`;
const expectedOutput = `${JSON.stringify(expectedContract, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (output !== expectedOutput) {
    console.error("APPLICATION_SCHEMA_REFERENCE_COMBINED_EXPECTED_BEGIN");
    console.error(expectedOutput);
    console.error("APPLICATION_SCHEMA_REFERENCE_COMBINED_EXPECTED_END");
    console.error("APPLICATION_SCHEMA_REFERENCE_GENERATED_BEGIN");
    console.error(output);
    console.error("APPLICATION_SCHEMA_REFERENCE_GENERATED_END");
    throw new Error(
      "application schema references changed outside the explicit baseline/extension authority",
    );
  }
  console.log(`application schema reference authority unchanged: ${references.length} identities`);
} else {
  if ((extensions.fileAdditions?.length ?? 0) || (extensions.newReferences?.length ?? 0)) {
    throw new Error(
      "compact application schema reference extensions before regenerating the base baseline",
    );
  }
  await writeFile(outputPath, output);
  console.log(`application schema reference baseline written: ${references.length} identities`);
}
