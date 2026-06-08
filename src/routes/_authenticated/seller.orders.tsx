import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { listSellerOrders, setOrderItemStatus } from "@/lib/seller.functions";
import { sellerListShipments, sellerCreateShipment, sellerMarkDelivered } from "@/lib/shipments.functions";
import { toast } from "sonner";
import { Truck, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/_authenticated/seller/orders")({
  head: () => ({ meta: [{ title: "Seller — Orders" }] }),
  component: Orders,
});

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];
const CARRIERS = ["aramex", "dhl", "fedex", "talabat", "local_courier", "pickup", "other"];

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

  // Group items by order
  const grouped = useMemo(() => {
    const map = new Map<string, { order: any; items: any[] }>();
    for (const it of (q.data ?? []) as any[]) {
      const oid = it.order?.id;
      if (!oid) continue;
      const g = map.get(oid) ?? { order: it.order, items: [] };
      g.items.push(it);
      map.set(oid, g);
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());
  }, [q.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Fulfil and track orders for items from your store."
        icon={ShoppingCart}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Orders" }]}
      />
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            grouped.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                description="Orders containing your products will show up here as buyers check out."
              />
            ) : (
            <ul className="divide-y divide-border">
              {grouped.map((g) => (
                <li key={g.order.id} className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{g.order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(g.order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{g.order.payment_status}</Badge>
                      <Badge>{g.order.status}</Badge>
                      <ShipmentDialog order={g.order} items={g.items} />
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {g.items.map((i: any) => (
                      <li key={i.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                        <div className="text-sm">
                          {i.product_name}{i.variant_label && <span className="text-muted-foreground"> — {i.variant_label}</span>}
                        </div>
                        <div className="text-sm tabular-nums">{i.qty} × {Number(i.unit_price_aed).toFixed(2)}</div>
                        <Select value={i.fulfillment_status} onValueChange={(v) => m.mutate({ itemId: i.id, status: v })}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                  <OrderShipments orderId={g.order.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderShipments({ orderId }: { orderId: string }) {
  const fn = useServerFn(sellerListShipments);
  const mark = useServerFn(sellerMarkDelivered);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shipments", orderId], queryFn: () => fn({ data: { orderId } }) });
  const m = useMutation({
    mutationFn: (id: string) => mark({ data: { shipmentId: id } }),
    onSuccess: () => { toast.success("Marked delivered"); qc.invalidateQueries({ queryKey: ["shipments", orderId] }); qc.invalidateQueries({ queryKey: ["seller-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const items = (q.data ?? []) as any[];
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Shipments</p>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <span className="font-medium uppercase">{s.carrier}</span>
              {s.tracking_number && <span className="ml-2 font-mono text-xs">{s.tracking_number}</span>}
              {s.tracking_url && <a className="ml-2 text-xs underline" href={s.tracking_url} target="_blank" rel="noreferrer">track</a>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{s.status}</Badge>
              {s.status !== "delivered" && (
                <Button size="sm" variant="outline" onClick={() => m.mutate(s.id)} disabled={m.isPending}>Mark delivered</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShipmentDialog({ order, items }: { order: any; items: any[] }) {
  const create = useServerFn(sellerCreateShipment);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pendingItems = items.filter((i) => i.fulfillment_status !== "shipped" && i.fulfillment_status !== "delivered" && i.fulfillment_status !== "cancelled");
  const [selected, setSelected] = useState<Set<string>>(new Set(pendingItems.map((i) => i.id)));
  const [carrier, setCarrier] = useState("aramex");
  const [tracking, setTracking] = useState("");
  const [weight, setWeight] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: () => create({ data: {
      orderId: order.id,
      itemIds: Array.from(selected),
      carrier: carrier as any,
      trackingNumber: tracking || null,
      weightGrams: weight ? Number(weight) : null,
      costAed: cost ? Number(cost) : null,
      notes: notes || null,
      labelUrl: null,
    } }),
    onSuccess: () => {
      toast.success("Shipment created — buyer notified");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
      qc.invalidateQueries({ queryKey: ["shipments", order.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pendingItems.length === 0}>
          <Truck className="mr-1 h-4 w-4" /> Create shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Ship {order.order_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Items</Label>
            <ul className="mt-2 space-y-1">
              {pendingItems.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.has(i.id)} onCheckedChange={(v) => {
                    const n = new Set(selected);
                    if (v) n.add(i.id); else n.delete(i.id);
                    setSelected(n);
                  }} />
                  <span>{i.product_name} × {i.qty}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tracking #</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
            <div><Label>Weight (g)</Label><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
            <div><Label>Cost (AED)</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button className="w-full rounded-full" onClick={() => m.mutate()} disabled={m.isPending || selected.size === 0}>
            {m.isPending ? "Creating…" : "Create shipment & notify buyer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}