import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputRoot = path.join(root, ".output");
const serverRoot = path.join(outputRoot, "server");
const publicRoot = path.join(outputRoot, "public");
const sourceInputs = [
  path.join(root, "vite.config.ts"),
  path.join(root, "src/shims/async-hooks.ts"),
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(absolute) : [absolute];
    }),
  );
  return nested.flat();
}

const serverFiles = (await filesUnder(serverRoot)).filter((file) => file.endsWith(".mjs"));
const browserFiles = (await filesUnder(publicRoot)).filter((file) => /\.(?:js|mjs)$/.test(file));
assert(serverFiles.length > 0, "SSR_ASYNC_CONTEXT_SERVER_OUTPUT_MISSING");
assert(browserFiles.length > 0, "SSR_ASYNC_CONTEXT_BROWSER_OUTPUT_MISSING");

const newestInput = Math.max(
  ...(await Promise.all(sourceInputs.map((file) => stat(file)))).map((s) => s.mtimeMs),
);
const oldestServerOutput = Math.min(
  ...(await Promise.all(serverFiles.map((file) => stat(file)))).map((s) => s.mtimeMs),
);
assert(
  oldestServerOutput >= newestInput,
  "SSR_ASYNC_CONTEXT_OUTPUT_STALE: run npm run build before this validator",
);

const serverText = (await Promise.all(serverFiles.map((file) => readFile(file, "utf8")))).join(
  "\n",
);
const browserText = (await Promise.all(browserFiles.map((file) => readFile(file, "utf8")))).join(
  "\n",
);
const synchronousShimSignature =
  /class AsyncLocalStorage[\s\S]{0,900}const prev = this\.store;[\s\S]{0,500}finally \{\s*this\.store = prev;/;

assert(
  !synchronousShimSignature.test(serverText),
  "SSR_ASYNC_CONTEXT_BROWSER_SHIM_PRESENT_IN_SERVER",
);
assert(
  /(?:from\s+["'](?:node:)?async_hooks["']|import\s+["'](?:node:)?async_hooks["'])/.test(
    serverText,
  ),
  "SSR_ASYNC_CONTEXT_NATIVE_NODE_DEPENDENCY_MISSING",
);
assert(
  !/(?:from\s+["']node:async_hooks["']|import\s+["']node:async_hooks["'])/.test(browserText),
  "SSR_ASYNC_CONTEXT_NODE_BUILTIN_LEAKED_TO_BROWSER",
);

const storage = new AsyncLocalStorage();
const observed = await storage.run("cornermex-r2", async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return storage.getStore();
});
assert.equal(observed, "cornermex-r2", "SSR_ASYNC_CONTEXT_NATIVE_AWAIT_CONTINUITY_FAILED");

console.log(
  `CM-COM-1C-R2 SSR async context valid: serverFiles=${serverFiles.length} browserFiles=${browserFiles.length}`,
);
