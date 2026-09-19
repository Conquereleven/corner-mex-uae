import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const tracked = () =>
  execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);

// `.env` was tracked from an early commit, which silently overrode the
// `.env` / `.env.*` rules already present in .gitignore: git ignores only
// untracked paths. Only role=anon publishable keys were ever committed, so no
// rotation was required, but a database URI or service-role key placed in that
// file would have been committed on the next `git add -A`.
test("no local env file is tracked except the committed example", () => {
  const offenders = tracked().filter((file) => {
    const base = file.split("/").pop();
    return base === ".env" || (base.startsWith(".env.") && base !== ".env.example");
  });
  assert.deepEqual(
    offenders,
    [],
    `env files must not be tracked (found: ${offenders.join(", ")}). ` +
      "Untrack with `git rm --cached <file>`; .gitignore already covers them.",
  );
});

test(".env.example remains tracked as the documented template", () => {
  assert.ok(tracked().includes(".env.example"), ".env.example must stay tracked");
});

test("gitignore keeps covering local env files", () => {
  // git check-ignore exits 1 when a path is not ignored.
  for (const candidate of [".env", ".env.local", ".env.production"]) {
    const result = execFileSync("git", ["check-ignore", candidate], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    assert.match(result.trim(), new RegExp(`^${candidate.replace(".", "\\.")}$`));
  }
});

test("the committed example holds no populated secret values", () => {
  const example = execFileSync("git", ["show", "HEAD:.env.example"], { encoding: "utf8" });
  // Variable NAMES such as SUPABASE_SERVICE_ROLE_KEY belong in a template; only
  // populated values are a problem. Assert each secret-ish key is left blank or
  // an obvious placeholder rather than carrying real key material.
  const secretish = /(KEY|SECRET|TOKEN|PASSWORD|URI|DSN)$/;
  const populated = [];
  for (const line of example.split("\n")) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, name, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/gu, "");
    if (!value) continue;
    const placeholder = /^(<.*>|\.\.\.|xxx+|changeme|your[-_ ].*|replace.*|TODO)$/iu.test(value);
    if (secretish.test(name) && !placeholder) populated.push(name);
  }
  assert.deepEqual(
    populated,
    [],
    `.env.example must not carry real values for: ${populated.join(", ")}`,
  );

  assert.doesNotMatch(example, /postgres(ql)?:\/\/\S/iu, "no database URI in the template");
  assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{20,}\.eyJ/u, "no JWT in the template");
  assert.doesNotMatch(
    example,
    /\bsk_(live|test)_[A-Za-z0-9]/u,
    "no Stripe secret key in the template",
  );
});
