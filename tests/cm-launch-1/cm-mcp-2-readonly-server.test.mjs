import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CM-MCP-2 storefront protocol skeleton is retired in favor of the isolated MCP service", async () => {
  const route = await readFile(new URL("../../src/routes/api/mcp.ts", import.meta.url), "utf8");

  assert.match(route, /CM_MCP_REMOTE_ENDPOINT_NOT_ACTIVATED/);
  assert.match(route, /status: 503/);
  assert.match(route, /isolated-edge-pending/);
  assert.doesNotMatch(
    route,
    /handleCornerMexMcpRequest|principal: null|protocolVersion|initialize/,
  );
  assert.doesNotMatch(route, /supabaseAdmin|service_role|SERVICE_ROLE/);
});
