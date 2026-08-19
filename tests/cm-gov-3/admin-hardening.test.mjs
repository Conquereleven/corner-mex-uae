import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  applicationServiceName,
  DEFAULT_APPLICATION_SERVICE,
} from "../../src/lib/service-identity.ts";

const root = path.resolve(import.meta.dirname, "../..");

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

test("no self-service admin bootstrap path exists anywhere in application source", async () => {
  const files = await sourceFiles(path.join(root, "src"));
  assert.ok(files.length > 100, "expected full source tree scan");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(
      text,
      /adminBootstrap|AdminBootstrapCard|Claim admin/i,
      `self-service admin bootstrap reference found in ${path.relative(root, file)}`,
    );
  }
});

test("application source never inserts an admin row into user_roles", async () => {
  const files = await sourceFiles(path.join(root, "src"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(
      /from\("user_roles"\)[\s\S]{0,200}?\.insert\(([\s\S]{0,120}?)\)/g,
    )) {
      assert.doesNotMatch(
        match[1],
        /["']admin["']/,
        `admin role insert found in ${path.relative(root, file)}`,
      );
    }
  }
});

test("canonical admin authorization still reads user_roles.role = 'admin' server-side", async () => {
  const adminFunctions = await readFile(path.join(root, "src/lib/admin.functions.ts"), "utf8");
  assert.match(adminFunctions, /requireSupabaseAuth/);
  assert.match(adminFunctions, /from\("user_roles"\)[\s\S]{0,120}\.eq\("role", "admin"\)/);
  assert.match(adminFunctions, /async function assertAdmin/);
});

test("/admin remains guarded by the server-side canonical role check", async () => {
  const [adminRoute, routeAuth] = await Promise.all([
    readFile(path.join(root, "src/routes/_authenticated/admin.tsx"), "utf8"),
    readFile(path.join(root, "src/lib/route-auth.functions.ts"), "utf8"),
  ]);
  assert.match(adminRoute, /beforeLoad/);
  assert.match(adminRoute, /getRouteAdminState\(/);
  assert.match(adminRoute, /redirect\(\{ to: "\/account" \}\)/);
  assert.doesNotMatch(adminRoute, /typeof window/);
  assert.match(routeAuth, /supabase\.auth\.getClaims\(\)/);
  assert.match(routeAuth, /from\("user_roles"\)[\s\S]{0,120}\.eq\("role", "admin"\)/);
});

test("health and readiness share one environment-derived service identity", async () => {
  const health = await readFile(path.join(root, "src/routes/api/health.ts"), "utf8");
  const ready = await readFile(path.join(root, "src/routes/api/ready.ts"), "utf8");
  for (const text of [health, ready]) {
    assert.match(text, /applicationServiceName\(environment\)/);
    assert.doesNotMatch(text, /"cornermex-web"/);
  }
  assert.equal(
    applicationServiceName({ RAILWAY_SERVICE_NAME: "corner-mex-uae" }),
    "corner-mex-uae",
  );
  assert.equal(applicationServiceName({ RAILWAY_SERVICE_NAME: "cornermex-web" }), "cornermex-web");
  assert.equal(applicationServiceName({}), DEFAULT_APPLICATION_SERVICE);
  assert.equal(applicationServiceName({ RAILWAY_SERVICE_NAME: "  " }), DEFAULT_APPLICATION_SERVICE);
});
