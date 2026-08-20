import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminListProductsCanonical } from "@/lib/admin-products.functions";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  head: () => ({ meta: [{ title: "Admin — Products" }] }),
  component: AdminProducts,
});

function AdminProducts() {
  const list = useServerFn(adminListProductsCanonical);
  const query = useQuery({
    queryKey: ["admin-products-canonical"],
    queryFn: () => list({}),
  });
  const [search, setSearch] = useState("");
  const products = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return query.data ?? [];
    return (query.data ?? []).filter((product: any) => {
      const name = product.product_translations?.find((item: any) => item.lang === "en")?.name ?? "";
      return [name, product.slug, product.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [query.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Canonical single-merchant CornerMex catalog management.</p>
        </div>
        <Button asChild><Link to="/admin/products/new"><Plus className="me-2 h-4 w-4" /> New product</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md"><Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="ps-9" placeholder="Search name, slug or brand" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {query.isLoading ? <p className="text-sm text-muted-foreground">Loading products…</p> : null}
          {query.isError ? <div className="space-y-2"><p className="text-sm text-destructive">Products could not be loaded.</p><Button size="sm" variant="outline" onClick={() => query.refetch()}>Retry</Button></div> : null}
          {!query.isLoading && !query.isError ? (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Variants</TableHead><TableHead>Stock</TableHead><TableHead>Price</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {products.map((product: any) => {
                  const name = product.product_translations?.find((item: any) => item.lang === "en")?.name ?? product.slug;
                  const variants = product.product_variants ?? [];
                  const active = variants.filter((item: any) => item.is_active);
                  const stock = active.reduce((sum: number, item: any) => sum + Number(item.stock ?? 0), 0);
                  const prices = active.map((item: any) => Number(item.price_aed)).filter((value: number) => Number.isFinite(value));
                  const minPrice = prices.length ? Math.min(...prices) : null;
                  return <TableRow key={product.id}><TableCell><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{product.slug}{product.brand ? ` · ${product.brand}` : ""}</div></TableCell><TableCell><Badge variant={product.status === "active" ? "default" : "secondary"}>{product.status}</Badge></TableCell><TableCell>{variants.length}</TableCell><TableCell>{stock}</TableCell><TableCell>{minPrice == null ? "—" : `AED ${minPrice.toFixed(2)}`}</TableCell><TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to="/admin/products/$id" params={{ id: product.id }}>Edit</Link></Button></TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
