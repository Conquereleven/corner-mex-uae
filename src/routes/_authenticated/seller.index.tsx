import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSellerOverview } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/")({
  head: () => ({ meta: [{ title: "Seller — Overview" }] }),
  component: SellerOverview,
});

function SellerOverview() {
  const fn = useServerFn(getSellerOverview);
  const q = useQuery({ queryKey: ["seller-overview"], queryFn: () => fn({}) });
  const s = q.data?.stats;
  const seller = q.data?.seller as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{seller?.store_name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">Commission: {Number(seller?.commission_rate ?? 0)}%</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={seller?.status === "active" ? "default" : "secondary"}>{seller?.status}</Badge>
          {seller?.status === "active" && (
            <Link to="/sellers/$slug" params={{ slug: seller.slug }}>
              <Button variant="outline" size="sm" className="rounded-full">View public page</Button>
            </Link>
          )}
        </div>
      </div>

      {seller?.status !== "active" && (
        <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-4 text-sm">
            Your store is <strong>{seller?.status}</strong>. Products won't be visible publicly until an admin activates it.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={s?.productCount ?? 0} />
        <Stat label="Orders" value={s?.orderCount ?? 0} />
        <Stat label="Gross (AED)" value={(s?.grossAed ?? 0).toFixed(2)} />
        <Stat label="Net after commission (AED)" value={(s?.netAed ?? 0).toFixed(2)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Pending fulfillment</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{s?.pendingItems ?? 0} item(s) waiting to be confirmed/shipped.</p>
          <Link to="/seller/orders" className="text-sm font-medium underline">Go to orders →</Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}