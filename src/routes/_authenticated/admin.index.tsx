import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { adminOverviewCanonical } from "@/lib/admin-overview.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/site/EmptyState";
import { statusColor } from "@/lib/dashboard-tokens";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overview" }] }),
  component: AdminHome,
});

const AED = (value: number) =>
  `${Number(value ?? 0).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} AED`;
const N = (value: number) => Number(value ?? 0).toLocaleString("en-US");

function AdminHome() {
  const overview = useServerFn(adminOverviewCanonical);
  const query = useQuery({
    queryKey: ["admin-overview-canonical"],
    queryFn: () => overview({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Commerce overview</h1>
          <p className="text-sm text-muted-foreground">Loading canonical commerce metrics…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Admin overview could not be loaded"
        description="Canonical commerce metrics are temporarily unavailable. No fallback data was fabricated."
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const data = query.data;
  const kpis = [
    {
      label: "GMV · 30 days",
      value: AED(data.gmv30),
      hint: `Today ${AED(data.gmvToday)}`,
      icon: DollarSign,
    },
    {
      label: "Orders · 30 days",
      value: N(data.orders30),
      hint: `Today ${N(data.ordersToday)} · 7d ${N(data.orders7)}`,
      icon: ShoppingCart,
    },
    {
      label: "Average order value",
      value: AED(data.aov),
      hint: `${N(data.uniqueBuyers30)} unique buyers · 30d`,
      icon: TrendingUp,
    },
    {
      label: "Customers",
      value: N(data.buyers),
      hint: `${N(data.uniqueBuyers30)} active · 30d`,
      icon: Users,
    },
    {
      label: "Active products",
      value: N(data.activeProducts),
      hint: `${N(data.draftProducts)} drafts · ${N(data.products)} total`,
      icon: Package,
    },
    {
      label: "Pending fulfillment",
      value: N(data.pendingFulfillment),
      hint: "Pending + confirmed + processing",
      icon: Package,
    },
    {
      label: "Low-stock variants",
      value: N(data.lowStockCount),
      hint: "5 units or fewer",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Commerce overview</h1>
          <p className="text-sm text-muted-foreground">
            Canonical first-party order, customer and catalog metrics. Refreshed every 60 seconds.
          </p>
        </div>
        <Badge variant="outline">Canonical production model</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl tracking-tight tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order lifecycle · last 60 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.statusBreakdown.map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="flex items-center gap-2 capitalize">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: statusColor(row.status) }}
                  />
                  {row.status}
                </span>
                <span className="font-mono tabular-nums">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment lifecycle · last 60 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.paymentBreakdown.map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="capitalize">{row.status.replace(/_/g, " ")}</span>
                <span className="font-mono tabular-nums">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/orders">Open orders</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              data.recentOrders.map((order: any) => (
                <Link
                  key={order.id}
                  to="/admin/orders/$id"
                  params={{ id: order.id }}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums">{AED(Number(order.total_aed))}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {order.status} · {order.payment_status}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products by GMV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order-item revenue yet.</p>
            ) : (
              data.topProducts.map((product) => (
                <div key={product.id} className="rounded-md border px-3 py-3">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {N(product.units)} units · {AED(product.gmv)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
