import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminGetOrderDetail } from "@/lib/admin.functions";
import { OrderDetailView } from "@/components/site/OrderDetailView";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  head: () => ({ meta: [{ title: "Admin — Order" }] }),
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(adminGetOrderDetail);
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => fn({ data: { id } }) });

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
        description={(q.error as Error)?.message ?? "Order not found"}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => q.refetch()}>
              Try again
            </Button>
            <Button asChild>
              <Link to="/admin/orders">Back to orders</Link>
            </Button>
          </div>
        }
      />
    );

  return (
    <OrderDetailView
      role="admin"
      data={q.data}
      invalidateKey={["admin-order", id]}
      backHref="/admin/orders"
      customerHref="/admin/customers/$id"
    />
  );
}
