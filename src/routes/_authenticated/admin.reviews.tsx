import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
import { adminListReviews, adminSetReviewStatus } from "@/lib/reviews.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({ meta: [{ title: "Admin — Reviews" }] }),
  component: AdminReviews,
});

function AdminReviews() {
  const fn = useServerFn(adminListReviews);
  const setSt = useServerFn(adminSetReviewStatus);
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const q = useQuery({ queryKey: ["admin-reviews", status], queryFn: () => fn({ data: { status: status || undefined } }) });
  const m = useMutation({
    mutationFn: (input: { id: string; status: any }) => setSt({ data: input }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Reviews</h1>
      <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="hidden">Hidden</SelectItem>
        </SelectContent>
      </Select>
      <Card><CardHeader><CardTitle>{(q.data ?? []).length} reviews</CardTitle></CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
         (q.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">No reviews.</p> : (
          <ul className="divide-y divide-border">
            {(q.data as any[]).map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
                <div className="inline-flex items-center gap-0.5 text-primary">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                </div>
                <div>
                  <p className="text-sm font-medium">{r.title || "Review"}</p>
                  {r.body && <p className="text-xs text-muted-foreground">{r.body}</p>}
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.product_slug ?? r.product_id} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="secondary">{r.status}</Badge>
                <div className="flex gap-1">
                  {r.status !== "approved" && <Button size="sm" variant="outline" onClick={() => m.mutate({ id: r.id, status: "approved" })}>Approve</Button>}
                  {r.status !== "hidden" && <Button size="sm" variant="ghost" onClick={() => m.mutate({ id: r.id, status: "hidden" })}>Hide</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}
