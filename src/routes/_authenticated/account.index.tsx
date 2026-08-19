import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { CustomerOrderHistorySurface } from "@/components/account/CustomerOrderHistory";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyAccount, getMyOrders } from "@/lib/account.functions";
import { getReviewableItems } from "@/lib/reviews.functions";
import { isAdmin } from "@/lib/admin.functions";
import { getMyLoyalty } from "@/lib/loyalty.functions";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerOrderHistoryView } from "@/lib/order-experience-contract";

export { CustomerOrderHistorySurface, OrderRow } from "@/components/account/CustomerOrderHistory";

type ReviewableItem = {
  order_item_id: string;
  product_name: string;
  product_slug: string | null;
  variant_label: string | null;
};

export const Route = createFileRoute("/_authenticated/account/")({
  head: () => ({ meta: [{ title: "Account — Corner Mex" }] }),
  component: Account,
});

function Account() {
  const fetchAccount = useServerFn(getMyAccount);
  const fetchOrders = useServerFn(getMyOrders);
  const fetchIsAdmin = useServerFn(isAdmin);
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders({}) });
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => fetchIsAdmin({}) });
  const loyalty = useQuery({ queryKey: ["my-loyalty"], queryFn: () => fetchLoyalty({}) });
  const fetchReviewable = useServerFn(getReviewableItems);
  const reviewable = useQuery({ queryKey: ["my-reviewable"], queryFn: () => fetchReviewable({}) });
  const ordersView = getCustomerOrderHistoryView({
    isLoading: orders.isLoading,
    isError: orders.isError,
    data: orders.data,
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-tight">My account</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{account.data?.email}</span>
              {loyalty.data && (
                <Badge variant="outline" className="uppercase tracking-wider">
                  {loyalty.data.account.tier} · {loyalty.data.account.points_balance} pts
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {account.data?.seller && (
              <Link to="/seller">
                <Button variant="outline" className="rounded-full">
                  Seller dashboard
                </Button>
              </Link>
            )}
            {admin.data?.admin && (
              <Link to="/admin">
                <Button variant="outline" className="rounded-full">
                  Admin
                </Button>
              </Link>
            )}
            <AccountNavigation includeHome={false} />
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Recent orders</CardTitle>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/account/orders">View all orders</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <CustomerOrderHistorySurface view={ordersView} onRetry={() => orders.refetch()} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {(reviewable.data ?? []).length > 0 && (
              <PendingReviewsCard items={reviewable.data as ReviewableItem[]} />
            )}
            {!account.data?.seller && <BecomeSellerCard />}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function PendingReviewsCard({ items }: { items: ReviewableItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Share your experience on items you received.
        </p>
        <ul className="space-y-2">
          {items.slice(0, 5).map((it) => (
            <li
              key={it.order_item_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{it.product_name}</p>
                {it.variant_label && (
                  <p className="truncate text-xs text-muted-foreground">{it.variant_label}</p>
                )}
              </div>
              {it.product_slug && (
                <Link to="/product/$slug" params={{ slug: it.product_slug }}>
                  <Button size="sm" variant="outline" className="rounded-full">
                    Review
                  </Button>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BecomeSellerCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seller onboarding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Seller applications are not active during this launch stage. Existing customers can
          continue to use B2C ordering and the manual B2B quote flow.
        </p>
        <Button className="w-full rounded-full" disabled>
          Applications coming soon
        </Button>
      </CardContent>
    </Card>
  );
}
