import { createFileRoute } from "@tanstack/react-router";

function mcpNotActivatedResponse() {
  return Response.json(
    {
      error: "CM_MCP_REMOTE_ENDPOINT_NOT_ACTIVATED",
      message: "CornerMex MCP is isolated from the storefront and is not remotely activated.",
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-cornermex-mcp-state": "isolated-edge-pending",
      },
    },
  );
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: async () => mcpNotActivatedResponse(),
      POST: async () => mcpNotActivatedResponse(),
    },
  },
});
