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
import { ProductImagesEditor, type ProductImage } from "@/components/site/ProductImagesEditor";
import { ProductVariantsEditor, type Variant } from "@/components/site/ProductVariantsEditor";
import { toast } from "sonner";

export type ProductFormValues = {
  id?: string;
  name_en: string;
  name_es?: string;
  name_ar?: string;
  description_en?: string;
  description_es?: string;
  description_ar?: string;
  brand?: string;
  origin_region?: string;
  spice_level?: number;
  is_bulk: boolean;
  is_halal: boolean;
  status: "draft" | "active" | "archived";
  category_slug?: string;
  images?: ProductImage[];
  variants?: Variant[];
};

const defaults: ProductFormValues = {
  name_en: "",
  is_bulk: false,
  is_halal: true,
  status: "active",
  images: [],
  variants: [],
};

const CATEGORIES = ["chiles", "salsas", "masa", "snacks", "drinks", "pantry"];

export function ProductForm({ initial, onSaved }: { initial?: ProductFormValues; onSaved?: () => void }) {
  const [form, setForm] = useState<ProductFormValues>({ ...defaults, ...(initial ?? {}) });
  const [productId, setProductId] = useState<string | undefined>(initial?.id);
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? []);
  const fn = useServerFn(upsertSellerProduct);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: ProductFormValues) => fn({ data: {
      id: input.id,
      name_en: input.name_en,
      name_es: input.name_es || null,
      name_ar: input.name_ar || null,
      description_en: input.description_en || null,
      description_es: input.description_es || null,
      description_ar: input.description_ar || null,
      brand: input.brand || null,
      origin_region: input.origin_region || null,
      spice_level: input.spice_level ?? null,
      is_bulk: input.is_bulk,
      is_halal: input.is_halal,
      status: input.status,
      category_slug: input.category_slug || null,
    } as any }),
    onSuccess: (res: any) => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["seller-products"] });
      if (res?.productId) {
        setProductId(res.productId);
        setForm((f) => ({ ...f, id: res.productId }));
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

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
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label>Description (Español)</Label><Textarea rows={3} value={form.description_es ?? ""} onChange={(e) => set("description_es", e.target.value)} /></div>
        <div><Label>Description (العربية)</Label><Textarea rows={3} value={form.description_ar ?? ""} onChange={(e) => set("description_ar", e.target.value)} dir="rtl" /></div>
      </div>

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

      <div className="grid gap-4 md:grid-cols-4">
        <div><Label>Spice level (0–5)</Label><Input type="number" min={0} max={5} value={form.spice_level ?? 0} onChange={(e) => set("spice_level", Number(e.target.value))} /></div>
        <div className="flex items-end gap-3"><div className="flex items-center gap-2 pb-2"><Switch checked={form.is_bulk} onCheckedChange={(v) => set("is_bulk", v)} /><span className="text-sm">Bulk / wholesale</span></div></div>
        <div className="flex items-end gap-3"><div className="flex items-center gap-2 pb-2"><Switch checked={form.is_halal} onCheckedChange={(v) => set("is_halal", v)} /><span className="text-sm">Halal</span></div></div>
      </div>

      <ProductImagesEditor productId={productId} images={images} onChange={setImages} />
      <ProductVariantsEditor productId={productId} variants={variants} onChange={setVariants} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={m.isPending} className="rounded-full">
          {m.isPending ? "Saving…" : productId ? "Save changes" : "Create product"}
        </Button>
        {productId && onSaved && (
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onSaved()}>
            Done
          </Button>
        )}
      </div>
      {!productId && (
        <p className="text-xs text-muted-foreground">Tip: after creating the product, you'll be able to upload images and add variants below.</p>
      )}
    </form>
  );
}