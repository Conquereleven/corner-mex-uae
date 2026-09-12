import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, deps) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("exports", "require", code)(exports, (name) => deps[name] ?? require(name));
  return exports;
}
test("worker endpoint rejects missing/wrong authorization before any claim or provider work", async () => {
  let reads = 0,
    claims = 0,
    ready = false;
  const exports = load("src/routes/api/public/hooks/accounting-worker.ts", {
    "@tanstack/react-router": { createFileRoute: () => (value) => value },
    "@/lib/accounting-runtime.server": {
      readAccountingRuntime: async () => {
        reads++;
        return { ready };
      },
    },
    "@/lib/accounting-worker.server": {
      runAccountingWorker: async () => {
        claims++;
        return { ok: true };
      },
    },
  });
  const prior = process.env.CORNERMEX_INTEGRATION_WORKER_SECRET;
  process.env.CORNERMEX_INTEGRATION_WORKER_SECRET = "offline-internal-worker-secret";
  try {
    const call = (auth) =>
      exports.Route.server.handlers.POST({
        request: new Request("https://example.invalid/api/public/hooks/accounting-worker", {
          method: "POST",
          headers: auth ? { authorization: `Bearer ${auth}` } : {},
        }),
      });
    assert.equal((await call()).status, 401);
    assert.equal((await call("wrong")).status, 401);
    assert.equal(reads, 0);
    assert.equal(claims, 0);
    assert.equal((await call(process.env.CORNERMEX_INTEGRATION_WORKER_SECRET)).status, 503);
    assert.equal(claims, 0);
    ready = true;
    assert.equal((await call(process.env.CORNERMEX_INTEGRATION_WORKER_SECRET)).status, 200);
    assert.equal(claims, 1);
  } finally {
    if (prior === undefined) delete process.env.CORNERMEX_INTEGRATION_WORKER_SECRET;
    else process.env.CORNERMEX_INTEGRATION_WORKER_SECRET = prior;
  }
});
test("regional configuration validates the documented Canada accounts host and rejects mismatches", () => {
  const { zohoRuntimeConfig } = load("src/lib/accounting-runtime.server.ts", {
    "@/integrations/supabase/client.server": {},
    "./zoho-accounting.server": {},
    "./accounting-integration": {},
  });
  const env = {
    CORNERMEX_ZOHO_PRODUCT: "books",
    CORNERMEX_ZOHO_API_BASE_URL: "https://www.zohoapis.ca",
    CORNERMEX_ZOHO_ACCOUNTS_URL: "https://accounts.zohocloud.ca",
    CORNERMEX_ZOHO_ORGANIZATION_ID: "offline",
    CORNERMEX_ZOHO_VAT_TAX_ID: "offline",
    CORNERMEX_ZOHO_ACCESS_TOKEN: "offline",
    CORNERMEX_ZOHO_CLIENT_ID: "offline",
    CORNERMEX_ZOHO_CLIENT_SECRET: "offline",
    CORNERMEX_ZOHO_REFRESH_TOKEN: "offline",
  };
  assert.ok(zohoRuntimeConfig(env));
  assert.equal(
    zohoRuntimeConfig({ ...env, CORNERMEX_ZOHO_ACCOUNTS_URL: "https://accounts.zoho.ca" }),
    null,
  );
  assert.equal(
    zohoRuntimeConfig({ ...env, CORNERMEX_ZOHO_API_BASE_URL: "https://evil.invalid" }),
    null,
  );
});
