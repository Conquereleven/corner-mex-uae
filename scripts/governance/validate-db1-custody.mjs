import { readFile } from "node:fs/promises";
import { validateDb1CustodyText } from "./db1-custody-contract.mjs";

const documents = [
  "docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-DB1-CUSTODY-001.md",
  "docs/engineering-playbook/04_Founder_Decision_Registry.md",
  "docs/architecture/three-database-system-map.md",
  "docs/architecture/lovable-cloud-live-legacy.md",
  "docs/evidence/current-main-remediation-acceptance.md",
];
const errors = [];
for (const path of documents) {
  const text = await readFile(path, "utf8");
  errors.push(...validateDb1CustodyText(text, path));
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`DB1 custody governance valid: ${documents.length} documents preserve 8 facts`);
