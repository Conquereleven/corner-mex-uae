import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListReturns } from "@/lib/returns.functions";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  head: () => ({ meta: [{ title: "Admin — Returns" }] }),
  component: AdminReturns,
});

const STATUSES = ["", "requested", "approved", "rejected", "received", "refunded", "cancelled"];

function AdminReturns() {
  const fn = useServerFn(adminListReturns);
  const [status, setStatus] = useState("");
  const q = useQuery({ queryKey: ["admin-returns", status], queryFn: () => fn({ data: { status: status || undefined } }) });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Returns</h1>
      <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {STATUSES.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Card><CardHeader><CardTitle>{(q.data ?? []).length} returns</CardTitle></CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
         (q.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">None.</p> : (
          <ul className="divide-y divide-border">
            {(q.data as any[]).map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                <div>
                  <p className="font-medium">{r.return_number}</p>
                  <p className="text-xs text-muted-foreground">{r.order?.order_number} · {r.seller?.store_name}</p>
                </div>
                <div className="text-sm">{r.item?.product_name} × {r.qty}</div>
                <div className="text-sm tabular-nums">{r.refund_aed != null ? `AED ${Number(r.refund_aed).toFixed(2)}` : "—"}</div>
                <Badge variant="secondary">{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}
