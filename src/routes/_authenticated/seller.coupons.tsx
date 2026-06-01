import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCoupons, upsertCoupon, deleteCoupon } from "@/lib/coupons.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seller/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Seller Studio" }] }),
  component: SellerCoupons,
});

function SellerCoupons() {
  const qc = useQueryClient();
  const list = useServerFn(listCoupons);
  const save = useServerFn(upsertCoupon);
  const del = useServerFn(deleteCoupon);
  const q = useQuery({ queryKey: ["seller-coupons"], queryFn: () => list({ data: { scope: "mine" } }) });

  const [form, setForm] = useState({
    code: "", kind: "percent" as "percent" | "fixed", value: 10,
    min_subtotal_aed: 0, max_discount_aed: "" as string | "",
    starts_at: "", ends_at: "", max_uses: "" as string | "",
    is_active: true, description: "",
  });

  const m = useMutation({
    mutationFn: () => save({ data: {
      code: form.code, kind: form.kind, value: Number(form.value),
      min_subtotal_aed: Number(form.min_subtotal_aed),
      max_discount_aed: form.max_discount_aed ? Number(form.max_discount_aed) : null,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      is_active: form.is_active, description: form.description || null,
    } }),
    onSuccess: () => {
      toast.success("Coupon saved");
      qc.invalidateQueries({ queryKey: ["seller-coupons"] });
      setForm({ ...form, code: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["seller-coupons"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>New coupon</CardTitle>
          <p className="text-xs text-muted-foreground">Applies only to items from your store at checkout.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (AED)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Min subtotal (AED)</Label><Input type="number" value={form.min_subtotal_aed} onChange={(e) => setForm({ ...form, min_subtotal_aed: Number(e.target.value) })} /></div>
            <div><Label>Max discount (AED)</Label><Input type="number" value={form.max_discount_aed} onChange={(e) => setForm({ ...form, max_discount_aed: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Ends at</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><Label>Max uses</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.code} className="w-full">Save coupon</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My coupons</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
           (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No coupons yet — create one to start promoting.</p> : (
            <ul className="divide-y divide-border">
              {(q.data as any[]).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-mono font-medium">{c.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.kind === "percent" ? `${c.value}% off` : `AED ${c.value} off`}
                      {c.min_subtotal_aed > 0 && <> · min AED {Number(c.min_subtotal_aed).toFixed(0)}</>}
                      {c.max_uses && <> · {c.uses_count}/{c.max_uses} used</>}
                      {c.ends_at && <> · ends {new Date(c.ends_at).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "active" : "off"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => dm.mutate(c.id)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}