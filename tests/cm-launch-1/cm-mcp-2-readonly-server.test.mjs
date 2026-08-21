import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CORNERMEX_MCP_PROTOCOL_VERSION,
  CORNERMEX_MCP_READ_TOOLS,
  handleCornerMexMcpRequest,
} from "../../src/lib/mcp-readonly.server.ts";

const principal = (permissions) => ({
  userId: "00000000-0000-4000-8000-000000000001",
  clientId: "test-client",
  permissions: new Set(permissions),
});

const adapter = {
  calls: [],
  async execute(tool, args) {
    this.calls.push({ tool, args });
    return { ok: true, tool, args };
  },
};

test("CM-MCP-2 initializes with the reviewed protocol version", async () => {
  const result = await handleCornerMexMcpRequest({
    request: { jsonrpc: "2.0", id: 1, method: "initialize" },
    principal: null,
    adapter,
  });

  assert.equal(CORNERMEX_MCP_PROTOCOL_VERSION, "2026-07-28");
  assert.equal(result.result.protocolVersion, "2026-07-28");
  assert.equal(result.result.serverInfo.name, "cornermex-operations");
});

test("CM-MCP-2 lists only read tools allowed by the principal", async () => {
  const result = await handleCornerMexMcpRequest({
    request: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    principal: principal(["catalog:read", "orders:read"]),
    adapter,
  });

  const names = result.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ["catalog.search", "catalog.get_product", "orders.list", "orders.get"]);
  assert.equal(CORNERMEX_MCP_READ_TOOLS.length, 8);
  assert.equal(names.some((name) => name.includes("transition")), false);
});

test("CM-MCP-2 rejects all tool use without authorization", async () => {
  const result = await handleCornerMexMcpRequest({
    request: { jsonrpc: "2.0", id: 3, method: "tools/list" },
    principal: null,
    adapter,
  });

  assert.equal(result.error.code, -32001);
});

test("CM-MCP-2 rejects write tools before adapter execution", async () => {
  adapter.calls.length = 0;
  const result = await handleCornerMexMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "orders.transition_status", arguments: {} },
    },
    principal: principal(["orders:transition"]),
    adapter,
  });

  assert.equal(result.error.code, -32003);
  assert.equal(adapter.calls.length, 0);
});

test("CM-MCP-2 enforces the per-tool CornerMex permission", async () => {
  adapter.calls.length = 0;
  const result = await handleCornerMexMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "orders.list", arguments: {} },
    },
    principal: principal(["catalog:read"]),
    adapter,
  });

  assert.equal(result.error.code, -32002);
  assert.equal(result.error.data.permission, "orders:read");
  assert.equal(adapter.calls.length, 0);
});

test("CM-MCP-2 executes an authorized read through the injected adapter", async () => {
  adapter.calls.length = 0;
  const result = await handleCornerMexMcpRequest({
    request: {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "catalog.search", arguments: { q: "tajin" } },
    },
    principal: principal(["catalog:read"]),
    adapter,
  });

  assert.equal(result.result.isError, false);
  assert.deepEqual(adapter.calls, [{ tool: "catalog.search", args: { q: "tajin" } }]);
});

test("CM-MCP-2 HTTP route is fail-closed until OAuth wiring is separately activated", async () => {
  const route = await readFile(
    new URL("../../src/routes/api/mcp.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /principal: null/);
  assert.match(route, /inactiveAdapter/);
  assert.match(route, /status: unauthorized \? 401 : 200/);
  assert.doesNotMatch(route, /supabaseAdmin|service_role|SERVICE_ROLE/);
});
