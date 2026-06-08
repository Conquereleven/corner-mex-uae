import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSellerProduct } from "@/lib/seller.functions";
import { ProductForm, type ProductFormValues } from "@/components/site/ProductForm";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageX, Pencil } from "lucide-react";

type ProductTranslation = {
  lang: string;
  name: string;
  description: string | null;
};

type SellerProductDetails = {
  id: string;
  slug: string;
  brand: string | null;
  origin_region: string | null;
  spice_level: number | null;
  is_bulk: boolean;
  is_halal: boolean | null;
  status: ProductFormValues["status"];
  attrs: Record<string, unknown> | null;
  category: { slug: string } | null;
  translations: ProductTranslation[] | null;
  images: Array<{ id: string; url: string; sort_order: number }> | null;
  variants: Array<{
    id: string;
    format_label: string | null;
    sku: string | null;
    price_aed: number | string | null;
    compare_at_price_aed: number | string | null;
    stock: number | null;
    weight_grams: number | null;
    is_default: boolean | null;
  }> | null;
};

export const Route = createFileRoute("/_authenticated/seller/products/$id")({
  head: () => ({ meta: [{ title: "Edit product" }] }),
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const fn = useServerFn(getSellerProduct);
  const q = useQuery({ queryKey: ["seller-product", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Edit product"
          description="Loading product details, pricing, stock and media."
          icon={Pencil}
          breadcrumbs={[
            { label: "Seller Studio", to: "/seller" },
            { label: "Products", to: "/seller/products" },
            { label: "Edit" },
          ]}
        />
        <Card>
          <CardContent className="space-y-5 p-6" aria-label="Loading product">
            <Skeleton className="h-8 w-1/3" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-28" />
            <Skeleton className="h-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Edit product"
          description="Update details, pricing, stock and media for this product."
          icon={Pencil}
          breadcrumbs={[
            { label: "Seller Studio", to: "/seller" },
            { label: "Products", to: "/seller/products" },
            { label: "Edit" },
          ]}
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={PackageX}
              title="Product could not be loaded"
              description={(q.error as Error)?.message ?? "Please try again."}
              action={
                <Button variant="outline" className="rounded-full" onClick={() => q.refetch()}>
                  Retry
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!q.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Product not found"
          description="This product may have been deleted or is no longer available to your store."
          icon={PackageX}
          breadcrumbs={[
            { label: "Seller Studio", to: "/seller" },
            { label: "Products", to: "/seller/products" },
            { label: "Not found" },
          ]}
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={PackageX}
              title="Product not found"
              description="Return to your catalogue and choose another product."
              action={
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/seller/products">Back to products</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = q.data as SellerProductDetails;
  const tr = p.translations ?? [];
  const en = tr.find((t) => t.lang === "en");
  const es = tr.find((t) => t.lang === "es");
  const ar = tr.find((t) => t.lang === "ar");
  const images: NonNullable<ProductFormValues["images"]> = (p.images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({ id: image.id, url: image.url, sort_order: image.sort_order }));
  const variants: NonNullable<ProductFormValues["variants"]> = (p.variants ?? []).map(
    (variant) => ({
      id: variant.id,
      format_label: variant.format_label ?? "",
      sku: variant.sku ?? "",
      price_aed: Number(variant.price_aed ?? 0),
      compare_at_price_aed:
        variant.compare_at_price_aed == null ? null : Number(variant.compare_at_price_aed),
      stock: Number(variant.stock ?? 0),
      weight_grams: variant.weight_grams ?? null,
      is_default: !!variant.is_default,
    }),
  );
  const initial: ProductFormValues = {
    id: p.id,
    slug: p.slug,
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
    attrs: p.attrs ?? {},
    images,
    variants,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={en?.name ?? "Edit product"}
        description="Update details, pricing, stock and media for this product."
        icon={Pencil}
        breadcrumbs={[
          { label: "Seller Studio", to: "/seller" },
          { label: "Products", to: "/seller/products" },
          { label: "Edit" },
        ]}
      />
      <div>
        <ProductForm
          initial={initial}
          onSaved={() => undefined}
          onCancel={() => nav({ to: "/seller/products" })}
          onDeleted={() => nav({ to: "/seller/products" })}
        />
      </div>
    </div>
  );
}
