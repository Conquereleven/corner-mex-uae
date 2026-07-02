import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShoppingCart, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminListOrders } from "@/lib/admin.functions";
import { statusColor } from "@/lib/dashboard-tokens";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  head: () => ({ meta: [{ title: "Admin — Orders" }] }),
  component: Orders,
});

const STATUSES = ["pending", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"];
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
  const fn = useServerFn(adminListOrders);
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => fn({}) });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tab, setTab] = useState<string>("all");

  const rows = useMemo(() => {
    const list = (q.data ?? []) as any[];
    const tabDef = TABS.find((t) => t.key === tab) ?? TABS[0];
    return list.filter((o) => {
      if (!tabDef.match(o)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!search) return true;
      return (o.order_number ?? "").toLowerCase().includes(search.toLowerCase());
    });
  }, [q.data, search, statusFilter, tab]);

  const exportCsv = () => {
    const header = ["Order", "Date", "Payment", "Method", "Status", "Total (AED)"];
    const lines = rows.map((o: any) =>
      [
        o.order_number,
        new Date(o.created_at).toISOString(),
        o.payment_status,
        o.payment_method ?? "",
        o.status,
        Number(o.total_aed).toFixed(2),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${rows.length} of ${(q.data ?? []).length} CornerMex orders.`}
        icon={ShoppingCart}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Orders" }]}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        }
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders found"
              description="Try clearing filters or wait for new orders to come in."
            />
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
                        <Link
                          to="/admin/orders/$id"
                          params={{ id: o.id }}
                          className="hover:underline"
                        >
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="capitalize"
                          style={{
                            borderColor: statusColor(o.payment_status),
                            color: statusColor(o.payment_status),
                          }}
                        >
                          {o.payment_status}
                        </Badge>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {(o.payment_method ?? "").replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {Number(o.total_aed).toFixed(2)} AED
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="capitalize"
                          style={{
                            borderColor: statusColor(o.status),
                            color: statusColor(o.status),
                          }}
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/admin/orders/$id" params={{ id: o.id }}>
                            View
                            <ChevronRight className="ms-1 h-4 w-4" />
                          </Link>
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
