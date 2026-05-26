import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertSellerProduct } from "@/lib/seller.functions";
import { toast } from "sonner";

export type ProductFormValues = {
  id?: string;
  name_en: string;
  name_es?: string;
  name_ar?: string;
  description_en?: string;
  brand?: string;
  origin_region?: string;
  spice_level?: number;
  is_bulk: boolean;
  status: "draft" | "active" | "archived";
  category_slug?: string;
  image_url?: string;
  variant: {
    format_label?: string;
    price_aed: number;
    compare_at_price_aed?: number;
    stock: number;
    sku?: string;
  };
};

const defaults: ProductFormValues = {
  name_en: "",
  is_bulk: false,
  status: "active",
  variant: { price_aed: 0, stock: 0 },
};

const CATEGORIES = ["chiles", "salsas", "masa", "snacks", "drinks", "pantry"];

export function ProductForm({ initial, onSaved }: { initial?: ProductFormValues; onSaved?: () => void }) {
  const [form, setForm] = useState<ProductFormValues>({ ...defaults, ...(initial ?? {}) });
  const fn = useServerFn(upsertSellerProduct);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: ProductFormValues) => fn({ data: input as any }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["seller-products"] }); onSaved?.(); },
    onError: (e: any) => toast.error(e.message),
  });
  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setV = <K extends keyof ProductFormValues["variant"]>(k: K, v: ProductFormValues["variant"][K]) =>
    setForm((f) => ({ ...f, variant: { ...f.variant, [k]: v } }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(form); }} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2"><Label>Name (English)</Label><Input required value={form.name_en} onChange={(e) => set("name_en", e.target.value)} /></div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div><Label>Name (Español)</Label><Input value={form.name_es ?? ""} onChange={(e) => set("name_es", e.target.value)} /></div>
        <div><Label>Name (العربية)</Label><Input value={form.name_ar ?? ""} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" /></div>
      </div>

      <div><Label>Description (English)</Label><Textarea rows={4} value={form.description_en ?? ""} onChange={(e) => set("description_en", e.target.value)} /></div>

      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>Brand</Label><Input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
        <div><Label>Origin region</Label><Input value={form.origin_region ?? ""} onChange={(e) => set("origin_region", e.target.value)} /></div>
        <div>
          <Label>Category</Label>
          <Select value={form.category_slug ?? ""} onValueChange={(v) => set("category_slug", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div><Label>Spice level (0–5)</Label><Input type="number" min={0} max={5} value={form.spice_level ?? 0} onChange={(e) => set("spice_level", Number(e.target.value))} /></div>
        <div className="flex items-end gap-3"><div className="flex items-center gap-2 pb-2"><Switch checked={form.is_bulk} onCheckedChange={(v) => set("is_bulk", v)} /><span className="text-sm">Bulk / wholesale</span></div></div>
        <div><Label>Image URL</Label><Input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." /></div>
      </div>

      <div className="rounded-lg border border-border/60 p-4">
        <h3 className="mb-3 font-medium">Default variant</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div><Label>Format</Label><Input value={form.variant.format_label ?? ""} onChange={(e) => setV("format_label", e.target.value)} placeholder="500 g" /></div>
          <div><Label>Price (AED)</Label><Input type="number" step="0.01" min={0} required value={form.variant.price_aed} onChange={(e) => setV("price_aed", Number(e.target.value))} /></div>
          <div><Label>Compare-at (AED)</Label><Input type="number" step="0.01" min={0} value={form.variant.compare_at_price_aed ?? 0} onChange={(e) => setV("compare_at_price_aed", Number(e.target.value))} /></div>
          <div><Label>Stock</Label><Input type="number" min={0} required value={form.variant.stock} onChange={(e) => setV("stock", Number(e.target.value))} /></div>
          <div className="md:col-span-2"><Label>SKU</Label><Input value={form.variant.sku ?? ""} onChange={(e) => setV("sku", e.target.value)} /></div>
        </div>
      </div>

      <Button type="submit" disabled={m.isPending} className="rounded-full">{m.isPending ? "Saving…" : "Save product"}</Button>
    </form>
  );
}