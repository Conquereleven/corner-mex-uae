import {
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
  type AuthInfo,
} from "npm:@modelcontextprotocol/server@2.0.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";
import * as z from "npm:zod@4";

type JwtPayload = {
  aud?: string | string[];
  client_id?: string;
  exp?: number;
  iss?: string;
  sub?: string;
};

type McpPermission =
  | "catalog:read"
  | "inventory:read"
  | "orders:read"
  | "b2b:read"
  | "ops:read";

const READ_PERMISSIONS = new Set<McpPermission>([
  "catalog:read",
  "inventory:read",
  "orders:read",
  "b2b:read",
  "ops:read",
]);

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required CornerMex MCP environment: ${name}`);
  return value;
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT shape");
  const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as JwtPayload;
}

function audienceIncludesAuthenticated(audience: JwtPayload["aud"]): boolean {
  if (typeof audience === "string") return audience === "authenticated";
  return Array.isArray(audience) && audience.includes("authenticated");
}

function authClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_PUBLISHABLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function requestClient(token: string): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_PUBLISHABLE_KEY"), {
    accessToken: async () => token,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { "x-cornermex-access-mode": "mcp-read-only" } },
  });
}

async function verifyAccessToken(token: string): Promise<AuthInfo> {
  try {
    const client = authClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new Error("Supabase Auth rejected access token");

    const payload = decodeJwtPayload(token);
    const expectedIssuer = `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/auth/v1`;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.sub !== data.user.id) throw new Error("JWT subject mismatch");
    if (!payload.client_id?.trim()) throw new Error("OAuth client_id is required");
    if (!payload.exp || payload.exp <= now) throw new Error("JWT expired");
    if (payload.iss !== expectedIssuer) throw new Error("JWT issuer mismatch");
    if (!audienceIncludesAuthenticated(payload.aud)) throw new Error("JWT audience mismatch");

    return {
      token,
      clientId: payload.client_id,
      scopes: [],
      expiresAt: payload.exp,
    };
  } catch {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "CornerMex MCP access token is invalid");
  }
}

const verifier = { verifyAccessToken };
const authGate = requireBearerAuth({ verifier });

async function currentPermissions(client: SupabaseClient): Promise<Set<McpPermission>> {
  const { data, error } = await client.rpc("mcp_current_permissions");
  if (error || !Array.isArray(data)) throw new Error("CornerMex MCP permission lookup failed");

  const permissions = new Set<McpPermission>();
  for (const value of data) {
    if (typeof value === "string" && READ_PERMISSIONS.has(value as McpPermission)) {
      permissions.add(value as McpPermission);
    }
  }
  return permissions;
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function readFailure() {
  return {
    content: [{ type: "text" as const, text: "CornerMex MCP read operation failed." }],
    isError: true,
  };
}

async function callReadRpc(
  client: SupabaseClient,
  functionName: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) return readFailure();
  return textResult(data);
}

const handler = createMcpHandler(
  async ({ authInfo }) => {
    if (!authInfo?.token) throw new Error("CornerMex MCP authorization context missing");

    const client = requestClient(authInfo.token);
    const permissions = await currentPermissions(client);
    const server = new McpServer({ name: "cornermex-operations", version: "cm-mcp-3" });

    if (permissions.has("catalog:read")) {
      server.registerTool(
        "catalog.search",
        {
          description: "Search the active CornerMex catalogue.",
          inputSchema: z.object({
            q: z.string().trim().max(120).optional(),
            lang: z.enum(["en", "es", "ar"]).default("en"),
            limit: z.number().int().min(1).max(50).default(20),
          }),
        },
        async ({ q, lang, limit }) =>
          callReadRpc(client, "mcp_catalog_search", {
            p_q: q ?? null,
            p_lang: lang,
            p_limit: limit,
          }),
      );

      server.registerTool(
        "catalog.get_product",
        {
          description: "Get one active CornerMex catalogue product by id or slug.",
          inputSchema: z.object({
            identifier: z.string().trim().min(1).max(160),
            lang: z.enum(["en", "es", "ar"]).default("en"),
          }),
        },
        async ({ identifier, lang }) =>
          callReadRpc(client, "mcp_catalog_get_product", {
            p_identifier: identifier,
            p_lang: lang,
          }),
      );
    }

    if (permissions.has("inventory:read")) {
      server.registerTool(
        "inventory.get_availability",
        {
          description: "Read current sellable availability for a CornerMex product or variant.",
          inputSchema: z.object({ identifier: z.string().trim().min(1).max(160) }),
        },
        async ({ identifier }) =>
          callReadRpc(client, "mcp_inventory_get_availability", { p_identifier: identifier }),
      );
    }

    if (permissions.has("orders:read")) {
      server.registerTool(
        "orders.list",
        {
          description: "List minimized CornerMex order operations data without shipping PII.",
          inputSchema: z.object({
            status: z
              .enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"])
              .optional(),
            limit: z.number().int().min(1).max(50).default(20),
          }),
        },
        async ({ status, limit }) =>
          callReadRpc(client, "mcp_orders_list", {
            p_status: status ?? null,
            p_limit: limit,
          }),
      );

      server.registerTool(
        "orders.get",
        {
          description: "Get one minimized CornerMex order and line-item summary without shipping PII.",
          inputSchema: z.object({ identifier: z.string().trim().min(1).max(160) }),
        },
        async ({ identifier }) =>
          callReadRpc(client, "mcp_orders_get", { p_identifier: identifier }),
      );
    }

    if (permissions.has("b2b:read")) {
      server.registerTool(
        "b2b.list_leads",
        {
          description: "List minimized B2B pipeline records without direct contact PII.",
          inputSchema: z.object({
            status: z.enum(["new", "contacted", "quoting", "won", "lost"]).optional(),
            limit: z.number().int().min(1).max(50).default(20),
          }),
        },
        async ({ status, limit }) =>
          callReadRpc(client, "mcp_b2b_list_leads", {
            p_status: status ?? null,
            p_limit: limit,
          }),
      );

      server.registerTool(
        "b2b.get_lead",
        {
          description: "Get one minimized B2B pipeline record without direct contact PII.",
          inputSchema: z.object({ id: z.string().uuid() }),
        },
        async ({ id }) => callReadRpc(client, "mcp_b2b_get_lead", { p_id: id }),
      );
    }

    if (permissions.has("ops:read")) {
      server.registerTool(
        "ops.summary",
        {
          description: "Read an aggregate CornerMex operating summary with no customer PII.",
          inputSchema: z.object({}),
        },
        async () => callReadRpc(client, "mcp_ops_summary"),
      );
    }

    return server;
  },
  {
    legacy: "reject",
    responseMode: "json",
    onerror: () => console.error("[cornermex-mcp] request failed"),
  },
);

function validateRequestBoundary(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (host && host !== requestUrl.host) {
    return Response.json({ error: "invalid_request_host" }, { status: 400 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigin = Deno.env.get("MCP_ALLOWED_ORIGIN")?.trim();
    if (!allowedOrigin || origin !== allowedOrigin) {
      return Response.json({ error: "invalid_request_origin" }, { status: 403 });
    }
  }

  return null;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;

  const auth = await authGate(request);
  if (auth instanceof Response) return auth;

  return handler.fetch(request, { authInfo: auth });
});
