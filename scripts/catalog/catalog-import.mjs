import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertSafePackage, buildPackages, loadSource, resolveSource } from "./catalog-lib.mjs";
const command = process.argv[2] || "preview",
  root = process.cwd(),
  source = resolveSource(),
  artifact = path.join(root, ".artifacts", "catalog-import-preview.json");
const sourceRepo = path.resolve(path.dirname(source), "../..");
const sourceSha =
  process.env.CORNEROPS_SOURCE_SHA ||
  execFileSync("git", ["-C", sourceRepo, "rev-parse", "origin/main"], {
    encoding: "utf8",
  }).trim();
const loaded = loadSource(source);
const packages = buildPackages(loaded.rows, { sourceSha, sourceChecksum: loaded.checksum });
assertSafePackage(packages.catalog);
const summary = {
  command,
  status: "ok",
  sourceCount: packages.catalog.sourceCount,
  sourceFingerprint: packages.fingerprint,
  classificationCounts: packages.catalog.classificationCounts,
  mediaCount: packages.media.itemCount,
  writes: false,
  publicExposure: 0,
  inventory: 0,
};
if (command === "validate-export") {
} else if (command === "validate-media") {
  if (packages.media.items.some((x) => x.objectPath.includes("..")))
    throw new Error("PATH_TRAVERSAL");
} else if (command === "preview") {
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(
    artifact,
    JSON.stringify({ catalog: packages.catalog, media: packages.media }, null, 2),
  );
} else if (command === "execute") {
  const required = [
    "CATALOG_IMPORT_EXECUTION_AUTHORIZED",
    "CATALOG_IMPORT_IDEMPOTENCY_KEY",
    "CATALOG_IMPORT_TARGET_PROJECT",
    "CATALOG_IMPORT_REVIEWED_COMMIT",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`IMPORT_EXECUTION_BLOCKED:${missing.join(",")}`);
  if (process.env.CATALOG_IMPORT_EXECUTION_AUTHORIZED !== "true")
    throw new Error("IMPORT_EXECUTION_NOT_AUTHORIZED");
  throw new Error("IMPORT_EXECUTION_ADAPTER_NOT_CONFIGURED");
} else if (command === "verify") {
  if (!fs.existsSync(artifact)) throw new Error("PREVIEW_ARTIFACT_MISSING");
  const saved = JSON.parse(fs.readFileSync(artifact));
  assertSafePackage(saved.catalog);
} else if (command === "execution-gate") {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error("CORNEROPS_SOURCE_SHA_REQUIRED");
} else throw new Error("UNKNOWN_COMMAND");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
