import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Star } from "lucide-react";
import { upsertVariant, deleteVariant } from "@/lib/seller.functions";
import { toast } from "sonner";

export type Variant = {
  id?: string;
  format_label?: string | null;
  sku?: string | null;
  price_aed: number;
  compare_at_price_aed?: number | null;
  stock: number;
  weight_grams?: number | null;
  is_default: boolean;
};

export function ProductVariantsEditor({
  productId, variants, onChange,
}: { productId?: string; variants: Variant[]; onChange: (v: Variant[]) => void }) {
  const upsert = useServerFn(upsertVariant);
  const del = useServerFn(deleteVariant);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: async (v: Variant) => {
      if (!productId) throw new Error("Save the product first");
      return upsert({ data: {
        id: v.id, productId,
        format_label: v.format_label ?? null, sku: v.sku ?? null,
        price_aed: Number(v.price_aed) || 0,
        compare_at_price_aed: v.compare_at_price_aed ?? null,
        stock: Number(v.stock) || 0,
        weight_grams: v.weight_grams ?? null,
        is_default: !!v.is_default,
      } });
    },
    onSuccess: (res, v) => {
      toast.success("Variant saved");
      if (!v.id && res?.id) {
        const next = variants.map((x) => x === v ? { ...x, id: res.id } : x);
        // Default exclusivity: if just-saved is default, clear others
        if (v.is_default) next.forEach((x) => { if (x !== variants.find((y) => y === v)) x.is_default = false; });
        onChange([...next]);
      }
      setPendingIdx(null);
    },
    onError: (e: any) => { toast.error(e?.message ?? "Save failed"); setPendingIdx(null); },
  });

  const removeM = useMutation({
    mutationFn: (v: Variant) => v.id ? del({ data: { variantId: v.id } }) : Promise.resolve({ ok: true }),
    onSuccess: (_d, v) => onChange(variants.filter((x) => x !== v)),
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  function update(i: number, patch: Partial<Variant>) {
    const next = variants.map((v, idx) => idx === i ? { ...v, ...patch } : v);
    if (patch.is_default === true) next.forEach((v, idx) => { if (idx !== i) v.is_default = false; });
    onChange(next);
  }

  function add() {
    onChange([...variants, { format_label: "", price_aed: 0, stock: 0, is_default: variants.length === 0 }]);
  }

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Variants</h3>
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={add}>
          <Plus className="me-2 h-4 w-4" /> Add variant
        </Button>
      </div>
      {variants.length === 0 && <p className="text-xs text-muted-foreground">Add at least one variant with price and stock.</p>}
      <ul className="space-y-3">
        {variants.map((v, i) => (
          <li key={v.id ?? `new-${i}`} className="rounded border border-border/60 p-3">
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2"><Label className="text-xs">Format</Label>
                <Input value={v.format_label ?? ""} onChange={(e) => update(i, { format_label: e.target.value })} placeholder="500 g" /></div>
              <div><Label className="text-xs">Price AED</Label>
                <Input type="number" step="0.01" min={0} value={v.price_aed} onChange={(e) => update(i, { price_aed: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Compare</Label>
                <Input type="number" step="0.01" min={0} value={v.compare_at_price_aed ?? 0} onChange={(e) => update(i, { compare_at_price_aed: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Stock</Label>
                <Input type="number" min={0} value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Weight (g)</Label>
                <Input type="number" min={0} value={v.weight_grams ?? 0} onChange={(e) => update(i, { weight_grams: Number(e.target.value) })} /></div>
              <div className="md:col-span-3"><Label className="text-xs">SKU</Label>
                <Input value={v.sku ?? ""} onChange={(e) => update(i, { sku: e.target.value })} /></div>
              <div className="flex items-end gap-2 md:col-span-3">
                <Button type="button" size="sm" variant={v.is_default ? "default" : "outline"} className="rounded-full"
                  onClick={() => update(i, { is_default: true })}>
                  <Star className="me-1 h-3.5 w-3.5" /> {v.is_default ? "Default" : "Set default"}
                </Button>
                <Button type="button" size="sm" className="rounded-full" disabled={!productId || save.isPending && pendingIdx === i}
                  onClick={() => { setPendingIdx(i); save.mutate(v); }}>
                  {save.isPending && pendingIdx === i ? "Saving…" : (v.id ? "Save" : "Create")}
                </Button>
                <Button type="button" size="icon" variant="ghost" className="ms-auto text-destructive"
                  onClick={() => { if (confirm("Delete variant?")) removeM.mutate(v); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!productId && variants.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Save the product first to persist variants.</p>
      )}
    </div>
  );
}