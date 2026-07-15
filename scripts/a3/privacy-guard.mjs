import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const committed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
  encoding: "utf8",
});
const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
  encoding: "utf8",
});
const working = execFileSync("git", ["ls-files", "--others", "--modified", "--exclude-standard"], {
  encoding: "utf8",
});
const files = [...new Set(`${committed}\n${staged}\n${working}`.trim().split("\n"))].filter(
  (path) =>
    path &&
    (path.includes("/a3/") ||
      path.includes("a3-1") ||
      path.includes("migration-map") ||
      path.includes("source-inventory") ||
      path.includes("target-clean-state")),
);

const forbidden = [
  ["database_url", /postgres(?:ql)?:\/\/[^\s"'<>]+/gi],
  ["jwt", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g],
  ["supabase_secret", /sb_(?:secret|service_role)_[A-Za-z0-9_-]{16,}/gi],
  ["stripe_secret", /(?:sk_(?:live|test)|whsec)_[A-Za-z0-9_-]{12,}/g],
  ["bearer", /Bearer\s+[A-Za-z0-9._-]{20,}/g],
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
];

const findings = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const [kind, pattern] of forbidden) {
    if (pattern.test(content)) findings.push({ file, kind });
    pattern.lastIndex = 0;
  }
}

if (findings.length) {
  console.error(JSON.stringify({ status: "a3_privacy_guard_failed", findings }));
  process.exit(1);
}
console.log(JSON.stringify({ status: "a3_privacy_guard_clean", filesScanned: files.length }));
