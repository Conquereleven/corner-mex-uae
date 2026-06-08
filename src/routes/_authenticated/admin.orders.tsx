import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShoppingCart, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminListOrders, adminSetOrderStatus } from "@/lib/admin.functions";
import { statusColor } from "@/lib/dashboard-tokens";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = useMemo(() => {
    const list = (q.data ?? []) as any[];
    return list.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!search) return true;
      return (o.order_number ?? "").toLowerCase().includes(search.toLowerCase());
    });
  }, [q.data, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${rows.length} of ${(q.data ?? []).length} orders across the marketplace.`}
        icon={ShoppingCart}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Orders" }]}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search order number…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No orders found" description="Try clearing filters or wait for new orders to come in." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o: any) => (
                    <TableRow key={o.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <Link to="/admin/orders/$id" params={{ id: o.id }} className="hover:underline">{o.order_number}</Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(o.payment_status), color: statusColor(o.payment_status) }}>{o.payment_status}</Badge>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">{(o.payment_method ?? "").replace(/_/g, " ")}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{Number(o.total_aed).toFixed(2)} AED</TableCell>
                      <TableCell>
                        <Select value={o.status} onValueChange={(v) => m.mutate({ orderId: o.id, status: v })}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/admin/orders/$id" params={{ id: o.id }}>View<ChevronRight className="ms-1 h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}