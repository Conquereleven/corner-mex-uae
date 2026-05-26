import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListOrders, adminSetOrderStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [{ title: "Admin — Orders" }] }),
  component: Orders,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

function Orders() {
  const fn = useServerFn(adminListOrders);
  const upd = useServerFn(adminSetOrderStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (input: { orderId: string; status: string }) => upd({ data: input }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Orders</h1>
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((o: any) => (
                <li key={o.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.payment_method}</p>
                  </div>
                  <div className="font-medium tabular-nums">{Number(o.total_aed).toFixed(2)} AED</div>
                  <Badge variant="outline">{o.payment_status}</Badge>
                  <Select value={o.status} onValueChange={(v) => m.mutate({ orderId: o.id, status: v })}>
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