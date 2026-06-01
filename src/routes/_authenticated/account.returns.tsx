import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getMyOrders } from "@/lib/account.functions";
import { buyerListReturns, buyerCreateReturn, buyerCancelReturn } from "@/lib/returns.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/returns")({
  head: () => ({ meta: [{ title: "Returns — Corner Mex" }] }),
  component: ReturnsPage,
});

const REASONS = ["damaged", "wrong_item", "not_as_described", "quality_issue", "no_longer_needed", "other"];

function ReturnsPage() {
  const fetchOrders = useServerFn(getMyOrders);
  const fetchReturns = useServerFn(buyerListReturns);
  const cancel = useServerFn(buyerCancelReturn);
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders({}) });
  const list = useQuery({ queryKey: ["my-returns"], queryFn: () => fetchReturns({}) });

  const mCancel = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["my-returns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // flatten items
  const items = ((orders.data ?? []) as any[]).flatMap((o) =>
    (o.items ?? []).map((it: any) => ({ ...it, order_number: o.order_number, order_status: o.status }))
  );

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Returns</h1>
            <p className="mt-1 text-sm text-muted-foreground">Request a return for any item from your orders.</p>
          </div>
          <Link to="/account"><Button variant="outline" className="rounded-full">← Account</Button></Link>
        </div>

        <Card className="mt-8">
          <CardHeader><CardTitle>Active & past requests</CardTitle></CardHeader>
          <CardContent>
            {list.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
             (list.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No return requests yet.</p> : (
              <ul className="divide-y divide-border">
                {(list.data as any[]).map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.return_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Order {r.order?.order_number} · {r.item?.product_name} × {r.qty} · {r.reason.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{r.status}</Badge>
                        {r.refund_aed != null && <span className="text-sm tabular-nums">AED {Number(r.refund_aed).toFixed(2)}</span>}
                        {r.status === "requested" && (
                          <Button size="sm" variant="ghost" onClick={() => mCancel.mutate(r.id)}>Cancel</Button>
                        )}
                      </div>
                    </div>
                    {r.seller_response && <p className="mt-2 text-xs text-muted-foreground">Seller: {r.seller_response}</p>}
                  </li>
                ))}
              </ul>
             )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle>Request a return</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no items eligible for return.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2">
                    <div className="text-sm">
                      <p>{it.product_name}{it.variant_label && <span className="text-muted-foreground"> — {it.variant_label}</span>}</p>
                      <p className="text-xs text-muted-foreground">Order {it.order_number} · {it.qty} × AED {Number(it.unit_price_aed).toFixed(2)}</p>
                    </div>
                    <ReturnDialog item={it} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}

function ReturnDialog({ item }: { item: any }) {
  const create = useServerFn(buyerCreateReturn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("damaged");
  const [qty, setQty] = useState(item.qty);
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: () => create({ data: { orderItemId: item.id, reason, qty: Number(qty), notes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Return request submitted");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-returns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Return</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Return {item.product_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantity</Label><Input type="number" min={1} max={item.qty} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tell the seller what happened…" /></div>
          <Button className="w-full rounded-full" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Submitting…" : "Submit request"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
