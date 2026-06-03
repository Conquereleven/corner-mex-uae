import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSellerCommissions } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/commissions")({
  head: () => ({ meta: [{ title: "Commissions — Seller Studio" }] }),
  component: SellerCommissions,
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(n);
}

function SellerCommissions() {
  const fn = useServerFn(getSellerCommissions);
  const q = useQuery({ queryKey: ["seller-commissions"], queryFn: () => fn({}) });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
        <p className="text-sm text-muted-foreground">Platform fee transparency. Your current rate is {d ? `${d.rate}%` : "—"}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Effective rate", value: d ? `${d.stats.effectiveRate}%` : "—" },
          { label: "Commission 30d", value: d ? fmt(d.stats.commission30) : "—" },
          { label: "Commission lifetime", value: d ? fmt(d.stats.commissionLifetime) : "—" },
          { label: "Net lifetime", value: d ? fmt(d.stats.netLifetime) : "—" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-semibold mt-1">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(d?.months ?? []).map((m) => (
                <TableRow key={m.key}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-right">{m.orders}</TableCell>
                  <TableCell className="text-right">{fmt(m.gmv)}</TableCell>
                  <TableCell className="text-right">{fmt(m.commission)}</TableCell>
                  <TableCell className="text-right">{fmt(m.net)}</TableCell>
                  <TableCell className="text-right">{m.rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top products by commission</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">GMV</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(d?.topProducts ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{p.units}</TableCell>
                  <TableCell className="text-right">{fmt(p.gmv)}</TableCell>
                  <TableCell className="text-right">{fmt(p.commission)}</TableCell>
                </TableRow>
              ))}
              {(d?.topProducts ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No sales yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>How commission works</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Commission is calculated per line item at the time of sale at your current rate of <strong>{d?.rate ?? "—"}%</strong> on the line subtotal (excluding shipping and tax).</p>
          <p>Your <strong>net</strong> earnings (GMV minus commission) are aggregated into payouts according to your store payout schedule. Refunds and cancellations reverse the commission proportionally.</p>
        </CardContent>
      </Card>
    </div>
  );
}