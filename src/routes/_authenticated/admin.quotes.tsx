import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { adminListQuotes, getQuote, adminRespondQuote, adminCancelQuote } from "@/lib/quotes.functions";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/quotes")({
  head: () => ({ meta: [{ title: "Admin — Quotes" }] }),
  component: AdminQuotes,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "secondary", responded: "default", accepted: "default", rejected: "destructive", expired: "outline",
};

function AdminQuotes() {
  const fn = useServerFn(adminListQuotes);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-quotes", status, search],
    queryFn: () => fn({ data: { status, search: search || undefined } }),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wholesale quotes"
        description="B2B quote pipeline — respond, track and convert to orders."
        icon={FileText}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Quotes" }]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Open" value={q.data?.kpi.open ?? 0} />
        <Kpi label="Responded" value={q.data?.kpi.responded ?? 0} />
        <Kpi label="Pipeline AED" value={(q.data?.kpi.pipeline ?? 0).toFixed(2)} />
        <Kpi label="Acceptance rate" value={`${q.data?.kpi.acceptanceRate ?? 0}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-64" placeholder="Search by number / company / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            (q.data?.rows ?? []).length === 0 ? <EmptyState icon={FileText} title="No quotes found" description="Wholesale enquiries will appear here." /> : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="p-3">Number</th><th className="p-3">Buyer</th><th className="p-3">Created</th><th className="p-3">Status</th><th className="p-3 text-right">Estimate</th><th /></tr>
                  </thead>
                  <tbody>
                    {(q.data?.rows ?? []).map((r: any) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3 font-mono text-xs">{r.quote_number}</td>
                        <td className="p-3">
                          <div className="font-medium">{r.company_name ?? r.buyer_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.contact_email}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="p-3"><Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge></td>
                        <td className="p-3 text-right tabular-nums">{r.total_estimate_aed != null ? `${Number(r.total_estimate_aed).toFixed(2)} AED` : "—"}</td>
                        <td className="p-3 text-right"><Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpenId(r.id)}>Open</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </CardContent>
      </Card>

      {openId && <RespondDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></CardHeader></Card>
  );
}

type Item = { name: string; qty: number; unit_price_aed: number; notes?: string };

function RespondDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getQuote);
  const respond = useServerFn(adminRespondQuote);
  const cancel = useServerFn(adminCancelQuote);
  const q = useQuery({ queryKey: ["admin-quote", id], queryFn: () => get({ data: { id } }) });

  const data: any = q.data;
  const reqItems: any[] = data?.items ?? [];
  const prevRes: any[] = data?.response?.items ?? [];

  const seed: Item[] = useMemo(() => {
    if (prevRes.length) return prevRes.map((r: any) => ({ name: r.name, qty: r.qty, unit_price_aed: r.unit_price_aed, notes: r.notes ?? "" }));
    if (reqItems.length) return reqItems.map((r: any) => ({ name: r.name, qty: r.qty, unit_price_aed: 0, notes: r.notes ?? "" }));
    return [{ name: "", qty: 1, unit_price_aed: 0 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  const [items, setItems] = useState<Item[]>(seed);
  const [notes, setNotes] = useState<string>(data?.response?.notes ?? "");
  const defaultValid = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);
  const [validUntil, setValidUntil] = useState<string>(data?.valid_until ?? defaultValid);

  // Seed once when data loads
  if (q.data && items === seed && items.length === 0) setItems(seed);

  const total = items.reduce((a, i) => a + i.qty * i.unit_price_aed, 0);

  const mResp = useMutation({
    mutationFn: () => respond({ data: { id, items, notes: notes || null, valid_until: validUntil, assign_to_me: true } }),
    onSuccess: () => { toast.success("Quote response sent"); qc.invalidateQueries({ queryKey: ["admin-quotes"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mCancel = useMutation({
    mutationFn: () => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Quote marked expired"); qc.invalidateQueries({ queryKey: ["admin-quotes"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{data?.quote_number ?? "Quote"}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !data ? null : (
          <div className="space-y-5">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Company: </span>{data.company_name ?? "—"}</div>
              <div><span className="text-muted-foreground">Email: </span>{data.contact_email}</div>
              <div><span className="text-muted-foreground">Phone: </span>{data.contact_phone ?? "—"}</div>
              <div><span className="text-muted-foreground">Status: </span><Badge variant={STATUS_VARIANT[data.status] ?? "secondary"}>{data.status}</Badge></div>
            </div>
            {data.notes && <p className="rounded-md border border-border bg-muted/30 p-3 text-sm">{data.notes}</p>}

            <div>
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Buyer requested</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {reqItems.map((it: any, i: number) => (
                  <li key={i} className="border-b border-border py-1.5">{it.qty} × {it.name}{it.notes ? <span className="ml-1 text-muted-foreground">— {it.notes}</span> : null}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-medium uppercase text-muted-foreground">Your response</h4>
              <div className="mt-2 space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_auto]">
                    <Input placeholder="Item name" value={it.name} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input type="number" min={1} value={it.qty} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                    <Input type="number" min={0} step="0.01" placeholder="AED" value={it.unit_price_aed} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, unit_price_aed: Math.max(0, Number(e.target.value) || 0) } : x))} />
                    <Button type="button" variant="ghost" size="icon" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setItems([...items, { name: "", qty: 1, unit_price_aed: 0 }])}>
                  <Plus className="me-2 h-4 w-4" /> Add line
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="grid gap-1">
                  <Label className="text-xs">Valid until</Label>
                  <Input type="date" className="w-44" value={validUntil ?? ""} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Estimated total</div>
                  <div className="text-lg font-medium tabular-nums">{total.toFixed(2)} AED</div>
                </div>
              </div>
              <Textarea className="mt-3" rows={3} placeholder="Notes / terms (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => mCancel.mutate()} disabled={mCancel.isPending}>Mark expired</Button>
              <Button className="rounded-full" onClick={() => mResp.mutate()} disabled={mResp.isPending || items.some((i) => !i.name || i.qty < 1)}>
                {mResp.isPending ? "Sending…" : data.status === "responded" ? "Update response" : "Send response"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}