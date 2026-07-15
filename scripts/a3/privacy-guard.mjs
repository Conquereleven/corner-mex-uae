import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { sha256 } from "./lib.mjs";

const MAX_FILE_BYTES = 1_048_576;
const REPOSITORY_ROOT = resolve(process.cwd());

export const FORBIDDEN_PATTERNS = Object.freeze([
  ["database_url", /postgres(?:ql)?:\/\/[^\s"'<>]+/gi],
  ["openai_key", /sk-proj-[A-Za-z0-9_-]{16,}/g],
  ["anthropic_key", /sk-ant-[A-Za-z0-9_-]{16,}/g],
  ["supabase_service_role_jwt", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g],
  ["supabase_secret", /sb_(?:secret|service_role)_[A-Za-z0-9_-]{16,}/gi],
  ["stripe_secret", /(?:sk_(?:live|test)|whsec)_[A-Za-z0-9_-]{12,}/g],
  ["railway_token", /(?:RAILWAY_TOKEN|RAILWAY_API_TOKEN)[ \t]*[=:][ \t]*[A-Za-z0-9._-]{16,}/gi],
  [
    "oauth_client_secret",
    /(?:OAUTH_CLIENT_SECRET|CLIENT_SECRET)[ \t]*[=:][ \t]*[A-Za-z0-9._-]{12,}/gi,
  ],
  [
    "email_provider_key",
    /(?:RESEND_API_KEY|SENDGRID_API_KEY)[ \t]*[=:][ \t]*[A-Za-z0-9._-]{12,}/gi,
  ],
  ["bearer_token", /Bearer\s+[A-Za-z0-9._-]{20,}/g],
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ["international_phone", /\+[1-9]\d(?:[\s().-]*\d){7,14}/g],
  [
    "signed_storage_url",
    /https:\/\/[^\s"']+\.supabase\.co\/storage\/v1\/object\/sign\/[^\s"']+[?&]token=[^\s"'&]+/gi,
  ],
  [
    "private_storage_path",
    /(?:private|restricted)\/(?:customers|users|orders|payments)\/[A-Za-z0-9._/-]{4,}/gi,
  ],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]);

function git(args, { optional = false } = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

function lines(value) {
  return value ? value.split("\n").filter(Boolean) : [];
}

export function discoverChangedFiles(env = process.env) {
  const groups = [];
  let mode = "local_merge_base";
  if (env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_BASE_SHA) {
    mode = "github_pull_request";
    groups.push(
      git(["diff", "--name-only", "--diff-filter=ACMR", `${env.GITHUB_BASE_SHA}...HEAD`]),
    );
  } else if (
    env.GITHUB_EVENT_NAME === "push" &&
    env.GITHUB_BEFORE &&
    !/^0+$/.test(env.GITHUB_BEFORE)
  ) {
    mode = "github_push";
    groups.push(git(["diff", "--name-only", "--diff-filter=ACMR", `${env.GITHUB_BEFORE}..HEAD`]));
  } else {
    const mergeBase = git(["merge-base", "origin/main", "HEAD"], { optional: true }) || "HEAD^";
    groups.push(git(["diff", "--name-only", "--diff-filter=ACMR", `${mergeBase}...HEAD`]));
  }
  groups.push(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { optional: true }));
  groups.push(git(["diff", "--name-only", "--diff-filter=ACMR"], { optional: true }));
  groups.push(git(["ls-files", "--others", "--exclude-standard"], { optional: true }));
  return { mode, files: [...new Set(groups.flatMap(lines))].sort() };
}

export function scanContent(file, content) {
  const findings = [];
  for (const [category, pattern] of FORBIDDEN_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      findings.push({
        file,
        line: content.slice(0, match.index).split("\n").length,
        category,
        fingerprint: sha256(match[0]).slice(0, 12),
      });
    }
    pattern.lastIndex = 0;
  }
  return findings;
}

export function scanFiles(files) {
  const findings = [];
  const skipped = [];
  for (const file of files) {
    const absolute = resolve(REPOSITORY_ROOT, file);
    assertInsideRepository(absolute);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error.code === "ENOENT") {
        skipped.push({ file, reason: "deleted_or_missing" });
        continue;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      skipped.push({ file, reason: "symlink" });
      continue;
    }
    if (!stat.isFile()) continue;
    if (stat.size > MAX_FILE_BYTES) {
      skipped.push({ file, reason: "file_too_large" });
      continue;
    }
    const bytes = readFileSync(absolute);
    if (bytes.subarray(0, 8192).includes(0)) {
      skipped.push({ file, reason: "binary" });
      continue;
    }
    findings.push(...scanContent(file, bytes.toString("utf8")));
  }
  return { findings, skipped };
}

function assertInsideRepository(absolute) {
  const path = relative(REPOSITORY_ROOT, absolute);
  if (path.startsWith("..") || path === "")
    throw new Error("PRIVACY_GUARD_PATH_OUTSIDE_REPOSITORY");
}

export function runPrivacyGuard(env = process.env) {
  const { mode, files } = discoverChangedFiles(env);
  const { findings, skipped } = scanFiles(files);
  const result = {
    mode,
    filesScanned: files.length - skipped.length,
    skipped: skipped.length,
    findings,
  };
  if (findings.length) {
    console.error(JSON.stringify({ status: "a3_privacy_guard_failed", ...result }));
    return { ...result, status: "a3_privacy_guard_failed" };
  }
  console.log(JSON.stringify({ status: "a3_privacy_guard_clean", ...result, findings: undefined }));
  return { ...result, status: "a3_privacy_guard_clean" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPrivacyGuard();
  if (result.findings.length) process.exit(1);
}
