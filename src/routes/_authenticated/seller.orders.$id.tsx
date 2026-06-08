import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { sellerGetOrderDetail } from "@/lib/seller.functions";
import { OrderDetailView } from "@/components/site/OrderDetailView";

export const Route = createFileRoute("/_authenticated/seller/orders/$id")({
  head: () => ({ meta: [{ title: "Seller — Order" }] }),
  component: SellerOrderDetail,
});

function SellerOrderDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(sellerGetOrderDetail);
  const q = useQuery({ queryKey: ["seller-order", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) return (
    <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
  );
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{(q.error as any)?.message ?? "Order not found"}</p>;

  return (
    <OrderDetailView
      role="seller"
      data={q.data}
      invalidateKey={["seller-order", id]}
      backHref="/seller/orders"
    />
  );
}