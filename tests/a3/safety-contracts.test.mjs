import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { scanContent, scanFiles } from "../../scripts/a3/privacy-guard.mjs";
import { validateMigrationMap } from "../../scripts/a3/validate-migration-map.mjs";
import { validateCanonicalBaselineInventory } from "../../scripts/a3/validate-canonical-baseline-inventory.mjs";

const readMap = async () =>
  JSON.parse(await readFile("contracts/cornermex-greenfield-activation-map-v1.json", "utf8"));
const readInventory = async () =>
  JSON.parse(await readFile("contracts/cornermex-canonical-baseline-inventory-v1.json", "utf8"));
const clone = (value) => structuredClone(value);

test("canonical table set is order independent and exact", async () => {
  const inventory = await readInventory();
  const reordered = clone(inventory);
  reordered.tables.reverse();
  await validateCanonicalBaselineInventory(reordered);
  for (const mutate of [
    (value) => value.tables.splice(value.tables.indexOf("addresses"), 1),
    (value) => value.tables.push("totally_bogus_table"),
    (value) => value.tables.push(value.tables[0]),
    (value) => (value.tables[value.tables.indexOf("addresses")] = "renamed_addresses"),
  ]) {
    const invalid = clone(inventory);
    mutate(invalid);
    await assert.rejects(validateCanonicalBaselineInventory(invalid));
  }
});

test("mapping mutations cannot preserve fabricated coverage", async () => {
  const original = await readMap();
  const inventory = await readInventory();
  const mutations = [
    (map) =>
      map.mappings.splice(
        map.mappings.findIndex((row) => row.targetObject === "public.addresses"),
        1,
      ),
    (map) =>
      map.mappings.push({
        ...clone(map.mappings[0]),
        sourceObject: "filler.object",
        targetObject: "public.filler",
      }),
    (map) =>
      (map.mappings.find((row) => row.targetObject === "public.addresses").targetObject =
        "public.renamed_addresses"),
    (map) =>
      map.mappings.splice(
        map.mappings.findIndex((row) => row.sourceObject === "legacy.marketplace"),
        1,
      ),
    (map) => map.mappings.push({ ...clone(map.mappings[0]), sourceObject: "duplicate.target" }),
    (map) => {
      map.mappings.splice(
        map.mappings.findIndex((row) => row.targetObject === "public.addresses"),
        1,
      );
      map.mappingCoveragePercent = 100;
    },
  ];
  for (const mutate of mutations) {
    const map = clone(original);
    mutate(map);
    await assert.rejects(validateMigrationMap({ map, inventory }));
  }
});

for (const [field, value] of [
  ["migrationDecision", "unknown_decision"],
  ["privacyClassification", "lolwhatever"],
  ["moneyStrategy", "floating_fx"],
  ["timestampStrategy", "local_guess"],
]) {
  test(`unknown ${field} is rejected by schema vocabulary`, async () => {
    const map = await readMap();
    map.mappings[0][field] = value;
    await assert.rejects(validateMigrationMap({ map, inventory: await readInventory() }));
  });
}

test("privacy canaries are detected outside and inside A3 without disclosure", async () => {
  const openAi = ["sk", "proj", "A".repeat(24)].join("-");
  const anthropic = ["sk", "ant", "B".repeat(24)].join("-");
  const jwt = ["eyJ" + "A".repeat(24), "B".repeat(24), "C".repeat(16)].join(".");
  const stripe = "sk_" + "live_" + "D".repeat(24);
  const email = ["fixture", "example.invalid"].join("@");
  const phone = "+" + ["971", "50", "123", "4567"].join(" ");
  const signedUrl =
    "https://example.supabase.co/storage/v1/object/sign/private/file.pdf?token=" + "E".repeat(24);
  const privatePath = ["private", "customers", "fake-user", "document.pdf"].join("/");
  const content = [openAi, anthropic, jwt, stripe, email, phone, signedUrl, privatePath].join("\n");
  const paths = ["src/.a3-privacy-canary.tmp", "tests/a3/.privacy-canary.tmp"];
  try {
    await Promise.all(paths.map((path) => writeFile(path, content)));
    const { findings } = scanFiles(paths);
    assert.deepEqual(
      new Set(findings.map(({ category }) => category)),
      new Set([
        "openai_key",
        "anthropic_key",
        "supabase_service_role_jwt",
        "stripe_secret",
        "email",
        "international_phone",
        "signed_storage_url",
        "private_storage_path",
      ]),
    );
    const safeOutput = JSON.stringify(findings);
    for (const secret of [openAi, anthropic, jwt, stripe, email, phone, signedUrl, privatePath]) {
      assert.equal(safeOutput.includes(secret), false);
    }
  } finally {
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
});

test("privacy scanner handles deleted files and private keys", () => {
  assert.equal(scanFiles(["src/.deleted-a3-canary"]).skipped[0].reason, "deleted_or_missing");
  const privateKey = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  assert.equal(scanContent("src/canary", privateKey)[0].category, "private_key");
});
