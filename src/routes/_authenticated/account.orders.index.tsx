import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { CustomerOrderHistorySurface } from "@/components/account/CustomerOrderHistory";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyOrders } from "@/lib/account.functions";
import { getCustomerOrderHistoryView } from "@/lib/order-experience-contract";

export const Route = createFileRoute("/_authenticated/account/orders/")({
  head: () => ({ meta: [{ title: "My Orders — Intermex" }] }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const fetchOrders = useServerFn(getMyOrders);
  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders({}),
  });
  const view = getCustomerOrderHistoryView({
    isLoading: orders.isLoading,
    isError: orders.isError,
    data: orders.data,
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Account</p>
            <h1 className="font-display text-4xl tracking-tight">My Orders</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Review your Intermex order history, payment status, totals, and order details.
            </p>
          </div>
          <AccountNavigation />
        </header>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Order history</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerOrderHistorySurface view={view} onRetry={() => orders.refetch()} />
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
