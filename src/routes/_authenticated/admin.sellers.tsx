import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Store } from "lucide-react";
import { adminListSellers, adminSetSellerStatus } from "@/lib/admin.functions";
import { statusColor } from "@/lib/dashboard-tokens";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/sellers")({
  head: () => ({ meta: [{ title: "Admin — Sellers" }] }),
  component: Sellers,
});

const STATUSES = ["pending", "active", "suspended", "rejected"];

function Sellers() {
  const fn = useServerFn(adminListSellers);
  const upd = useServerFn(adminSetSellerStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sellers"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (input: { sellerId: string; status: string }) => upd({ data: input }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-sellers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = useMemo(() => {
    const list = (q.data ?? []) as any[];
    return list.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!search) return true;
      const t = search.toLowerCase();
      return (s.store_name ?? "").toLowerCase().includes(t)
        || (s.contact_email ?? "").toLowerCase().includes(t)
        || (s.trn ?? "").toLowerCase().includes(t);
    });
  }, [q.data, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sellers"
        description={`${rows.length} of ${(q.data ?? []).length} sellers on the marketplace.`}
        icon={Store}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Sellers" }]}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search store, email, TRN…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
            <EmptyState icon={Store} title="No sellers found" description="Try clearing filters or invite new sellers to your marketplace." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.store_name}</p>
                        <p className="text-xs text-muted-foreground">TRN {s.trn ?? "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <p>{s.contact_email ?? "—"}</p>
                        <p className="text-xs">{s.contact_phone ?? "—"}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(s.commission_rate)}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(s.status), color: statusColor(s.status) }}>{s.status}</Badge>
                          <Select value={s.status} onValueChange={(v) => m.mutate({ sellerId: s.id, status: v })}>
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
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