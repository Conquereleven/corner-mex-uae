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

  for (const required of [
    "authorization_id: z.string().trim().min(1).max(512).optional()",
    "supabase.auth.getUser()",
    "/oauth/consent?authorization_id=",
    'to: "/login"',
    "search: { redirect: returnTo }",
    "replace: true",
  ]) {
    assert.ok(consent.includes(required), `consent route must include: ${required}`);
  }

  assert.equal(consent.includes("window.location.assign(authorizationId)"), false);
});

test("CM-MCP-4 delegates authorization details and consent decisions to Supabase OAuth", async () => {
  const consent = await read(consentPath);

  for (const required of [
    "supabase.auth.oauth.getAuthorizationDetails(authorizationId)",
    "supabase.auth.oauth.approveAuthorization(authorizationId)",
    "supabase.auth.oauth.denyAuthorization(authorizationId)",
    "window.location.assign(result.data.redirect_url)",
    "OAuth consent does not by itself grant operational data access",
  ]) {
    assert.ok(consent.includes(required), `consent route must include: ${required}`);
  }
});

test("CM-MCP-4 keeps the isolated Edge deployment configuration fail-closed", async () => {
  const [env, edge] = await Promise.all([read(envPath), read(edgePath)]);
  const envLines = new Set(env.split(/\r?\n/));

  for (const required of [
    "MCP_PUBLIC_URL=",
    "MCP_ALLOWED_HOSTNAMES=",
    "MCP_ALLOWED_ORIGIN_HOSTNAMES=",
  ]) {
    assert.ok(envLines.has(required), `.env.example must contain exact empty placeholder: ${required}`);
  }

  assert.equal(
    [...envLines].some((line) => line.startsWith("MCP_") && line.includes("SERVICE_ROLE")),
    false,
  );

  for (const required of [
    'Deno.env.get("MCP_PUBLIC_URL")',
    'Deno.env.get("MCP_ALLOWED_HOSTNAMES")',
    'Deno.env.get("MCP_ALLOWED_ORIGIN_HOSTNAMES")',
  ]) {
    assert.ok(edge.includes(required), `Edge boundary must consume: ${required}`);
  }

  assert.equal(edge.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
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

  for (const required of [
    "dynamic client registration disabled",
    "SUPABASE_SERVICE_ROLE_KEY` must not be introduced",
    "catalog:read",
    "inventory:read",
    "ops:read",
    "Order and B2B read permissions should remain absent",
  ]) {
    assert.ok(runbook.includes(required), `activation runbook must include: ${required}`);
  }
});
