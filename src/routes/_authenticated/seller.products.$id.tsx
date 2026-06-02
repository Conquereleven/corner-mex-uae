import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSellerProduct } from "@/lib/seller.functions";
import { ProductForm } from "@/components/site/ProductForm";

export const Route = createFileRoute("/_authenticated/seller/products/$id")({
  head: () => ({ meta: [{ title: "Edit product" }] }),
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const fn = useServerFn(getSellerProduct);
  const q = useQuery({ queryKey: ["seller-product", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Not found.</p>;

  const p: any = q.data;
  const tr = (p.translations ?? []) as Array<{ lang: string; name: string; description: string | null }>;
  const en = tr.find((t) => t.lang === "en");
  const es = tr.find((t) => t.lang === "es");
  const ar = tr.find((t) => t.lang === "ar");
  const def = (p.variants ?? []).find((v: any) => v.is_default) ?? p.variants?.[0];
  const images = (p.images ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((im: any) => ({ id: im.id, url: im.url, sort_order: im.sort_order }));
  const variants = (p.variants ?? []).map((v: any) => ({
    id: v.id,
    format_label: v.format_label ?? "",
    sku: v.sku ?? "",
    price_aed: Number(v.price_aed ?? 0),
    compare_at_price_aed: v.compare_at_price_aed ? Number(v.compare_at_price_aed) : null,
    stock: Number(v.stock ?? 0),
    weight_grams: v.weight_grams ?? null,
    is_default: !!v.is_default,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight">Edit product</h1>
      <div className="mt-8">
        <ProductForm
          initial={{
            id: p.id,
            name_en: en?.name ?? "",
            name_es: es?.name ?? "",
            name_ar: ar?.name ?? "",
            description_en: en?.description ?? "",
            description_es: es?.description ?? "",
            description_ar: ar?.description ?? "",
            brand: p.brand ?? "",
            origin_region: p.origin_region ?? "",
            spice_level: p.spice_level ?? 0,
            is_bulk: p.is_bulk,
            is_halal: p.is_halal ?? true,
            status: p.status,
            category_slug: p.category?.slug ?? "",
            images,
            variants,
          }}
          onSaved={() => nav({ to: "/seller/products" })}
        />
      </div>
    </div>
  );
}