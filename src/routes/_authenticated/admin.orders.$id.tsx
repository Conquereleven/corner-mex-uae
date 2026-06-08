import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminGetOrderDetail } from "@/lib/admin.functions";
import { OrderDetailView } from "@/components/site/OrderDetailView";

export const Route = createFileRoute("/_authenticated/admin/orders/$id")({
  head: () => ({ meta: [{ title: "Admin — Order" }] }),
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(adminGetOrderDetail);
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) return (
    <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
  );
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{(q.error as any)?.message ?? "Order not found"}</p>;

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