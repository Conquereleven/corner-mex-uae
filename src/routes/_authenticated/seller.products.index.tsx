import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Search, Eye, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { listSellerProducts, deleteSellerProduct } from "@/lib/seller.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/products/")({
  head: () => ({ meta: [{ title: "Seller — Products" }] }),
  component: Products,
});

function Products() {
  const fn = useServerFn(listSellerProducts);
  const del = useServerFn(deleteSellerProduct);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller-products"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["seller-products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const all = (q.data ?? []) as any[];
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of all) if (p.category_slug) map.set(p.category_slug, p.category_name ?? p.category_slug);
    return Array.from(map.entries());
  }, [all]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category_slug !== categoryFilter) return false;
      if (stockFilter === "out" && p.stock > 0) return false;
      if (stockFilter === "low" && (p.stock === 0 || p.stock > 5)) return false;
      if (stockFilter === "in" && p.stock === 0) return false;
      if (s) {
        const hay = `${p.name} ${p.brand ?? ""} ${p.slug ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [all, search, statusFilter, categoryFilter, stockFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalogue, stock, pricing, and approval status."
        icon={Package}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Products" }]}
        actions={
          <Button asChild className="rounded-full">
            <Link to="/seller/products/new"><Plus className="me-2 h-4 w-4" /> New product</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, brand or SKU…"
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in">In stock</SelectItem>
              <SelectItem value="low">Low (≤5)</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(([slug, name]) => (
                  <SelectItem key={slug} value={slug}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            all.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Create your first product to start selling on CornerMex."
                action={
                  <Button asChild className="rounded-full">
                    <Link to="/seller/products/new"><Plus className="me-2 h-4 w-4" /> New product</Link>
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No products match these filters"
                description="Try clearing search or changing filters above."
              />
            ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.brand ?? "—"}
                      {p.category_name ? ` · ${p.category_name}` : ""}
                      {" · "}stock {p.stock}
                    </p>
                  </div>
                  <div className="hidden tabular-nums sm:block">{p.price_aed.toFixed(2)} AED</div>
                  <Badge variant={p.status === "active" ? "default" : p.status === "draft" ? "secondary" : "outline"}>
                    {p.status}
                  </Badge>
                  {p.slug && (
                    <Button asChild variant="ghost" size="icon" title="Preview">
                      <Link to="/product/$slug" params={{ slug: p.slug }} target="_blank">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link to="/seller/products/$id" params={{ id: p.id }}>
                      <Pencil className="me-1.5 h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete"
                    onClick={() => { if (confirm("Delete this product? This cannot be undone.")) m.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
