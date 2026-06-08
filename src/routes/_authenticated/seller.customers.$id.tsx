import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sellerGetCustomerDetail } from "@/lib/seller.functions";
import { statusColor } from "@/lib/dashboard-tokens";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/customers/$id")({
  head: () => ({ meta: [{ title: "Seller — Customer" }] }),
  component: SellerCustomerDetail,
});

const AED = (n: number) => `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

function copy(v: string) {
  navigator.clipboard.writeText(v).then(() => toast.success("Copied")).catch(() => toast.error("Copy failed"));
}

function SellerCustomerDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(sellerGetCustomerDetail);
  const q = useQuery({ queryKey: ["seller-customer", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{(q.error as any)?.message ?? "Customer not found"}</p>;
  const { profile, orders, lastAddress, stats } = q.data as any;

  return (
    <div className="space-y-6">
      <Link to="/seller/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">{profile.email ?? "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders" value={String(stats.orders)} />
        <Kpi label="Spent with you" value={AED(stats.gmv)} />
        <Kpi label="Avg. order" value={AED(stats.aov)} />
        <Kpi label="Last order" value={stats.last_order ? new Date(stats.last_order).toLocaleDateString() : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Email" value={profile.email ?? "—"} copyable={!!profile.email} />
            <Field label="Phone" value={profile.phone ?? "—"} copyable={!!profile.phone} />
            {profile.company_name && <Field label="Company" value={profile.company_name} />}
            <Field label="Language" value={(profile.preferred_lang ?? "").toUpperCase()} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Last shipping address</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{lastAddress?.recipient_name ?? "—"}</p>
            {lastAddress?.phone && <p className="text-muted-foreground">{lastAddress.phone}</p>}
            <p className="text-muted-foreground">{[lastAddress?.building, lastAddress?.street, lastAddress?.area, lastAddress?.emirate].filter(Boolean).join(", ") || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Order history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link to="/seller/orders/$id" params={{ id: o.id }} className="hover:underline">{o.order_number}</Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(o.payment_status), color: statusColor(o.payment_status) }}>{o.payment_status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(o.status), color: statusColor(o.status) }}>{o.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{AED(o.total_aed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
    </CardContent></Card>
  );
}

function Field({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span>{value}</span>
        {copyable && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(value)} aria-label="Copy">
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </span>
    </div>
  );
}