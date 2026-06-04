import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ExternalLink, Copy, Upload } from "lucide-react";
import { getSellerStorefront, updateSellerStorefront, uploadSellerAsset } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/storefront")({
  head: () => ({ meta: [{ title: "Storefront — Seller Studio" }] }),
  component: SellerStorefront,
});

function SellerStorefront() {
  const qc = useQueryClient();
  const get = useServerFn(getSellerStorefront);
  const save = useServerFn(updateSellerStorefront);
  const upload = useServerFn(uploadSellerAsset);
  const q = useQuery({ queryKey: ["seller-storefront"], queryFn: () => get({}) });

  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (q.data && !f) setF({
      ...q.data,
      social_links: q.data.social_links ?? {},
      featured_product_ids: q.data.featured_product_ids ?? [],
      business_hours: q.data.business_hours ?? {},
    });
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => save({ data: {
      store_name: f.store_name, tagline: f.tagline || null, bio: f.bio || null,
      logo_url: f.logo_url || null, cover_url: f.cover_url || null,
      contact_email: f.contact_email || null, contact_phone: f.contact_phone || null,
      social_links: f.social_links || {}, is_published: !!f.is_published,
      featured_product_ids: f.featured_product_ids ?? [],
      business_hours: f.business_hours ?? {},
    }}),
    onSuccess: () => { toast.success("Storefront saved"); qc.invalidateQueries({ queryKey: ["seller-storefront"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (!f) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const handleFile = async (kind: "logo" | "cover", file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(",")[1];
      try {
        const { url } = await upload({ data: { kind, filename: file.name, contentType: file.type || "image/jpeg", dataBase64: b64 } });
        setF((p: any) => ({ ...p, [kind === "logo" ? "logo_url" : "cover_url"]: url }));
        toast.success(`${kind} uploaded`);
      } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    };
    reader.readAsDataURL(file);
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/sellers/${f.slug}` : `/sellers/${f.slug}`;
  const activeProducts = (f.products ?? []).filter((p: any) => p.status === "active");
  const featuredIds: string[] = f.featured_product_ids ?? [];
  const DAYS: { k: "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"; label: string }[] = [
    { k: "mon", label: "Monday" }, { k: "tue", label: "Tuesday" }, { k: "wed", label: "Wednesday" },
    { k: "thu", label: "Thursday" }, { k: "fri", label: "Friday" }, { k: "sat", label: "Saturday" }, { k: "sun", label: "Sunday" },
  ];
  const toggleFeatured = (id: string) => {
    const cur: string[] = f.featured_product_ids ?? [];
    if (cur.includes(id)) setF({ ...f, featured_product_ids: cur.filter((x) => x !== id) });
    else if (cur.length < 8) setF({ ...f, featured_product_ids: [...cur, id] });
    else toast.error("You can feature up to 8 products");
  };
  const setHour = (day: string, key: "open"|"close"|"closed", val: any) => {
    const bh = { ...(f.business_hours ?? {}) };
    bh[day] = { ...(bh[day] ?? {}), [key]: val };
    setF({ ...f, business_hours: bh });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storefront</h1>
          <p className="text-sm text-muted-foreground">Your public store profile at <code>/sellers/{f.slug}</code>.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copied"); }}>
            <Copy className="h-4 w-4 mr-2" /> Copy link
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/sellers/$slug" params={{ slug: f.slug }} target="_blank"><ExternalLink className="h-4 w-4 mr-2" />Preview</Link>
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Published</Label>
                  <p className="text-xs text-muted-foreground">When off, your storefront is hidden from the public listing.</p>
                </div>
                <Switch checked={!!f.is_published} onCheckedChange={(v) => setF((p: any) => ({ ...p, is_published: v }))} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <AssetUploader label="Logo" url={f.logo_url} onFile={(file) => handleFile("logo", file)} aspect="square" />
                <AssetUploader label="Cover image" url={f.cover_url} onFile={(file) => handleFile("cover", file)} aspect="wide" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Store name</Label><Input value={f.store_name ?? ""} onChange={(e) => setF({ ...f, store_name: e.target.value })} /></div>
                <div><Label>Tagline</Label><Input value={f.tagline ?? ""} maxLength={160} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></div>
              </div>
              <div><Label>About</Label><Textarea rows={5} value={f.bio ?? ""} maxLength={2000} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Public contact & socials</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Public email</Label><Input type="email" value={f.contact_email ?? ""} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
                <div><Label>WhatsApp / phone</Label><Input value={f.contact_phone ?? ""} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {(["website", "instagram", "tiktok"] as const).map((k) => (
                  <div key={k}>
                    <Label className="capitalize">{k}</Label>
                    <Input value={f.social_links?.[k] ?? ""} onChange={(e) => setF({ ...f, social_links: { ...(f.social_links ?? {}), [k]: e.target.value } })} placeholder={k === "website" ? "https://…" : "@handle or URL"} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden bg-muted/30">
              {f.cover_url ? (
                <img src={f.cover_url} alt="" className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-muted to-muted/60" />
              )}
              <div className="p-4 -mt-10">
                <div className="h-16 w-16 rounded-full border-4 border-background bg-muted overflow-hidden">
                  {f.logo_url && <img src={f.logo_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <h3 className="mt-3 font-semibold">{f.store_name || "Store name"}</h3>
                <p className="text-xs text-muted-foreground">{f.tagline || "Your tagline appears here."}</p>
                <p className="text-sm mt-3 line-clamp-4">{f.bio || "About text…"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Featured products</CardTitle>
          <p className="text-sm text-muted-foreground">Pick up to 8 active products to highlight at the top of your public store. {featuredIds.length}/8 selected.</p>
        </CardHeader>
        <CardContent>
          {activeProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no active products yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {activeProducts.map((p: any) => {
                const on = featuredIds.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleFeatured(p.id)}
                    className={`group relative rounded-lg border-2 overflow-hidden text-left transition ${on ? "border-primary" : "border-border hover:border-muted-foreground/40"}`}>
                    <div className="aspect-square bg-muted">
                      {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="p-2">
                      <p className="text-xs line-clamp-2">{p.name}</p>
                    </div>
                    {on && (
                      <span className="absolute top-1.5 right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                        {featuredIds.indexOf(p.id) + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business hours</CardTitle>
          <p className="text-sm text-muted-foreground">Shown publicly on your storefront. Leave empty to hide.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((d) => {
            const v = f.business_hours?.[d.k] ?? {};
            return (
              <div key={d.k} className="flex items-center gap-3 flex-wrap">
                <div className="w-28 text-sm">{d.label}</div>
                <div className="flex items-center gap-2">
                  <Switch checked={!v.closed} onCheckedChange={(on) => setHour(d.k, "closed", !on)} />
                  <span className="text-xs text-muted-foreground w-12">{v.closed ? "Closed" : "Open"}</span>
                </div>
                <Input type="time" className="w-32" disabled={!!v.closed} value={v.open ?? ""} onChange={(e) => setHour(d.k, "open", e.target.value)} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" className="w-32" disabled={!!v.closed} value={v.close ?? ""} onChange={(e) => setHour(d.k, "close", e.target.value)} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AssetUploader({ label, url, onFile, aspect }: { label: string; url: string | null; onFile: (f: File) => void; aspect: "square" | "wide" }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label>{label}</Label>
      <div className={`mt-1 rounded-md border-2 border-dashed bg-muted/20 overflow-hidden ${aspect === "square" ? "aspect-square max-w-[140px]" : "aspect-[3/1]"}`}>
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => ref.current?.click()}><Upload className="h-3 w-3 mr-2" />Upload</Button>
    </div>
  );
}