import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListSellers, adminSetSellerStatus } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/sellers")({
  head: () => ({ meta: [{ title: "Admin — Sellers" }] }),
  component: Sellers,
});

const STATUSES = ["pending", "active", "suspended", "rejected"];

function Sellers() {
  const fn = useServerFn(adminListSellers);
  const upd = useServerFn(adminSetSellerStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sellers"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (input: { sellerId: string; status: string }) => upd({ data: input }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-sellers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Sellers</h1>
      <Card>
        <CardContent className="p-0">
          {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : (
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((s: any) => (
                <li key={s.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium">{s.store_name}</p>
                    <p className="text-xs text-muted-foreground">{s.contact_email ?? "—"} · {s.contact_phone ?? "—"} · TRN {s.trn ?? "—"}</p>
                  </div>
                  <div className="text-sm">Comm. {Number(s.commission_rate)}%</div>
                  <Badge variant="outline">{new Date(s.created_at).toLocaleDateString()}</Badge>
                  <Select value={s.status} onValueChange={(v) => m.mutate({ sellerId: s.id, status: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}