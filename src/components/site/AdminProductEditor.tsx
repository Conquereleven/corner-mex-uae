import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAddProductImageCanonical,
  adminRemoveProductImageCanonical,
  adminUpsertProductCanonical,
  adminUpsertVariantCanonical,
} from "@/lib/admin-products.functions";

type Category = { id: string; slug: string; name_en: string };
type Translation = { lang: string; name: string; description: string | null };
type Variant = {
  id?: string;
  sku?: string | null;
  format_label?: string | null;
  weight_grams?: number | null;
  price_aed: number;
  compare_at_price_aed?: number | null;
  stock: number;
  is_default: boolean;
  is_active: boolean;
};
type Image = { id: string; url: string; alt_text?: string | null; sort_order: number };
type Product = {
  id: string;
  slug: string;
  brand?: string | null;
  status: "draft" | "active" | "archived";
  origin_region?: string | null;
  spice_level?: number | null;
  is_bulk: boolean;
  is_halal: boolean;
  category_id?: string | null;
  attrs?: Record<string, unknown> | null;
};

export function AdminProductEditor({
  product,
  translations = [],
  variants = [],
  images = [],
  categories,
}: {
  product?: Product;
  translations?: Translation[];
  variants?: Variant[];
  images?: Image[];
  categories: Category[];
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const saveProduct = useServerFn(adminUpsertProductCanonical);
  const saveVariant = useServerFn(adminUpsertVariantCanonical);
  const addImage = useServerFn(adminAddProductImageCanonical);
  const removeImage = useServerFn(adminRemoveProductImageCanonical);
  const tr = useMemo(() => new Map(translations.map((item) => [item.lang, item])), [translations]);
  const [form, setForm] = useState({
    slug: product?.slug ?? "",
    name_en: tr.get("en")?.name ?? "",
    name_es: tr.get("es")?.name ?? "",
    name_ar: tr.get("ar")?.name ?? "",
    description_en: tr.get("en")?.description ?? "",
    description_es: tr.get("es")?.description ?? "",
    description_ar: tr.get("ar")?.description ?? "",
    brand: product?.brand ?? "",
    origin_region: product?.origin_region ?? "",
    spice_level: product?.spice_level ?? 0,
    is_bulk: product?.is_bulk ?? false,
    is_halal: product?.is_halal ?? true,
    status: product?.status ?? ("draft" as const),
    category_id: product?.category_id ?? "none",
    attrs: JSON.stringify(product?.attrs ?? {}, null, 2),
  });
  const [variantRows, setVariantRows] = useState<Variant[]>(variants);
  const [imageRows, setImageRows] = useState<Image[]>(images);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");

  const productMutation = useMutation({
    mutationFn: async () => {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = form.attrs.trim() ? JSON.parse(form.attrs) : {};
      } catch {
        throw new Error("Attributes must be valid JSON");
      }
      return saveProduct({
        data: {
          id: product?.id,
          slug: form.slug.trim(),
          name_en: form.name_en.trim(),
          name_es: form.name_es.trim() || null,
          name_ar: form.name_ar.trim() || null,
          description_en: form.description_en || null,
          description_es: form.description_es || null,
          description_ar: form.description_ar || null,
          brand: form.brand.trim() || null,
          origin_region: form.origin_region.trim() || null,
          spice_level: Number(form.spice_level),
          is_bulk: form.is_bulk,
          is_halal: form.is_halal,
          status: form.status,
          category_id: form.category_id === "none" ? null : form.category_id,
          attrs,
        },
      });
    },
    onSuccess: async (result) => {
      toast.success(result.created ? "Product created as draft" : "Product saved");
      await qc.invalidateQueries({ queryKey: ["admin-products-canonical"] });
      if (result.created) nav({ to: "/admin/products/$id", params: { id: result.productId } });
      else await qc.invalidateQueries({ queryKey: ["admin-product-canonical", product?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function persistVariant(row: Variant, index: number) {
    if (!product?.id) return;
    try {
      const result = await saveVariant({
        data: {
          productId: product.id,
          id: row.id,
          sku: row.sku ?? null,
          format_label: row.format_label ?? null,
          weight_grams: row.weight_grams ?? null,
          price_aed: Number(row.price_aed),
          compare_at_price_aed: row.compare_at_price_aed ?? null,
          stock: Number(row.stock),
          is_default: row.is_default,
          is_active: row.is_active,
        },
      });
      setVariantRows((current) =>
        current.map((item, itemIndex) => (itemIndex === index ? { ...item, id: result.id } : item)),
      );
      toast.success("Variant and inventory saved atomically");
      await qc.invalidateQueries({ queryKey: ["admin-product-canonical", product.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Variant update failed");
    }
  }

  async function addProductImage() {
    if (!product?.id || !imageUrl.trim()) return;
    try {
      const row = await addImage({
        data: { productId: product.id, url: imageUrl.trim(), alt_text: imageAlt.trim() || null },
      });
      setImageRows((current) => [...current, row]);
      setImageUrl("");
      setImageAlt("");
      toast.success("Image added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image update failed");
    }
  }

  async function deleteProductImage(imageId: string) {
    if (!product?.id) return;
    try {
      await removeImage({ data: { productId: product.id, imageId } });
      setImageRows((current) => current.filter((item) => item.id !== imageId));
      toast.success("Image removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image update failed");
    }
  }

  function patchVariant(index: number, patch: Partial<Variant>) {
    setVariantRows((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return patch.is_default ? { ...item, is_default: false } : item;
        }
        return { ...item, ...patch };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Name (English)</Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
                  })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Name (Español)</Label>
              <Input
                value={form.name_es}
                onChange={(e) => setForm({ ...form, name_es: e.target.value })}
              />
            </div>
            <div>
              <Label>Name (العربية)</Label>
              <Input
                dir="rtl"
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Description (English)</Label>
            <Textarea
              rows={4}
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Description (Español)</Label>
              <Textarea
                rows={3}
                value={form.description_es}
                onChange={(e) => setForm({ ...form, description_es: e.target.value })}
              />
            </div>
            <div>
              <Label>Description (العربية)</Label>
              <Textarea
                dir="rtl"
                rows={3}
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Brand</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div>
              <Label>Origin</Label>
              <Input
                value={form.origin_region}
                onChange={(e) => setForm({ ...form, origin_region: e.target.value })}
              />
            </div>
            <div>
              <Label>Spice level</Label>
              <Input
                type="number"
                min={0}
                max={5}
                value={form.spice_level}
                onChange={(e) => setForm({ ...form, spice_level: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(value) => setForm({ ...form, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.is_halal}
                onCheckedChange={(value) => setForm({ ...form, is_halal: value })}
              />{" "}
              Halal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.is_bulk}
                onCheckedChange={(value) => setForm({ ...form, is_bulk: value })}
              />{" "}
              Bulk / wholesale
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as typeof form.status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Activation requires at least one active variant with a positive AED price.
              </p>
            </div>
            <div>
              <Label>Attributes JSON</Label>
              <Textarea
                rows={5}
                className="font-mono text-xs"
                value={form.attrs}
                onChange={(e) => setForm({ ...form, attrs: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => productMutation.mutate()} disabled={productMutation.isPending}>
              {productMutation.isPending ? "Saving…" : product ? "Save product" : "Create draft"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/products">Back to products</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {product ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Variants & inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Stock is written through the canonical atomic inventory transaction. Variant stock
                and quantity on hand cannot diverge.
              </p>
              {variantRows.map((row, index) => (
                <div
                  key={row.id ?? `new-${index}`}
                  className="grid gap-3 rounded-lg border p-4 md:grid-cols-8"
                >
                  <div className="md:col-span-2">
                    <Label>SKU</Label>
                    <Input
                      value={row.sku ?? ""}
                      onChange={(e) => patchVariant(index, { sku: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Format</Label>
                    <Input
                      value={row.format_label ?? ""}
                      onChange={(e) => patchVariant(index, { format_label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Price AED</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.price_aed}
                      onChange={(e) => patchVariant(index, { price_aed: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Compare</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.compare_at_price_aed ?? 0}
                      onChange={(e) =>
                        patchVariant(index, {
                          compare_at_price_aed: Number(e.target.value) || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Stock</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.stock}
                      onChange={(e) => patchVariant(index, { stock: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Weight g</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.weight_grams ?? 0}
                      onChange={(e) =>
                        patchVariant(index, { weight_grams: Number(e.target.value) || null })
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={row.is_default}
                        onCheckedChange={(value) => patchVariant(index, { is_default: value })}
                      />{" "}
                      Default
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={(value) => patchVariant(index, { is_active: value })}
                      />{" "}
                      Active
                    </label>
                  </div>
                  <div className="md:col-span-8">
                    <Button size="sm" onClick={() => persistVariant(row, index)}>
                      {row.id ? "Save variant" : "Create variant"}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setVariantRows((current) => [
                    ...current,
                    { price_aed: 0, stock: 0, is_default: current.length === 0, is_active: true },
                  ])
                }
              >
                <Plus className="me-2 h-4 w-4" /> Add variant
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div>
                  <Label>Image URL</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </div>
                <div>
                  <Label>Alt text</Label>
                  <Input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addProductImage}>Add image</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {imageRows.map((image) => (
                  <div key={image.id} className="overflow-hidden rounded-lg border">
                    <img
                      src={image.url}
                      alt={image.alt_text ?? ""}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-2 p-2">
                      <span className="truncate text-xs">{image.alt_text || "Product image"}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteProductImage(image.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
