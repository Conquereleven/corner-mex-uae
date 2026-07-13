import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main";
const names = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", base], { encoding: "utf8" });
const files = names
  .split("\n")
  .filter((file) => /\.(?:js|mjs|cjs|ts|tsx)$/.test(file) && file !== "src/routeTree.gen.ts");

function lint(file, content) {
  const result = spawnSync("npx", ["eslint", "--stdin", "--stdin-filename", file, "--format", "json"], {
    input: content,
    encoding: "utf8",
  });
  return JSON.parse(result.stdout || "[]")[0]?.errorCount ?? Number.POSITIVE_INFINITY;
}

if (files.length === 0) {
  console.log("No changed JavaScript or TypeScript files to lint.");
  process.exit(0);
}

let failed = false;

for (const file of files) {
  const currentErrors = lint(file, readFileSync(file));
  let baselineErrors = 0;
  try {
    const baseline = execFileSync("git", ["show", `${base}:${file}`]);
    baselineErrors = lint(file, baseline);
  } catch {
    baselineErrors = 0;
  }

  const delta = currentErrors - baselineErrors;
  console.log(`${file}: current=${currentErrors} baseline=${baselineErrors} delta=${delta}`);
  if (delta > 0) failed = true;
}

if (failed) {
  throw new Error("Changed files increase the established lint baseline.");
}
