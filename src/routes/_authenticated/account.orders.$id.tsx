import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyOrderDetail } from "@/lib/account.functions";
import {
  getCustomerOrderDetailView,
  presentCanonicalCustomerOrder,
  type CustomerOrderDetailView,
} from "@/lib/order-experience-contract";

export const Route = createFileRoute("/_authenticated/account/orders/$id")({
  head: () => ({ meta: [{ title: "My order — Corner Mex" }] }),
  component: CustomerOrderDetail,
});

const aed = (value: number | string) => `${Number(value).toFixed(2)} AED`;

type CustomerOrderItem = {
  id: string;
  product_name: string;
  variant_label: string | null;
  qty: number;
  line_total_aed: number | string;
};

type CustomerOrder = {
  order_number: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal_aed: number | string;
  shipping_aed: number | string;
  tax_aed: number | string;
  total_aed: number | string;
  shipping_address: Record<string, string | null> | null;
  items: CustomerOrderItem[];
};

function CustomerOrderDetail() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getMyOrderDetail);
  const order = useQuery({
    queryKey: ["my-order", id],
    queryFn: () => fetchOrder({ data: { orderId: id } }),
  });
  const view = getCustomerOrderDetailView<CustomerOrder>({
    isLoading: order.isLoading,
    error: order.error,
    data: order.data as CustomerOrder | undefined,
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Button asChild variant="ghost" className="mb-5">
          <Link to="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" /> My Orders
          </Link>
        </Button>

        <CustomerOrderDetailSurface view={view} onRetry={() => order.refetch()} />
      </section>
    </SiteLayout>
  );
}

export function CustomerOrderDetailSurface({
  view,
  onRetry,
}: {
  view: CustomerOrderDetailView<CustomerOrder>;
  onRetry: () => unknown;
}) {
  if (view.kind === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (view.kind === "not_found" || view.kind === "query_failed") {
    return (
      <Card role="alert" data-state={view.kind}>
        <CardHeader>
          <CardTitle>{view.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{view.message}</p>
          <Button data-testid="customer-detail-retry" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <OrderDetail order={view.order} />;
}

export function OrderDetail({ order }: { order: CustomerOrder }) {
  const address = order.shipping_address ?? {};
  const display = presentCanonicalCustomerOrder(order);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Order</p>
          <h1 className="font-display text-4xl tracking-tight">{display.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{display.orderStatus}</Badge>
          <Badge variant="outline">{display.paymentStatus}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {(order.items ?? []).map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.variant_label, `Qty ${item.qty}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="tabular-nums">{aed(item.line_total_aed)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Total label="Subtotal" value={display.subtotal} />
              <Total label="Shipping" value={display.shipping} />
              <Total label="Tax" value={display.tax} />
              <Total label="Total" value={display.total} strong />
              <Total label="Payment method" value={display.paymentMethod} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>{address.recipient_name ?? "Recipient not available"}</p>
            <p>
              {[address.area, address.emirate].filter(Boolean).join(", ") ||
                "Delivery area unavailable"}
            </p>
            <p>
              {[address.street, address.building, address.floor_apartment]
                .filter(Boolean)
                .join(", ")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Total({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t pt-2 font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
