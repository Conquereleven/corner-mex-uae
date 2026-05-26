import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { listSellerProducts, deleteSellerProduct } from "@/lib/seller.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/products")({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-tight">Products</h1>
        <Link to="/seller/products/new"><Button className="rounded-full"><Plus className="me-2 h-4 w-4" /> New product</Button></Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            (q.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">No products yet. Create your first one.</p> : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand ?? "—"} · stock {p.stock}</p>
                  </div>
                  <div className="hidden tabular-nums sm:block">{p.price_aed.toFixed(2)} AED</div>
                  <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                  <Link to="/seller/products/$id" params={{ id: p.id }}>
                    <Button variant="outline" size="sm" className="rounded-full">Edit</Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this product?")) m.mutate(p.id); }}>
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