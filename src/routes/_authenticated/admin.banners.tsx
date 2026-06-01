import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { adminListBanners, upsertBanner, deleteBanner } from "@/lib/banners.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  component: BannersAdmin,
});

function BannersAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBanners);
  const save = useServerFn(upsertBanner);
  const del = useServerFn(deleteBanner);
  const q = useQuery({ queryKey: ["admin-banners"], queryFn: () => list({}) });

  const empty = { title: "", subtitle: "", image_url: "", link_url: "", cta_label: "Shop now", sort_order: 0, is_active: true, starts_at: "", ends_at: "" };
  const [form, setForm] = useState(empty);

  const m = useMutation({
    mutationFn: () => save({ data: {
      ...form,
      sort_order: Number(form.sort_order),
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      cta_label: form.cta_label || null,
      subtitle: form.subtitle || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    } }),
    onSuccess: () => { toast.success("Banner saved"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["promo-banners"] }); setForm(empty); },
    onError: (e: any) => toast.error(e.message),
  });
  const dm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["promo-banners"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>New promo banner</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Subtitle</Label><Textarea rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/shop?category=…" /></div>
            <div><Label>CTA label</Label><Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.title} className="w-full">Save banner</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All banners</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
           (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No banners yet.</p> : (
            <ul className="divide-y divide-border">
              {(q.data as any[]).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    {b.image_url && <img src={b.image_url} alt="" className="h-14 w-20 rounded-md object-cover" />}
                    <div>
                      <p className="font-medium">{b.title}</p>
                      {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "active" : "off"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => dm.mutate(b.id)}>Delete</Button>
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