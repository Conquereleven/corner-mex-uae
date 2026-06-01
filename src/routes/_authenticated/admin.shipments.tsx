import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListShipments } from "@/lib/shipments.functions";

export const Route = createFileRoute("/_authenticated/admin/shipments")({
  head: () => ({ meta: [{ title: "Admin — Shipments" }] }),
  component: AdminShipments,
});

const STATUSES = ["", "prepared", "in_transit", "delivered", "returned", "lost"];
const CARRIERS = ["", "aramex", "dhl", "fedex", "talabat", "local_courier", "pickup", "other"];

function AdminShipments() {
  const fn = useServerFn(adminListShipments);
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const q = useQuery({
    queryKey: ["admin-shipments", status, carrier],
    queryFn: () => fn({ data: { status: status || undefined, carrier: carrier || undefined } }),
  });
  const items = (q.data ?? []) as any[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Shipments</h1>
        <p className="text-sm text-muted-foreground">Global fulfillment tracking across all sellers.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={carrier || "all"} onValueChange={(v) => setCarrier(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Carrier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All carriers</SelectItem>
            {CARRIERS.filter(Boolean).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardHeader><CardTitle>{items.length} shipments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
           items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No shipments found.</p> : (
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <li key={s.id} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[1.5fr_1fr_1fr_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium">{s.order?.order_number}</p>
                    <p className="text-xs text-muted-foreground">{s.seller?.store_name} · {new Date(s.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-sm"><span className="uppercase font-medium">{s.carrier}</span></div>
                  <div className="text-sm">
                    {s.tracking_number ? (
                      s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="font-mono text-xs underline">{s.tracking_number}</a>
                                     : <span className="font-mono text-xs">{s.tracking_number}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="text-sm tabular-nums">{s.cost_aed ? `${Number(s.cost_aed).toFixed(2)} AED` : "—"}</div>
                  <Badge variant="secondary">{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}