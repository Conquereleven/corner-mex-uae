import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, X, ArrowLeft, ArrowRight, ImageIcon } from "lucide-react";
import { uploadProductImage, removeProductImage, reorderProductImages } from "@/lib/seller.functions";
import { toast } from "sonner";

export type ProductImage = { id: string; url: string; sort_order: number };

export function ProductImagesEditor({
  productId, images, onChange,
}: { productId?: string; images: ProductImage[]; onChange: (next: ProductImage[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = useServerFn(uploadProductImage);
  const remove = useServerFn(removeProductImage);
  const reorder = useServerFn(reorderProductImages);

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { imageId: id } }),
    onSuccess: (_d, id) => onChange(images.filter((i) => i.id !== id)),
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    if (!productId) {
      toast.error("Save the product first to add images.");
      return;
    }
    setBusy(true);
    try {
      const next = [...images];
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} > 5MB`); continue; }
        const dataBase64 = await fileToBase64(file);
        const row = await upload({ data: { productId, filename: file.name, contentType: file.type || "image/jpeg", dataBase64 } });
        next.push(row as ProductImage);
      }
      onChange(next);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
    if (productId) {
      try { await reorder({ data: { productId, orderedIds: next.map((i) => i.id) } }); }
      catch (e: any) { toast.error(e?.message ?? "Reorder failed"); }
    }
  }

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Images</h3>
        <Button type="button" size="sm" variant="outline" className="rounded-full"
          disabled={busy || !productId}
          onClick={() => inputRef.current?.click()}>
          <Upload className="me-2 h-4 w-4" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {!productId && (
        <p className="text-xs text-muted-foreground">Save basic info first, then upload images here.</p>
      )}
      {productId && images.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-6 w-6 opacity-50" />
          No images yet — the first one is used as cover.
        </div>
      )}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, idx) => (
            <li key={img.id} className="group relative overflow-hidden rounded-md border border-border bg-muted">
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {idx === 0 && <span className="absolute start-1 top-1 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-background">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/85 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === images.length - 1}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeM.mutate(img.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}