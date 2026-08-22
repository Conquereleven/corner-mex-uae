import { readFile } from "node:fs/promises";
import test from "node:test";
import * as prettier from "prettier";

const target = "tests/cm-launch-1/sec-rls-1-b2b-private-rls.test.mjs";

test("TEMP SEC-RLS-1 Prettier probe", async () => {
  const input = await readFile(target, "utf8");
  const config = (await prettier.resolveConfig(target)) ?? {};
  const formatted = await prettier.format(input, { ...config, filepath: target });
  console.log(`PRETTIER_BASE64=${Buffer.from(formatted, "utf8").toString("base64")}`);
});
