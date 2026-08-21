import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("CM-MCP-1 registry contains only the approved v1 operations", async () => {
  const source = await read("src/lib/mcp-contract.ts");
  const approvedTools = [
    "catalog.search",
    "catalog.get_product",
    "inventory.get_availability",
    "orders.list",
    "orders.get",
    "b2b.list_leads",
    "b2b.get_lead",
    "ops.summary",
    "b2b.update_lead",
    "b2b.add_note",
    "orders.add_note",
    "orders.transition_status",
  ];

  for (const tool of approvedTools) assert.match(source, new RegExp(`"${tool.replaceAll(".", "\\.")}"`));

  assert.doesNotMatch(source, /sql\.execute|inventory\.adjust|price\.update|payments?\.execute/i);
});

test("CM-MCP-1 permissions are explicit and writes are distinguishable from reads", async () => {
  const source = await read("src/lib/mcp-contract.ts");
  const permissions = [
    "catalog:read",
    "inventory:read",
    "orders:read",
    "orders:note",
    "orders:transition",
    "b2b:read",
    "b2b:write",
    "ops:read",
  ];

  for (const permission of permissions) assert.match(source, new RegExp(`"${permission}"`));
  assert.match(source, /mode: "write"/);
  assert.match(source, /mode: "read"/);
  assert.match(source, /requiredPermissionForMcpTool/);
  assert.match(source, /isMcpMutationTool/);
});

test("CM-MCP-1 contract keeps dangerous capabilities out of v1 and production activation gated", async () => {
  const contract = await read("docs/mcp/CM-MCP-1-CONTRACT.md");
  assert.match(contract, /MCP 2026-07-28/);
  assert.match(contract, /Supabase Auth OAuth 2\.1/);
  assert.match(contract, /fine-grained grant layer/);
  assert.match(contract, /arbitrary SQL/);
  assert.match(contract, /product price changes/);
  assert.match(contract, /inventory adjustments/);
  assert.match(contract, /payment execution/);
  assert.match(contract, /Production activation is a separate governance gate/);
  assert.match(contract, /Missing or inactive grants fail closed/);
});
