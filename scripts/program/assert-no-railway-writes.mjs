import fs from "node:fs";
import path from "node:path";

// Read-only guardrail: scans specific files for text patterns that would indicate a Railway
// write/mutation operation. This is a static text scan, not an execution sandbox — it exists to
// catch an accidental or malicious write path being added to the live drift guard or its
// workflow, not to be a complete security boundary on its own.

export const FORBIDDEN_PATTERNS = Object.freeze([
  { pattern: /railway\s+up\b/i, label: "railway up" },
  { pattern: /railway\s+deploy\b/i, label: "railway deploy" },
  { pattern: /railway\s+redeploy\b/i, label: "railway redeploy" },
  { pattern: /railway\s+restart\b/i, label: "railway restart" },
  { pattern: /railway\s+down\b/i, label: "railway down" },
  { pattern: /\bserviceInstanceRedeploy\b/i, label: "serviceInstanceRedeploy mutation" },
  { pattern: /\bserviceInstanceDeploy\b/i, label: "serviceInstanceDeploy mutation" },
  { pattern: /\bserviceInstanceRestart\b/i, label: "serviceInstanceRestart mutation" },
  { pattern: /\bdeploymentRestart\b/i, label: "deploymentRestart mutation" },
  { pattern: /\bdeploymentRollback\b/i, label: "deploymentRollback mutation" },
  { pattern: /\bvariableUpsert\b/i, label: "variableUpsert mutation" },
  { pattern: /\bvariableDelete\b/i, label: "variableDelete mutation" },
  { pattern: /\bserviceCreate\b/i, label: "serviceCreate mutation" },
  { pattern: /\bserviceDelete\b/i, label: "serviceDelete mutation" },
  { pattern: /\bserviceInstanceUpdate\b/i, label: "serviceInstanceUpdate mutation" },
  { pattern: /^\s*mutation\s/im, label: "GraphQL mutation keyword" },
]);

export const DEFAULT_SCAN_TARGETS = Object.freeze([
  "scripts/program/check-railway-live-governance.mjs",
  "scripts/program/railway-live-client.mjs",
  "scripts/program/run-railway-live-governance.mjs",
  ".github/workflows/railway-governance-drift.yml",
]);

export function scanSourceForForbiddenOperations(source) {
  const hits = [];
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) hits.push(label);
  }
  return hits;
}

export function assertNoRailwayWrites({
  baseDir = process.cwd(),
  targets = DEFAULT_SCAN_TARGETS,
} = {}) {
  const violations = [];
  for (const relativePath of targets) {
    const fullPath = path.resolve(baseDir, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    const source = fs.readFileSync(fullPath, "utf8");
    const hits = scanSourceForForbiddenOperations(source);
    if (hits.length > 0) violations.push({ file: relativePath, hits });
  }
  if (violations.length > 0) {
    const message = violations.map((v) => `${v.file}: ${v.hits.join(", ")}`).join(" | ");
    throw new Error(`RAILWAY_WRITE_OPERATION_FORBIDDEN:${message}`);
  }
  return { status: "no_railway_write_operations_found", scanned: targets };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(assertNoRailwayWrites()));
}
