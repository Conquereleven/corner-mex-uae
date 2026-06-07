import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Check, X, ExternalLink, Archive } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { StatusBadge } from "@/components/site/StatusBadge";
import { EmptyState } from "@/components/site/EmptyState";
import { adminListProducts, adminSetProductStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({ meta: [{ title: "Admin — Products" }] }),
  component: AdminProducts,
});

type AdminProduct = Awaited<ReturnType<typeof adminListProducts>>[number];

const TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
] as const;

function AdminProducts() {
  const fn = useServerFn(adminListProducts);
  const setStatus = useServerFn(adminSetProductStatus);
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [rejectFor, setRejectFor] = useState<AdminProduct | null>(null);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["admin-products", tab],
    queryFn: () => fn({ data: { status: tab as any } }),
  });

  const mutation = useMutation({
    mutationFn: (input: { productId: string; status: string; note?: string }) => setStatus({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Updated");
      setRejectFor(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const rows = useMemo(() => {
    const list = (q.data ?? []) as AdminProduct[];
    if (!search) return list;
    const needle = search.toLowerCase();
    return list.filter((r) =>
      r.name.toLowerCase().includes(needle) ||
      (r.brand ?? "").toLowerCase().includes(needle) ||
      (r.seller?.name ?? "").toLowerCase().includes(needle),
    );
  }, [q.data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Products"
        description="Approve seller submissions, archive listings, and keep the catalog clean."
        actions={
          <Link to="/admin/products/new">
            <Button className="rounded-full">New product</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="flex flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, brand, seller…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No products in this view"
              description="Try a different status tab or clear the search."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {r.image ? (
                            <img src={r.image} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-md border border-border bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.brand ?? "—"}</p>
                            {r.approval_note && r.status === "rejected" && (
                              <p className="mt-1 line-clamp-2 max-w-md text-xs text-destructive">{r.approval_note}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.seller?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.category?.name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={`/product/${r.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center justify-center rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="View on storefront"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {r.status !== "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-success/40 text-success hover:bg-success/10"
                              disabled={mutation.isPending}
                              onClick={() => mutation.mutate({ productId: r.id, status: "active" })}
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                          )}
                          {r.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                              disabled={mutation.isPending}
                              onClick={() => { setRejectFor(r); setNote(r.approval_note ?? ""); }}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          )}
                          {r.status !== "archived" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1"
                              disabled={mutation.isPending}
                              onClick={() => mutation.mutate({ productId: r.id, status: "archived" })}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
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

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject "{rejectFor?.name}"</DialogTitle>
            <DialogDescription>
              Leave a note so the seller knows what to change. The seller will receive a notification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Please add clearer product photos and English ingredients."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={mutation.isPending || !note.trim()}
              onClick={() => rejectFor && mutation.mutate({ productId: rejectFor.id, status: "rejected", note: note.trim() })}
            >
              Send rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}