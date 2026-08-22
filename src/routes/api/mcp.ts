import { createFileRoute } from "@tanstack/react-router";
import {
  handleCornerMexMcpRequest,
  type CornerMexMcpReadAdapter,
} from "../../lib/mcp-readonly.server.ts";

const inactiveAdapter: CornerMexMcpReadAdapter = {
  async execute() {
    throw new Error("CornerMex MCP data adapter is not activated");
  },
};

function invalidJsonRpcResponse() {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
    { status: 400, headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return invalidJsonRpcResponse();
        }

        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return invalidJsonRpcResponse();
        }

        const result = await handleCornerMexMcpRequest({
          request: payload as {
            jsonrpc: "2.0";
            id?: string | number | null;
            method: string;
            params?: Record<string, unknown>;
          },
          principal: null,
          adapter: inactiveAdapter,
        });

        const unauthorized = result.error?.code === -32001;
        return Response.json(result, {
          status: unauthorized ? 401 : 200,
          headers: {
            "cache-control": "no-store",
            ...(unauthorized ? { "www-authenticate": "Bearer" } : {}),
          },
        });
      },
    },
  },
});
