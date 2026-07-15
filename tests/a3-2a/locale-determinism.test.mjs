import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRehearsal, compareCodePoints } from "../../scripts/a3/rehearse-transformations.mjs";

const EXPECTED_CHECKSUM = "4d2ce1a09e698cde442fc2148a78db329aba3bc520b135eedb644977c7a6a29c";

test("codepoint ordering is stable for ASCII, accents, Arabic, symbols, case and whitespace", () => {
  const values = ["z", "A", "a", " á", "á", "ع", "😀", "Ω"];
  const sorted = [...values].sort(compareCodePoints);
  assert.deepEqual(sorted, [" á", "A", "a", "z", "á", "Ω", "ع", "😀"]);
});

test("reordered semantic arrays preserve the accepted A3.1 checksum", async () => {
  const fixture = JSON.parse(
    await readFile("tests/fixtures/a3/greenfield-commerce.synthetic.json", "utf8"),
  );
  const original = await buildRehearsal(fixture);
  const reordered = structuredClone(fixture);
  for (const field of ["categories", "products", "variants", "inventory"]) {
    reordered[field].reverse();
  }
  assert.equal(original.checksum, EXPECTED_CHECKSUM);
  assert.equal((await buildRehearsal(reordered)).checksum, EXPECTED_CHECKSUM);
});

test("host locale does not change the rehearsal checksum", () => {
  const checksums = ["C", "en_US.UTF-8"].map((locale) => {
    const output = execFileSync(process.execPath, ["scripts/a3/rehearse-transformations.mjs"], {
      encoding: "utf8",
      env: { ...process.env, LC_ALL: locale, LANG: locale },
    });
    return JSON.parse(output).checksum;
  });
  assert.deepEqual(checksums, [EXPECTED_CHECKSUM, EXPECTED_CHECKSUM]);
});

test("business-content changes still alter checksum", async () => {
  const fixture = JSON.parse(
    await readFile("tests/fixtures/a3/greenfield-commerce.synthetic.json", "utf8"),
  );
  const original = await buildRehearsal(fixture);
  fixture.products[0].name = `${fixture.products[0].name} changed`;
  assert.notEqual((await buildRehearsal(fixture)).checksum, original.checksum);
});
