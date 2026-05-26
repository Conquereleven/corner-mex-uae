import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSellerOrders, setOrderItemStatus } from "@/lib/seller.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/orders")({
  head: () => ({ meta: [{ title: "Seller — Orders" }] }),
  component: Orders,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

function Orders() {
  const fn = useServerFn(listSellerOrders);
  const upd = useServerFn(setOrderItemStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller-orders"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (input: { itemId: string; status: string }) => upd({ data: input }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["seller-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Orders</h1>
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            (q.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">No orders yet.</p> : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((i: any) => (
                <li key={i.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium">{i.product_name} {i.variant_label && <span className="text-muted-foreground">— {i.variant_label}</span>}</p>
                    <p className="text-xs text-muted-foreground">Order {i.order?.order_number} · {new Date(i.order?.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-sm tabular-nums">{i.qty} × {Number(i.unit_price_aed).toFixed(2)}</div>
                  <Badge variant="outline">{i.order?.payment_status}</Badge>
                  <Select value={i.fulfillment_status} onValueChange={(v) => m.mutate({ itemId: i.id, status: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}