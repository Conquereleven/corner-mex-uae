export const CORNERMEX_MCP_PERMISSIONS = [
  "catalog:read",
  "inventory:read",
  "orders:read",
  "orders:note",
  "orders:transition",
  "b2b:read",
  "b2b:write",
  "ops:read",
] as const;

export type CornerMexMcpPermission = (typeof CORNERMEX_MCP_PERMISSIONS)[number];

type CornerMexMcpToolContract = {
  permission: CornerMexMcpPermission;
  mode: "read" | "write";
};

export const CORNERMEX_MCP_TOOLS = {
  "catalog.search": { permission: "catalog:read", mode: "read" },
  "catalog.get_product": { permission: "catalog:read", mode: "read" },
  "inventory.get_availability": { permission: "inventory:read", mode: "read" },
  "orders.list": { permission: "orders:read", mode: "read" },
  "orders.get": { permission: "orders:read", mode: "read" },
  "b2b.list_leads": { permission: "b2b:read", mode: "read" },
  "b2b.get_lead": { permission: "b2b:read", mode: "read" },
  "ops.summary": { permission: "ops:read", mode: "read" },
  "b2b.update_lead": { permission: "b2b:write", mode: "write" },
  "b2b.add_note": { permission: "b2b:write", mode: "write" },
  "orders.add_note": { permission: "orders:note", mode: "write" },
  "orders.transition_status": { permission: "orders:transition", mode: "write" },
} as const satisfies Record<string, CornerMexMcpToolContract>;

export type CornerMexMcpToolName = keyof typeof CORNERMEX_MCP_TOOLS;

export const CORNERMEX_MCP_FORBIDDEN_CAPABILITIES = [
  "arbitrary_sql",
  "price_update",
  "inventory_adjustment",
  "catalog_import_execution",
  "payment_execution",
  "payout_execution",
  "infrastructure_mutation",
  "role_administration",
] as const;

export function requiredPermissionForMcpTool(
  toolName: CornerMexMcpToolName,
): CornerMexMcpPermission {
  return CORNERMEX_MCP_TOOLS[toolName].permission;
}

export function isMcpMutationTool(toolName: CornerMexMcpToolName): boolean {
  return CORNERMEX_MCP_TOOLS[toolName].mode === "write";
}
