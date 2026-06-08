import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { listSellerOrders } from "@/lib/seller.functions";
import { sellerCreateShipment } from "@/lib/shipments.functions";
import { toast } from "sonner";
import { Truck, ShoppingCart, Search, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { statusColor } from "@/lib/dashboard-tokens";

export const Route = createFileRoute("/_authenticated/seller/orders/")({
  head: () => ({ meta: [{ title: "Seller — Orders" }] }),
  component: Orders,
});

const CARRIERS = ["aramex", "dhl", "fedex", "talabat", "local_courier", "pickup", "other"];
const TABS: Array<{ key: string; label: string; match: (o: any) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  {
    key: "unfulfilled",
    label: "Unfulfilled",
    match: (o) => ["pending", "preparing"].includes(o.status),
  },
  {
    key: "unpaid",
    label: "Unpaid",
    match: (o) => o.payment_status !== "paid" && o.payment_status !== "refunded",
  },
  {
    key: "open",
    label: "Open",
    match: (o) => !["delivered", "cancelled", "refunded"].includes(o.status),
  },
  {
    key: "closed",
    label: "Closed",
    match: (o) => ["delivered", "cancelled", "refunded"].includes(o.status),
  },
];

function Orders() {
  const fn = useServerFn(listSellerOrders);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller-orders"], queryFn: () => fn({}) });

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

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
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime(),
    );
  }, [q.data]);

  const filtered = useMemo(() => {
    const tabDef = TABS.find((t) => t.key === tab) ?? TABS[0];
    return grouped.filter((g) => {
      if (!tabDef.match(g.order)) return false;
      if (!search) return true;
      return (g.order.order_number ?? "").toLowerCase().includes(search.toLowerCase());
    });
  }, [grouped, search, tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Fulfil and track orders for items from your store."
        icon={ShoppingCart}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Orders" }]}
      />
      <Card>
        <Tabs value={tab} onValueChange={setTab} className="border-b border-border/60 px-4 pt-3">
          <TabsList className="bg-transparent p-0 h-auto">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : q.isError ? (
            <EmptyState
              icon={ShoppingCart}
              title="Orders could not be loaded"
              description={(q.error as Error).message}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders containing your products will show up here as buyers check out."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => {
                    const subtotal = g.items.reduce(
                      (s, it: any) => s + Number(it.line_total_aed ?? 0),
                      0,
                    );
                    const qty = g.items.reduce((s, it: any) => s + Number(it.qty ?? 0), 0);
                    return (
                      <TableRow key={g.order.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">
                          <Link
                            to="/seller/orders/$id"
                            params={{ id: g.order.id }}
                            className="hover:underline"
                          >
                            {g.order.order_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(g.order.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {qty} item{qty === 1 ? "" : "s"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="capitalize"
                            style={{
                              borderColor: statusColor(g.order.payment_status),
                              color: statusColor(g.order.payment_status),
                            }}
                          >
                            {g.order.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="capitalize"
                            style={{
                              borderColor: statusColor(g.order.status),
                              color: statusColor(g.order.status),
                            }}
                          >
                            {g.order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {subtotal.toFixed(2)} AED
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <ShipmentDialog order={g.order} items={g.items} />
                            <Button asChild size="sm" variant="ghost">
                              <Link to="/seller/orders/$id" params={{ id: g.order.id }}>
                                View
                                <ChevronRight className="ms-1 h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ShipmentDialog({ order, items }: { order: any; items: any[] }) {
  const create = useServerFn(sellerCreateShipment);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pendingItems = items.filter(
    (i) =>
      i.fulfillment_status !== "shipped" &&
      i.fulfillment_status !== "delivered" &&
      i.fulfillment_status !== "cancelled",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(pendingItems.map((i) => i.id)));
  const [carrier, setCarrier] = useState("aramex");
  const [tracking, setTracking] = useState("");
  const [weight, setWeight] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          orderId: order.id,
          itemIds: Array.from(selected),
          carrier: carrier as any,
          trackingNumber: tracking || null,
          weightGrams: weight ? Number(weight) : null,
          costAed: cost ? Number(cost) : null,
          notes: notes || null,
          labelUrl: null,
        },
      }),
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
        <DialogHeader>
          <DialogTitle>Ship {order.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Items</Label>
            <ul className="mt-2 space-y-1">
              {pendingItems.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(i.id)}
                    onCheckedChange={(v) => {
                      const n = new Set(selected);
                      if (v) n.add(i.id);
                      else n.delete(i.id);
                      setSelected(n);
                    }}
                  />
                  <span>
                    {i.product_name} × {i.qty}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tracking #</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div>
              <Label>Weight (g)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div>
              <Label>Cost (AED)</Label>
              <Input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            className="w-full rounded-full"
            onClick={() => m.mutate()}
            disabled={m.isPending || selected.size === 0}
          >
            {m.isPending ? "Creating…" : "Create shipment & notify buyer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
