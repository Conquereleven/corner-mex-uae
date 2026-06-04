import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { getSellerCommissions, requestSellerPayout } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/commissions")({
  head: () => ({ meta: [{ title: "Commissions — Seller Studio" }] }),
  component: SellerCommissions,
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(n);
}

function SellerCommissions() {
  const fn = useServerFn(getSellerCommissions);
  const reqFn = useServerFn(requestSellerPayout);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller-commissions"], queryFn: () => fn({}) });
  const d = q.data;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const m = useMutation({
    mutationFn: () => reqFn({ data: amount ? { amount: Number(amount) } : {} }),
    onSuccess: (res: any) => {
      toast.success(`Payout requested: ${res.amount.toFixed(2)} AED`);
      setOpen(false); setAmount("");
      qc.invalidateQueries({ queryKey: ["seller-commissions"] });
      qc.invalidateQueries({ queryKey: ["seller-payouts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const balance = d?.balance?.availableBalance ?? 0;
  const hasOpen = !!d?.balance?.hasOpenRequest;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
          <p className="text-sm text-muted-foreground">Platform fee transparency. Your current rate is {d ? `${d.rate}%` : "—"}.</p>
        </div>
        <Link to="/seller/payouts"><Button variant="outline" size="sm">View payouts history →</Button></Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Effective rate", value: d ? `${d.stats.effectiveRate}%` : "—" },
          { label: "Commission 30d", value: d ? fmt(d.stats.commission30) : "—" },
          { label: "Commission lifetime", value: d ? fmt(d.stats.commissionLifetime) : "—" },
          { label: "Net lifetime", value: d ? fmt(d.stats.netLifetime) : "—" },
          { label: "Available to withdraw", value: d ? fmt(balance) : "—", accent: true },
        ].map((k) => (
          <Card key={k.label} className={k.accent ? "border-primary/40" : ""}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-semibold mt-1">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Request payout</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {hasOpen
                ? "You already have a pending request. Wait for it to be processed before requesting another."
                : balance > 0
                  ? `Up to ${fmt(balance)} available for withdrawal.`
                  : "No funds available yet. Earnings will appear here as orders are paid."}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={hasOpen || balance <= 0}>Request payout</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request payout</DialogTitle>
                <DialogDescription>
                  Leave blank to withdraw the full available balance ({fmt(balance)}).
                  Funds will be transferred to the payout method in your settings.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Amount (AED, optional)</Label>
                <Input type="number" min={0} max={balance} step="0.01" placeholder={balance.toFixed(2)}
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Requesting…" : "Confirm request"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

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