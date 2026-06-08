import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertSellerProduct, deleteSellerProduct, listProductCategories } from "@/lib/seller.functions";
import { adminUpsertProduct } from "@/lib/admin.functions";
import { ProductImagesEditor, type ProductImage } from "@/components/site/ProductImagesEditor";
import { ProductVariantsEditor, type Variant } from "@/components/site/ProductVariantsEditor";
import { Link } from "@tanstack/react-router";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type ProductFormValues = {
  id?: string;
  slug?: string;
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
  attrs?: Record<string, any>;
  images?: ProductImage[];
  variants?: Variant[];
};

const defaults: ProductFormValues = {
  name_en: "",
  is_bulk: false,
  is_halal: true,
  status: "active",
  attrs: {},
  images: [],
  variants: [],
};

type ProductCategoryOption = { slug: string; name: string };

export function ProductForm({
  initial, onSaved, onCancel, onDeleted, adminSellerId,
}: {
  initial?: ProductFormValues;
  onSaved?: (result?: { productId?: string; isNew?: boolean }) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
  adminSellerId?: string;
}) {
  const [form, setForm] = useState<ProductFormValues>({ ...defaults, ...(initial ?? {}) });
  const [productId, setProductId] = useState<string | undefined>(initial?.id);
  const [productSlug, setProductSlug] = useState<string | undefined>((initial as any)?.slug);
  const [submitMode, setSubmitMode] = useState<"save" | "draft">("save");
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? []);
  const [attrsText, setAttrsText] = useState<string>(
    JSON.stringify(initial?.attrs ?? {}, null, 2),
  );
  const [attrsError, setAttrsError] = useState<string | null>(null);
  const sellerFn = useServerFn(upsertSellerProduct);
  const adminFn = useServerFn(adminUpsertProduct);
  const delFn = useServerFn(deleteSellerProduct);
  const categoriesFn = useServerFn(listProductCategories);
  const qc = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => categoriesFn({}),
  });
  const categories = (categoriesQuery.data ?? []) as ProductCategoryOption[];
  const m = useMutation({
    mutationFn: (input: ProductFormValues) => {
      const payload = {
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
      attrs: input.attrs ?? {},
      };
      return adminSellerId
        ? adminFn({ data: { ...payload, seller_id: adminSellerId } as any })
        : sellerFn({ data: payload as any });
    },
    onSuccess: (res: any) => {
      toast.success(form.status === "draft" ? "Saved as draft" : "Saved");
      qc.invalidateQueries({ queryKey: ["seller-products"] });
      const wasNew = !initial?.id;
      if (res?.productId) {
        setProductId(res.productId);
        setForm((f) => ({ ...f, id: res.productId }));
      }
      // Notify parent on every successful save. The parent decides where to
      // navigate (edit → list, new → edit page so images/variants can be added).
      if (onSaved) onSaved({ productId: res?.productId, isNew: wasNew });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const removeM = useMutation({
    mutationFn: () => delFn({ data: { id: productId! } }),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["seller-products"] });
      if (onDeleted) onDeleted();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, any> = {};
    const txt = attrsText.trim();
    if (txt) {
      try {
        const v = JSON.parse(txt);
        if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Must be a JSON object");
        parsed = v;
        setAttrsError(null);
      } catch (err: any) {
        setAttrsError(err?.message ?? "Invalid JSON");
        toast.error("Attributes JSON is invalid");
        return;
      }
    }
    const status = submitMode === "draft" ? "draft" : form.status;
    m.mutate({ ...form, status, attrs: parsed });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          <Select value={form.category_slug ?? "uncategorized"} onValueChange={(v) => set("category_slug", v === "uncategorized" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder={categoriesQuery.isLoading ? "Loading categories…" : "Select"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div><Label>Spice level (0–5)</Label><Input type="number" min={0} max={5} value={form.spice_level ?? 0} onChange={(e) => set("spice_level", Number(e.target.value))} /></div>
        <div className="flex items-end gap-3"><div className="flex items-center gap-2 pb-2"><Switch checked={form.is_bulk} onCheckedChange={(v) => set("is_bulk", v)} /><span className="text-sm">Bulk / wholesale</span></div></div>
        <div className="flex items-end gap-3"><div className="flex items-center gap-2 pb-2"><Switch checked={form.is_halal} onCheckedChange={(v) => set("is_halal", v)} /><span className="text-sm">Halal</span></div></div>
      </div>

      {adminSellerId ? (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Images and variants can be added by the seller from their Seller Studio after creation, or imported via CSV.
        </div>
      ) : (
        <>
          <ProductImagesEditor productId={productId} images={images} onChange={setImages} />
          <ProductVariantsEditor productId={productId} variants={variants} onChange={setVariants} />
        </>
      )}

      <div className="rounded-lg border border-border/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Custom attributes</h3>
            <p className="text-xs text-muted-foreground">Optional JSON metadata shown on the product page (e.g. <code>{`{"scoville": 30000, "shelf_life_months": 12}`}</code>).</p>
          </div>
        </div>
        <Textarea
          rows={6}
          spellCheck={false}
          className="font-mono text-xs"
          value={attrsText}
          onChange={(e) => { setAttrsText(e.target.value); setAttrsError(null); }}
          placeholder='{}'
        />
        {attrsError && <p className="mt-1 text-xs text-destructive">{attrsError}</p>}
      </div>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t border-border/60 bg-background/95 px-1 py-3 backdrop-blur">
        <Button
          type="submit"
          disabled={m.isPending}
          className="rounded-full"
          onClick={() => setSubmitMode("save")}
        >
          {m.isPending && submitMode === "save"
            ? "Saving…"
            : productId ? "Save changes" : "Publish product"}
        </Button>
        <Button
          type="submit"
          variant="secondary"
          className="rounded-full"
          disabled={m.isPending}
          onClick={() => setSubmitMode("draft")}
        >
          {m.isPending && submitMode === "draft" ? "Saving…" : "Save as draft"}
        </Button>
        {productSlug && (
          <Button asChild type="button" variant="outline" className="rounded-full">
            <Link to="/product/$slug" params={{ slug: productSlug }} target="_blank">
              <Eye className="me-2 h-4 w-4" /> Preview
            </Link>
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {productId && onDeleted && (
          <Button
            type="button"
            variant="ghost"
            className="ms-auto rounded-full text-destructive hover:text-destructive"
            disabled={removeM.isPending}
            onClick={() => {
              if (confirm("Delete this product? This cannot be undone.")) removeM.mutate();
            }}
          >
            <Trash2 className="me-2 h-4 w-4" />
            {removeM.isPending ? "Deleting…" : "Delete product"}
          </Button>
        )}
      </div>
      {!productId && (
        <p className="text-xs text-muted-foreground">Tip: after creating the product, you'll be able to upload images and add variants below.</p>
      )}
    </form>
  );
}