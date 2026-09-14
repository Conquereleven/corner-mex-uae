import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { pdf, mafSource } from "../../tests/intermex-po-automation-1/fixture.mjs";
// Exercise the shipped engine, not node_modules: missing runtime worker files
// can pass source tests and only fail after deployment.
const dir = path.resolve(".output/server/_libs");
const name = (await readdir(dir)).find((file) => /^pdfjs-dist.*\.mjs$/.test(file));
assert.ok(name, "PDF engine must be present in the Railway artifact");
const exports = await import(pathToFileURL(path.join(dir, name)).href);
const engine = [exports, ...Object.values(exports)].find(
  (v) => typeof v?.getDocument === "function",
);
assert.ok(engine, "Built PDF engine export must be discoverable");
const task = engine.getDocument({
  data: new Uint8Array(pdf(mafSource)),
  isEvalSupported: false,
  useSystemFonts: false,
  disableFontFace: true,
});
try {
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  const text = content.items
    .filter((item) => "str" in item)
    .map((item) => item.str)
    .join(" ");
  assert.match(text, /B202609-37789/);
  assert.match(text, /123\.38/);
  console.log(
    "Built Railway PDF engine extracts the representative PO without external worker files.",
  );
} finally {
  await task.destroy();
}
