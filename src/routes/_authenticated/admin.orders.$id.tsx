import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminGetOrderDetail } from "@/lib/admin.functions";
import {
  AdminOrderLifecycleView,
  type AdminOrderLifecycleData,
} from "@/components/site/AdminOrderLifecycleView";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getAdminOrderDetailRouteView } from "@/lib/order-experience-contract";

export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  head: () => ({ meta: [{ title: "Admin — Order" }] }),
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(adminGetOrderDetail);
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => fn({ data: { id } }) });
  const view = getAdminOrderDetailRouteView({
    isLoading: q.isLoading,
    error: q.error,
    data: q.data,
  });

  return (
    <AdminOrderDetailQuerySurface
      view={view}
      data={q.data}
      onRetry={() => q.refetch()}
      invalidateKey={["admin-order", id]}
    />
  );
}

export function AdminOrderDetailQuerySurface({
  view,
  data,
  onRetry,
  invalidateKey,
  backAction,
}: {
  view: "loading" | "query_failed" | "ready";
  data: AdminOrderLifecycleData | undefined;
  onRetry: () => unknown;
  invalidateKey: unknown[];
  backAction?: React.ReactNode;
}) {
  if (view === "loading")
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  if (view === "query_failed")
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Order could not be loaded"
        description="Order details are temporarily unavailable. Please try again."
        action={
          <div className="flex gap-2">
            <Button data-testid="admin-order-retry" variant="outline" onClick={onRetry}>
              Try again
            </Button>
            {backAction ?? (
              <Button asChild>
                <Link to="/admin/orders">Back to orders</Link>
              </Button>
            )}
          </div>
        }
      />
    );

  return (
    <AdminOrderLifecycleView
      data={data!}
      invalidateKey={invalidateKey}
      backHref="/admin/orders"
      customerHref="/admin/customers/$id"
    />
  );
}
