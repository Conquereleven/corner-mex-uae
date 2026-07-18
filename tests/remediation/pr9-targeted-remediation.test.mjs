import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDb1CustodyText } from "../../scripts/governance/db1-custody-contract.mjs";
import { validateApplicationSchemaReferenceContract } from "../../scripts/supabase/application-schema-reference-contract.mjs";
import { validateCanonicalProvenance } from "../../scripts/supabase/canonical-provenance.mjs";

const root = process.cwd();
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const clone = (value) => structuredClone(value);

test("canonical provenance rejects missing, unknown and inconsistent evidence", async () => {
  const contract = await readJson("contracts/canonical-supabase-schema-fingerprint-v1.json");
  assert.deepEqual(validateCanonicalProvenance(contract), []);

  const missingMethod = clone(contract);
  delete missingMethod.generationMethod;
  assert.match(validateCanonicalProvenance(missingMethod).join("\n"), /generation method/);

  const unknownMethod = clone(contract);
  unknownMethod.generationMethod = "unverified_generator";
  assert.match(validateCanonicalProvenance(unknownMethod).join("\n"), /generation method/);

  const wrongProject = clone(contract);
  wrongProject.projectRef = "wrong-project";
  assert.match(validateCanonicalProvenance(wrongProject).join("\n"), /project ref/);

  const emptyVersion = clone(contract);
  emptyVersion.generatorVersion = "";
  assert.match(validateCanonicalProvenance(emptyVersion).join("\n"), /generator version/);

  const badTimestamp = clone(contract);
  badTimestamp.generatedAt = "2026-07-17";
  assert.match(validateCanonicalProvenance(badTimestamp).join("\n"), /timestamp/);

  const inconsistentFingerprint = clone(contract);
  inconsistentFingerprint.schemaFingerprint = "0".repeat(64);
  assert.match(validateCanonicalProvenance(inconsistentFingerprint).join("\n"), /disagree/);
});

test("application references expose only generator-reachable classifications", async () => {
  const contract = await readJson("contracts/application-schema-reference-baseline-v1.json");
  assert.deepEqual(validateApplicationSchemaReferenceContract(contract), []);
  const unreachable = clone(contract);
  unreachable.references[0].classification = "unreachable_legacy";
  assert.match(
    validateApplicationSchemaReferenceContract(unreachable).join("\n"),
    /invalid or unreachable classification/,
  );
});

test("DB1 custody figures cannot be silently removed", async () => {
  const decisionPath =
    "docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-DB1-CUSTODY-001.md";
  const decision = await readFile(decisionPath, "utf8");
  assert.deepEqual(validateDb1CustodyText(decision, decisionPath), []);
  assert.match(
    validateDb1CustodyText(
      decision.replaceAll("150 products", "products undisclosed"),
      decisionPath,
    ).join("\n"),
    /missing products/,
  );
});

test("historical package drift is rejected by npm ci", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cornermex-lock-drift-"));
  const packageJson = await readJson("package.json");
  packageJson.devDependencies.vite = "^6.0.0";
  await writeFile(
    path.join(directory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await writeFile(path.join(directory, "package-lock.json"), await readFile("package-lock.json"));
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "ci", "--dry-run", "--ignore-scripts"],
    {
      cwd: directory,
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /package-lock|in sync|Missing/i);
});

test("merged-tree verifier accepts only the expected synthetic merge", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cornermex-merge-tree-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "CornerMex CI");
  git("config", "user.email", "ci@example.invalid");
  await writeFile(path.join(directory, "base.txt"), "base\n");
  git("add", "base.txt");
  git("commit", "-m", "base");
  const base = git("rev-parse", "HEAD");
  git("checkout", "-b", "feature");
  await writeFile(path.join(directory, "feature.txt"), "feature\n");
  git("add", "feature.txt");
  git("commit", "-m", "feature");
  const head = git("rev-parse", "HEAD");
  git("checkout", "main");
  git("merge", "--no-ff", "feature", "-m", "synthetic merge");
  const merge = git("rev-parse", "HEAD");
  const script = path.join(root, "scripts/ci/validate-merged-tree.sh");
  const env = {
    ...process.env,
    MERGED_TREE_EXPECTED_SHA: merge,
    MERGED_TREE_BASE_SHA: base,
    MERGED_TREE_HEAD_SHA: head,
    MERGED_TREE_VERIFY_ONLY: "true",
  };
  assert.equal(spawnSync("bash", [script], { cwd: directory, env }).status, 0);
  assert.notEqual(
    spawnSync("bash", [script], {
      cwd: directory,
      env: { ...env, MERGED_TREE_EXPECTED_SHA: "0".repeat(40) },
    }).status,
    0,
  );
});
