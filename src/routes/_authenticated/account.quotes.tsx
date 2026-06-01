import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listMyQuotes, getQuote, acceptQuote, rejectQuote } from "@/lib/quotes.functions";

export const Route = createFileRoute("/_authenticated/account/quotes")({
  head: () => ({ meta: [{ title: "My quotes — Corner Mex" }] }),
  component: MyQuotes,
});

const EMIRATES = [
  { code: "DU", name: "Dubai" }, { code: "AD", name: "Abu Dhabi" }, { code: "SH", name: "Sharjah" },
  { code: "AJ", name: "Ajman" }, { code: "UQ", name: "Umm Al Quwain" }, { code: "RK", name: "Ras Al Khaimah" },
  { code: "FU", name: "Fujairah" },
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "secondary", responded: "default", accepted: "default", rejected: "destructive", expired: "outline",
};

function MyQuotes() {
  const fn = useServerFn(listMyQuotes);
  const q = useQuery({ queryKey: ["my-quotes"], queryFn: () => fn({}) });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl tracking-tight">My quotes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Wholesale quote requests and responses.</p>
          </div>
          <Link to="/b2b/quote"><Button className="rounded-full">New quote</Button></Link>
        </div>

        <Card className="mt-8">
          <CardContent className="p-0">
            {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
              (q.data ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No quotes yet. <Link to="/b2b/quote" className="underline">Request your first one →</Link></p>
              ) : (
                <ul className="divide-y divide-border">
                  {(q.data ?? []).map((row: any) => (
                    <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{row.quote_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString()} · {row.company_name ?? "—"}
                          {row.valid_until ? ` · valid until ${row.valid_until}` : ""}
                        </p>
                      </div>
                      {row.total_estimate_aed != null && (
                        <div className="font-medium tabular-nums">{Number(row.total_estimate_aed).toFixed(2)} AED</div>
                      )}
                      <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>{row.status}</Badge>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpenId(row.id)}>View</Button>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
      </section>

      {openId && <QuoteDialog id={openId} onClose={() => setOpenId(null)} />}
    </SiteLayout>
  );
}

function QuoteDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getQuote);
  const acc = useServerFn(acceptQuote);
  const rej = useServerFn(rejectQuote);
  const q = useQuery({ queryKey: ["quote", id], queryFn: () => get({ data: { id } }) });

  const [addr, setAddr] = useState({
    recipient_name: "", phone: "", emirate: "DU" as const, area: "", street: "", building: "", floor_apt: "", landmark: "",
  });
  const [showAccept, setShowAccept] = useState(false);

  const aMut = useMutation({
    mutationFn: () => acc({ data: { id, shipping_address: addr as any } }),
    onSuccess: (r: any) => {
      toast.success(r.fullyMapped ? `Order ${r.orderNumber} created` : "Quote accepted — admin will follow up");
      qc.invalidateQueries({ queryKey: ["my-quotes"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      onClose();
      if (r.orderId) nav({ to: "/order-confirmed", search: { order: r.orderId } });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rMut = useMutation({
    mutationFn: () => rej({ data: { id } }),
    onSuccess: () => { toast.success("Quote rejected"); qc.invalidateQueries({ queryKey: ["my-quotes"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const data: any = q.data;
  const reqItems: any[] = data?.items ?? [];
  const resItems: any[] = data?.response?.items ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.quote_number ?? "Quote"}</DialogTitle>
        </DialogHeader>

        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data ? null : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={STATUS_VARIANT[data.status] ?? "secondary"}>{data.status}</Badge>
              {data.valid_until && <span className="text-muted-foreground">valid until {data.valid_until}</span>}
              {data.total_estimate_aed != null && <span className="ml-auto font-medium">{Number(data.total_estimate_aed).toFixed(2)} AED</span>}
            </div>

            <div>
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Your request</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {reqItems.map((it, i) => (
                  <li key={i} className="flex justify-between border-b border-border py-2">
                    <span>{it.qty} × {it.name}{it.notes ? <span className="ml-1 text-muted-foreground">— {it.notes}</span> : null}</span>
                  </li>
                ))}
              </ul>
            </div>

            {resItems.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">Our response</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {resItems.map((it, i) => (
                    <li key={i} className="flex justify-between border-b border-border py-2">
                      <span>{it.qty} × {it.name}</span>
                      <span className="tabular-nums">{(it.qty * it.unit_price_aed).toFixed(2)} AED</span>
                    </li>
                  ))}
                </ul>
                {data.response?.notes && <p className="mt-3 text-sm text-muted-foreground">{data.response.notes}</p>}
              </div>
            )}

            {data.status === "responded" && (
              showAccept ? (
                <div className="space-y-3 rounded-md border border-border p-4">
                  <p className="text-sm font-medium">Shipping address</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Recipient *</Label><Input value={addr.recipient_name} onChange={(e) => setAddr({ ...addr, recipient_name: e.target.value })} /></div>
                    <div><Label className="text-xs">Phone *</Label><Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} /></div>
                    <div><Label className="text-xs">Emirate</Label>
                      <Select value={addr.emirate} onValueChange={(v) => setAddr({ ...addr, emirate: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EMIRATES.map((e) => <SelectItem key={e.code} value={e.code}>{e.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Area *</Label><Input value={addr.area} onChange={(e) => setAddr({ ...addr, area: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Street</Label><Input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="rounded-full" onClick={() => setShowAccept(false)}>Back</Button>
                    <Button className="rounded-full" disabled={!addr.recipient_name || !addr.phone || !addr.area || aMut.isPending} onClick={() => aMut.mutate()}>
                      {aMut.isPending ? "Working…" : "Confirm and create order"}
                    </Button>
                  </div>
                </div>
              ) : (
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => rMut.mutate()} disabled={rMut.isPending}>Reject</Button>
                  <Button className="rounded-full" onClick={() => setShowAccept(true)}>Accept quote</Button>
                </DialogFooter>
              )
            )}

            {data.converted_order_id && (
              <p className="text-sm text-muted-foreground">An order was created from this quote.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}