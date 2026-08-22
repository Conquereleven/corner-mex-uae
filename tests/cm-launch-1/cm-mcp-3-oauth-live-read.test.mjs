import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edgeUrl = new URL("../../supabase/functions/cornermex-mcp/index.ts", import.meta.url);
const sqlUrl = new URL(
  "../../supabase/pending-canonical/20260822004500_cm_mcp_3_read_boundary.sql",
  import.meta.url,
);
const routeUrl = new URL("../../src/routes/api/mcp.ts", import.meta.url);

const readTools = [
  "catalog.search",
  "catalog.get_product",
  "inventory.get_availability",
  "orders.list",
  "orders.get",
  "b2b.list_leads",
  "b2b.get_lead",
  "ops.summary",
];

const writeTools = [
  "b2b.update_lead",
  "b2b.add_note",
  "orders.add_note",
  "orders.transition_status",
];

test("CM-MCP-3 uses the official modern MCP server and bearer-auth boundary", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  assert.match(edge, /npm:@modelcontextprotocol\/server@2\.0\.0/);
  assert.match(edge, /createMcpHandler/);
  assert.match(edge, /new McpServer/);
  assert.match(edge, /requireBearerAuth/);
  assert.match(edge, /legacy: "reject"/);
  assert.match(edge, /client\.auth\.getUser\(token\)/);
  assert.match(edge, /payload\.client_id/);
  assert.match(edge, /payload\.sub/);
  assert.match(edge, /payload\.exp/);
  assert.match(edge, /payload\.iss/);
  assert.match(edge, /audienceIncludesAuthenticated/);
});

test("CM-MCP-3 never uses privileged Supabase credentials or direct table access", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  assert.match(edge, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(edge, /service[_-]?role|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/i);
  assert.doesNotMatch(edge, /\.from\s*\(/);
  assert.match(edge, /\.rpc\("mcp_current_permissions"\)/);
});

test("CM-MCP-3 exposes exactly the reviewed read tool family and no write tools", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  for (const tool of readTools) assert.match(edge, new RegExp(`"${tool.replace(".", "\\.")}"`));
  for (const tool of writeTools) assert.doesNotMatch(edge, new RegExp(tool.replace(".", "\\.")));
});

test("CM-MCP-3 grant and RPC schema remains unapplied and client-bound", async () => {
  const sql = await readFile(sqlUrl, "utf8");

  assert.match(sql, /intentionally UNAPPLIED/i);
  assert.match(sql, /commerce_private\.mcp_grants/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table commerce_private\.mcp_grants from public, anon, authenticated/i);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /auth\.jwt\(\) ->> 'client_id'/);
  assert.match(sql, /g\.active = true/);
  assert.match(sql, /g\.expires_at is null or g\.expires_at > now\(\)/);

  for (const permission of [
    "catalog:read",
    "inventory:read",
    "orders:read",
    "orders:note",
    "orders:transition",
    "b2b:read",
    "b2b:write",
    "ops:read",
  ]) {
    assert.match(sql, new RegExp(`'${permission}'`));
  }
});

test("CM-MCP-3 minimizes order and B2B data at the RPC boundary", async () => {
  const sql = await readFile(sqlUrl, "utf8");

  assert.doesNotMatch(sql, /shipping_address|legal_acceptance/);
  assert.doesNotMatch(sql, /l\.email|l\.phone|l\.contact_name|l\.message|l\.admin_note/);
  assert.match(sql, /mcp_orders_list/);
  assert.match(sql, /mcp_orders_get/);
  assert.match(sql, /mcp_b2b_list_leads/);
  assert.match(sql, /mcp_b2b_get_lead/);
});

test("CM-MCP-3 keeps the storefront MCP route hard fail-closed", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /CM_MCP_REMOTE_ENDPOINT_NOT_ACTIVATED/);
  assert.match(route, /status: 503/);
  assert.match(route, /isolated-edge-pending/);
  assert.doesNotMatch(route, /createMcpHandler|initialize|tools\/call|supabase/i);
});
