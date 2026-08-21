import {
  CORNERMEX_MCP_TOOLS,
  type CornerMexMcpPermission,
  type CornerMexMcpToolName,
  isMcpMutationTool,
  requiredPermissionForMcpTool,
} from "./mcp-contract.ts";

export const CORNERMEX_MCP_PROTOCOL_VERSION = "2026-07-28";

export type CornerMexMcpPrincipal = {
  userId: string;
  clientId: string;
  permissions: ReadonlySet<CornerMexMcpPermission>;
};

export type CornerMexMcpReadAdapter = {
  execute(tool: CornerMexMcpToolName, args: Record<string, unknown>): Promise<unknown>;
};

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const READ_TOOL_DESCRIPTIONS: Record<
  Extract<CornerMexMcpToolName, `${string}.${string}`>,
  string
> = {
  "catalog.search": "Search the CornerMex catalogue.",
  "catalog.get_product": "Get one catalogue product by canonical identifier.",
  "inventory.get_availability": "Read current product availability.",
  "orders.list": "List orders visible to the authorized operator.",
  "orders.get": "Get one order and its operational detail.",
  "b2b.list_leads": "List B2B enquiries visible to the authorized operator.",
  "b2b.get_lead": "Get one B2B enquiry and its operational detail.",
  "ops.summary": "Read a concise CornerMex operations summary.",
  "b2b.update_lead": "Write capability disabled in CM-MCP-2.",
  "b2b.add_note": "Write capability disabled in CM-MCP-2.",
  "orders.add_note": "Write capability disabled in CM-MCP-2.",
  "orders.transition_status": "Write capability disabled in CM-MCP-2.",
};

export const CORNERMEX_MCP_READ_TOOLS = Object.entries(CORNERMEX_MCP_TOOLS)
  .filter(([, contract]) => contract.mode === "read")
  .map(([name, contract]) => ({
    name: name as CornerMexMcpToolName,
    description: READ_TOOL_DESCRIPTIONS[name as CornerMexMcpToolName],
    permission: contract.permission,
    inputSchema: { type: "object", additionalProperties: true },
  }));

function response(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function error(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function parseToolName(value: unknown): CornerMexMcpToolName | null {
  if (typeof value !== "string") return null;
  return value in CORNERMEX_MCP_TOOLS ? (value as CornerMexMcpToolName) : null;
}

export async function handleCornerMexMcpRequest({
  request,
  principal,
  adapter,
}: {
  request: JsonRpcRequest;
  principal: CornerMexMcpPrincipal | null;
  adapter: CornerMexMcpReadAdapter;
}): Promise<JsonRpcResponse> {
  const id = request.id ?? null;

  if (request.jsonrpc !== "2.0") return error(id, -32600, "Invalid Request");

  if (request.method === "initialize") {
    return response(id, {
      protocolVersion: CORNERMEX_MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "cornermex-operations", version: "cm-mcp-2" },
    });
  }

  if (!principal) return error(id, -32001, "CornerMex MCP authorization required");

  if (request.method === "tools/list") {
    return response(id, {
      tools: CORNERMEX_MCP_READ_TOOLS.filter((tool) => principal.permissions.has(tool.permission)).map(
        ({ permission: _permission, ...tool }) => tool,
      ),
    });
  }

  if (request.method === "tools/call") {
    const name = parseToolName(request.params?.name);
    if (!name) return error(id, -32602, "Unknown CornerMex MCP tool");
    if (isMcpMutationTool(name)) return error(id, -32003, "Write tools are disabled in CM-MCP-2");

    const permission = requiredPermissionForMcpTool(name);
    if (!principal.permissions.has(permission)) {
      return error(id, -32002, "CornerMex MCP permission denied", { permission });
    }

    const args = request.params?.arguments;
    if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
      return error(id, -32602, "Tool arguments must be an object");
    }

    try {
      const data = await adapter.execute(name, (args as Record<string, unknown> | undefined) ?? {});
      return response(id, {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
        isError: false,
      });
    } catch {
      return error(id, -32000, "CornerMex MCP read operation failed");
    }
  }

  return error(id, -32601, "Method not found");
}
