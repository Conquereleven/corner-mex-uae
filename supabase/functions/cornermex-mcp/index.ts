import {
  buildOAuthProtectedResourceMetadata,
  createMcpHandler,
  hostHeaderValidationResponse,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  OAuthMetadataSchema,
  originValidationResponse,
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

type OAuthMetadata = z.infer<typeof OAuthMetadataSchema>;
type McpPermission = "catalog:read" | "inventory:read" | "orders:read" | "b2b:read" | "ops:read";

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

function optionalHostnameList(name: string): string[] {
  const value = Deno.env.get(name)?.trim();
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function publicMcpUrl(): URL {
  const url = new URL(requiredEnv("MCP_PUBLIC_URL"));
  if (url.protocol !== "https:" || url.search || url.hash) {
    throw new Error("CornerMex MCP public URL must be HTTPS without query or fragment");
  }
  return url;
}

function supabaseIssuer(): string {
  return `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/auth/v1`;
}

function protectedResourceMetadataUrl(): string {
  const resourceUrl = publicMcpUrl();
  const resourcePath = resourceUrl.pathname.replace(/\/$/, "");
  return new URL(`${resourcePath}/.well-known/oauth-protected-resource`, resourceUrl.origin).href;
}

function allowedHostnames(): string[] {
  const supabaseHostname = new URL(requiredEnv("SUPABASE_URL")).hostname;
  return Array.from(
    new Set([
      supabaseHostname,
      publicMcpUrl().hostname,
      ...optionalHostnameList("MCP_ALLOWED_HOSTNAMES"),
    ]),
  );
}

function allowedOriginHostnames(): string[] {
  return optionalHostnameList("MCP_ALLOWED_ORIGIN_HOSTNAMES");
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
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.sub !== data.user.id) throw new Error("JWT subject mismatch");
    if (!payload.client_id?.trim()) throw new Error("OAuth client_id is required");
    if (!payload.exp || payload.exp <= now) throw new Error("JWT expired");
    if (payload.iss !== supabaseIssuer()) throw new Error("JWT issuer mismatch");
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
const authGate = requireBearerAuth({
  verifier,
  resourceMetadataUrl: protectedResourceMetadataUrl(),
});

let oauthMetadataPromise: Promise<OAuthMetadata> | undefined;

async function fetchSupabaseOAuthMetadata(): Promise<OAuthMetadata> {
  const issuer = new URL(supabaseIssuer());
  const pathAwareDiscovery = new URL(
    `/.well-known/oauth-authorization-server${issuer.pathname}`,
    issuer.origin,
  );
  const issuerLocalDiscovery = new URL(
    `${issuer.pathname}/.well-known/oauth-authorization-server`,
    issuer.origin,
  );

  let lastError: unknown;
  for (const url of [pathAwareDiscovery, issuerLocalDiscovery]) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        redirect: "error",
      });
      if (!response.ok) throw new Error("OAuth discovery request failed");
      const metadata = OAuthMetadataSchema.parse(await response.json());
      if (metadata.issuer !== issuer.href.replace(/\/$/, "")) {
        throw new Error("OAuth discovery issuer mismatch");
      }
      return metadata;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Supabase OAuth discovery unavailable");
}

function currentOAuthMetadata(): Promise<OAuthMetadata> {
  oauthMetadataPromise ??= fetchSupabaseOAuthMetadata().catch((error) => {
    oauthMetadataPromise = undefined;
    throw error;
  });
  return oauthMetadataPromise;
}

function metadataCorsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}

async function protectedResourceMetadataResponse(request: Request): Promise<Response | null> {
  const metadataUrl = new URL(protectedResourceMetadataUrl());
  if (
    new URL(request.url).pathname.replace(/\/$/, "") !== metadataUrl.pathname.replace(/\/$/, "")
  ) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...metadataCorsHeaders(),
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        ...(request.headers.get("access-control-request-headers")
          ? {
              "access-control-allow-headers": request.headers.get(
                "access-control-request-headers",
              )!,
              vary: "Access-Control-Request-Headers",
            }
          : {}),
      },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: "method_not_allowed" },
      {
        status: 405,
        headers: { ...metadataCorsHeaders(), allow: "GET, HEAD, OPTIONS" },
      },
    );
  }

  try {
    const oauthMetadata = await currentOAuthMetadata();
    const metadata = buildOAuthProtectedResourceMetadata({
      oauthMetadata,
      resourceServerUrl: publicMcpUrl(),
      resourceName: "CornerMex Operations MCP",
    });
    const response = Response.json(metadata, { headers: metadataCorsHeaders() });
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  } catch {
    return Response.json(
      { error: "oauth_metadata_unavailable" },
      { status: 503, headers: metadataCorsHeaders() },
    );
  }
}

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
          description:
            "Get one minimized CornerMex order and line-item summary without shipping PII.",
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

Deno.serve(async (request: Request): Promise<Response> => {
  const hostFailure = hostHeaderValidationResponse(request, allowedHostnames());
  if (hostFailure) return hostFailure;

  const metadata = await protectedResourceMetadataResponse(request);
  if (metadata) return metadata;

  const originFailure = originValidationResponse(request, allowedOriginHostnames());
  if (originFailure) return originFailure;

  const auth = await authGate(request);
  if (auth instanceof Response) return auth;

  return handler.fetch(request, { authInfo: auth });
});
