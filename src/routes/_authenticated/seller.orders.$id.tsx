import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { sellerGetOrderDetail } from "@/lib/seller.functions";
import { OrderDetailView } from "@/components/site/OrderDetailView";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/seller/orders/$id")({
  head: () => ({ meta: [{ title: "Seller — Order" }] }),
  component: SellerOrderDetail,
});

function SellerOrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(sellerGetOrderDetail);
  const q = useQuery({ queryKey: ["seller-order", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Order could not be loaded"
        description={
          (q.error as Error)?.message ?? "This order is not assigned to your seller account."
        }
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => q.refetch()}>
              Try again
            </Button>
            <Button asChild>
              <Link to="/seller/orders">Back to orders</Link>
            </Button>
          </div>
        }
      />
    );

  return (
    <OrderDetailView
      role="seller"
      data={q.data}
      invalidateKey={["seller-order", id]}
      backHref="/seller/orders"
      customerHref="/seller/customers/$id"
    />
  );
}
