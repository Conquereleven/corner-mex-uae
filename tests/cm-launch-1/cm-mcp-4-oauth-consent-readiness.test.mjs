import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

const consentPath = "src/routes/oauth.consent.tsx";
const envPath = ".env.example";
const edgePath = "supabase/functions/cornermex-mcp/index.ts";
const runbookPath = "docs/mcp/CM-MCP-4-ACTIVATION-READINESS.md";

test("CM-MCP-4 consent route preserves a bounded authorization id through safe internal login", async () => {
  const consent = await read(consentPath);

  assert.match(consent, /authorization_id: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(512\)\.optional\(\)/);
  assert.match(consent, /supabase\.auth\.getUser\(\)/);
  assert.match(consent, /\/oauth\/consent\?authorization_id=/);
  assert.match(consent, /navigate\(\{ to: "\/login", search: \{ redirect: returnTo \}/);
  assert.doesNotMatch(consent, /window\.location\.assign\(authorizationId\)/);
});

test("CM-MCP-4 delegates authorization details and consent decisions to Supabase OAuth", async () => {
  const consent = await read(consentPath);

  assert.match(consent, /supabase\.auth\.oauth\.getAuthorizationDetails\(authorizationId\)/);
  assert.match(consent, /supabase\.auth\.oauth\.approveAuthorization\(authorizationId\)/);
  assert.match(consent, /supabase\.auth\.oauth\.denyAuthorization\(authorizationId\)/);
  assert.match(consent, /window\.location\.assign\(result\.data\.redirect_url\)/);
  assert.match(consent, /OAuth consent does not by itself grant operational data access/);
});

test("CM-MCP-4 keeps the isolated Edge deployment configuration fail-closed", async () => {
  const [env, edge] = await Promise.all([read(envPath), read(edgePath)]);

  assert.match(env, /^MCP_PUBLIC_URL=$/m);
  assert.match(env, /^MCP_ALLOWED_HOSTNAMES=$/m);
  assert.match(env, /^MCP_ALLOWED_ORIGIN_HOSTNAMES=$/m);
  assert.doesNotMatch(env, /^MCP_.*SERVICE_ROLE/m);
  assert.match(edge, /Deno\.env\.get\("MCP_PUBLIC_URL"\)/);
  assert.match(edge, /Deno\.env\.get\("MCP_ALLOWED_HOSTNAMES"\)/);
  assert.match(edge, /Deno\.env\.get\("MCP_ALLOWED_ORIGIN_HOSTNAMES"\)/);
  assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("CM-MCP-4 runbook keeps production mutations behind separate Founder gates", async () => {
  const runbook = await read(runbookPath);

  for (const gate of [
    "SEC-RLS-1 production apply",
    "CM-MCP-DB2 production apply",
    "OAuth server enablement",
    "OAuth client registration",
    "initial MCP grant provisioning",
    "Edge Function deployment and environment configuration",
    "first remote activation rehearsal",
  ]) {
    assert.ok(runbook.includes(gate), `${gate} must remain an explicit separate gate`);
  }

  assert.match(runbook, /dynamic client registration disabled/i);
  assert.match(runbook, /SUPABASE_SERVICE_ROLE_KEY.*must not be introduced/i);
  assert.match(runbook, /catalog:read/);
  assert.match(runbook, /inventory:read/);
  assert.match(runbook, /ops:read/);
  assert.match(runbook, /Order and B2B read permissions should remain absent/);
});
