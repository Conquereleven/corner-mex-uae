export type OrderQueryResult<T> = { data: T | null; error: unknown };

export async function loadOwnedOrderHistory<T>(
  execute: () => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const result = await execute();
  if (result.error) throw new Error("ACCOUNT_ORDER_HISTORY_QUERY_FAILED");
  return result.data ?? [];
}

export async function loadOwnedOrderDetail<T>(
  execute: () => Promise<OrderQueryResult<T>>,
): Promise<T> {
  const result = await execute();
  if (result.error) throw new Error("ACCOUNT_ORDER_DETAIL_QUERY_FAILED");
  if (!result.data) throw new Error("ACCOUNT_ORDER_NOT_FOUND");
  return result.data;
}

export type CustomerOrderHistoryView =
  | { kind: "loading" }
  | { kind: "query_failed"; message: string; retryable: true }
  | { kind: "empty"; message: string }
  | { kind: "orders"; orders: unknown[] };

export function getCustomerOrderHistoryView(input: {
  isLoading: boolean;
  isError: boolean;
  data: unknown[] | undefined;
}): CustomerOrderHistoryView {
  if (input.isLoading) return { kind: "loading" };
  if (input.isError) {
    return {
      kind: "query_failed",
      message: "We couldn't load your orders.",
      retryable: true,
    };
  }
  if (!input.data?.length) {
    return { kind: "empty", message: "You have no orders yet." };
  }
  return { kind: "orders", orders: input.data };
}

export type CustomerOrderDetailView<T> =
  | { kind: "loading" }
  | { kind: "order"; order: T }
  | { kind: "not_found"; title: string; message: string; retryable: true }
  | { kind: "query_failed"; title: string; message: string; retryable: true };

export function getCustomerOrderDetailView<T>(input: {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
}): CustomerOrderDetailView<T> {
  if (input.isLoading) return { kind: "loading" };
  if (input.data) return { kind: "order", order: input.data };

  const code = input.error instanceof Error ? input.error.message : "";
  if (code === "ACCOUNT_ORDER_NOT_FOUND") {
    return {
      kind: "not_found",
      title: "Order unavailable",
      message: "This order could not be found or is not available to your account.",
      retryable: true,
    };
  }
  return {
    kind: "query_failed",
    title: "We couldn't load this order",
    message: "Order details are temporarily unavailable. Please try again.",
    retryable: true,
  };
}

export function presentCanonicalCustomerOrder(order: {
  order_number: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  subtotal_aed: number | string;
  shipping_aed: number | string;
  tax_aed: number | string;
  total_aed: number | string;
}) {
  const aed = (value: number | string) => `${Number(value).toFixed(2)} AED`;
  return {
    orderNumber: order.order_number,
    orderStatus: order.status,
    paymentMethod: order.payment_method?.toUpperCase() ?? "—",
    paymentStatus: order.payment_status,
    subtotal: aed(order.subtotal_aed),
    shipping: aed(order.shipping_aed),
    tax: aed(order.tax_aed),
    total: aed(order.total_aed),
  };
}

export type SellerItemAction = {
  label: string;
  nextStatus: "preparing" | "cancelled" | "delivered";
  variant: "default" | "outline";
};

export function getSellerItemActions(status: string): SellerItemAction[] {
  if (status === "pending") {
    return [
      { label: "Start preparing", nextStatus: "preparing", variant: "default" },
      { label: "Cancel item", nextStatus: "cancelled", variant: "outline" },
    ];
  }
  if (status === "shipped") {
    return [{ label: "Mark delivered", nextStatus: "delivered", variant: "default" }];
  }
  return [];
}

export function getSellerOrderDetailExperience(data: {
  items?: Array<{ id: string; fulfillment_status?: string | null }>;
  shipments?: unknown[];
  notes?: unknown[];
  events?: unknown[];
}) {
  return {
    fulfillmentProgress: true,
    shipmentPresentation: (data.shipments?.length ?? 0) > 0,
    internalNotes: true,
    adminLifecycleControls: false,
    itemControls: (data.items ?? []).map((item) => ({
      itemId: item.id,
      actions: getSellerItemActions(item.fulfillment_status ?? ""),
    })),
    mutationAuthority: {
      item: "setOrderItemStatus",
      note: "sellerAddOrderNote",
    } as const,
  };
}

export function getAdminOrderDetailRouteView<T>(input: {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
}): "loading" | "query_failed" | "ready" {
  if (input.isLoading) return "loading";
  if (input.error || !input.data) return "query_failed";
  return "ready";
}
