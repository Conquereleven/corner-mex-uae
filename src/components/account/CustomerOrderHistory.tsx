import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  presentCanonicalCustomerOrder,
  type CustomerOrderHistoryView,
} from "@/lib/order-experience-contract";

type CustomerOrderRow = Parameters<typeof presentCanonicalCustomerOrder>[0] & {
  id: string;
  created_at: string;
  items?: unknown[];
  sla_min_days?: number | null;
  sla_max_days?: number | null;
};

export function CustomerOrderHistorySurface({
  view,
  onRetry,
  renderShopLink,
  renderOrderLink,
}: {
  view: CustomerOrderHistoryView;
  onRetry: () => unknown;
  renderShopLink?: () => React.ReactNode;
  renderOrderLink?: (id: string) => React.ReactNode;
}) {
  if (view.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (view.kind === "query_failed") {
    return (
      <div className="space-y-2" role="alert">
        <p className="text-sm font-medium text-destructive">{view.message}</p>
        <Button data-testid="customer-history-retry" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (view.kind === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        {view.message}{" "}
        {renderShopLink ? (
          renderShopLink()
        ) : (
          <Link to="/shop" className="underline">
            Start shopping →
          </Link>
        )}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border" data-testid="customer-order-history">
      {view.orders.map((order) => {
        const customerOrder = order as CustomerOrderRow;
        return (
          <OrderRow
            key={customerOrder.id}
            order={customerOrder}
            renderOrderLink={renderOrderLink}
          />
        );
      })}
    </ul>
  );
}

export function OrderRow({
  order,
  renderOrderLink,
}: {
  order: CustomerOrderRow;
  renderOrderLink?: (id: string) => React.ReactNode;
}) {
  const display = presentCanonicalCustomerOrder(order);

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{display.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleString()} · {order.items?.length ?? 0} items
            {order.sla_min_days ? (
              <>
                {" "}
                · ETA {order.sla_min_days}-{order.sla_max_days} days
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{display.orderStatus}</Badge>
          <Badge variant="outline">{display.paymentStatus}</Badge>
          <span className="font-medium tabular-nums">{display.total}</span>
          {renderOrderLink ? (
            renderOrderLink(order.id)
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/account/orders/$id" params={{ id: order.id }}>
                View order
              </Link>
            </Button>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt>Subtotal</dt>
          <dd>{display.subtotal}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{display.shipping}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{display.tax}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{display.paymentMethod}</dd>
        </div>
      </dl>
    </li>
  );
}
