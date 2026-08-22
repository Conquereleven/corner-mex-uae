import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edgeUrl = new URL("../../supabase/functions/cornermex-mcp/index.ts", import.meta.url);
const proposalUrl = new URL("../../docs/mcp/CM-MCP-3-DB-PROPOSAL.md", import.meta.url);
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

test("CM-MCP-3 exposes protected-resource discovery through the bearer challenge", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  assert.match(edge, /buildOAuthProtectedResourceMetadata/);
  assert.match(edge, /OAuthMetadataSchema/);
  assert.match(edge, /MCP_PUBLIC_URL/);
  assert.match(edge, /resourceMetadataUrl: protectedResourceMetadataUrl\(\)/);
  assert.match(edge, /\.well-known\/oauth-protected-resource/);
  assert.match(edge, /\.well-known\/oauth-authorization-server/);
  assert.match(edge, /resourceName: "CornerMex Operations MCP"/);
  assert.match(edge, /access-control-allow-origin": "\*"/);

  const metadataIndex = edge.indexOf("await protectedResourceMetadataResponse(request)");
  const originIndex = edge.indexOf("const originFailure = originValidationResponse");
  assert.ok(metadataIndex >= 0);
  assert.ok(originIndex > metadataIndex);
});

test("CM-MCP-3 uses SDK Host and Origin validation with explicit allowlists", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  assert.match(edge, /hostHeaderValidationResponse/);
  assert.match(edge, /originValidationResponse/);
  assert.match(edge, /MCP_ALLOWED_HOSTNAMES/);
  assert.match(edge, /MCP_ALLOWED_ORIGIN_HOSTNAMES/);
  assert.match(edge, /publicMcpUrl\(\)\.hostname/);
  assert.doesNotMatch(edge, /host\s*!==\s*requestUrl\.host/);
});

test("CM-MCP-3 never uses privileged Supabase credentials or direct table access", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  assert.match(edge, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(edge, /service[_-]?role|SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/i);
  assert.doesNotMatch(edge, /\.from\s*\(\s*["'\x60]/);
  assert.match(edge, /\.rpc\("mcp_current_permissions"\)/);
});

test("CM-MCP-3 exposes exactly the reviewed read tool family and no write tools", async () => {
  const edge = await readFile(edgeUrl, "utf8");

  for (const tool of readTools) {
    assert.match(edge, new RegExp(`"${tool.replace(".", "\\.")}"`));
  }
  for (const tool of writeTools) {
    assert.doesNotMatch(edge, new RegExp(tool.replace(".", "\\.")));
  }
});

test("CM-MCP-3 keeps the database change as a non-executable proposal", async () => {
  const proposal = await readFile(proposalUrl, "utf8");

  assert.match(proposal, /Design proposal only\. Not a migration/i);
  assert.match(proposal, /commerce_private\.mcp_grants/);
  assert.match(proposal, /auth\.uid\(\)/);
  assert.match(proposal, /auth\.jwt\(\)->>'client_id'/);
  assert.match(proposal, /active and unexpired/i);
  assert.match(proposal, /RLS enabled/i);
  assert.match(proposal, /revoke/i);

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
    assert.match(proposal, new RegExp(`\`${permission}\``));
  }
});

test("CM-MCP-3 documents minimized order and B2B RPC boundaries", async () => {
  const proposal = await readFile(proposalUrl, "utf8");

  assert.match(proposal, /exclude `buyer_id`, `shipping_address` and `legal_acceptance`/);
  assert.match(proposal, /exclude `contact_name`, `email`, `phone`/);
  assert.match(proposal, /mcp_orders_list/);
  assert.match(proposal, /mcp_orders_get/);
  assert.match(proposal, /mcp_b2b_list_leads/);
  assert.match(proposal, /mcp_b2b_get_lead/);
});

test("CM-MCP-3 keeps the storefront MCP route hard fail-closed", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /CM_MCP_REMOTE_ENDPOINT_NOT_ACTIVATED/);
  assert.match(route, /status: 503/);
  assert.match(route, /isolated-edge-pending/);
  assert.doesNotMatch(route, /createMcpHandler|initialize|tools\/call|supabase/i);
});
