export function resolveOwnedOrderDetail<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw new Error("ACCOUNT_ORDER_DETAIL_QUERY_FAILED");
  if (!result.data) throw new Error("ACCOUNT_ORDER_NOT_FOUND");
  return result.data;
}

export function resolveLifecycleAudit<T>(result: { data: T[] | null; error: unknown }): T[] {
  if (result.error) throw new Error("CM_COM_4A_AUDIT_QUERY_FAILED");
  return result.data ?? [];
}
