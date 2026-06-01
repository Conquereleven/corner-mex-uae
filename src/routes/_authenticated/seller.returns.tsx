import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { sellerListReturns, sellerUpdateReturn } from "@/lib/returns.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/returns")({
  head: () => ({ meta: [{ title: "Seller — Returns" }] }),
  component: SellerReturns,
});

const STATUSES = ["requested", "approved", "rejected", "received", "refunded", "cancelled"];

function SellerReturns() {
  const fn = useServerFn(sellerListReturns);
  const q = useQuery({ queryKey: ["seller-returns"], queryFn: () => fn({}) });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Returns</h1>
      <Card><CardContent className="p-0">
        {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
         (q.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">No return requests.</p> : (
          <ul className="divide-y divide-border">
            {(q.data as any[]).map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.return_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Order {r.order?.order_number} · {r.item?.product_name} × {r.qty} · {r.reason.replace(/_/g, " ")}
                    </p>
                    {r.buyer_notes && <p className="mt-1 text-xs">"{r.buyer_notes}"</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{r.status}</Badge>
                    <RespondDialog ret={r} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}

function RespondDialog({ ret }: { ret: any }) {
  const update = useServerFn(sellerUpdateReturn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(ret.status);
  const [response, setResponse] = useState(ret.seller_response ?? "");
  const [refund, setRefund] = useState(ret.refund_aed ?? "");

  const m = useMutation({
    mutationFn: () => update({ data: {
      id: ret.id, status,
      response: response || undefined,
      refundAed: refund === "" ? null : Number(refund),
    } }),
    onSuccess: () => { toast.success("Updated"); setOpen(false); qc.invalidateQueries({ queryKey: ["seller-returns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{ret.return_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Refund (AED)</Label><Input type="number" step="0.01" value={refund} onChange={(e) => setRefund(e.target.value)} /></div>
          <div><Label>Response to buyer</Label><Textarea rows={3} value={response} onChange={(e) => setResponse(e.target.value)} /></div>
          <Button className="w-full rounded-full" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Update & notify buyer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
