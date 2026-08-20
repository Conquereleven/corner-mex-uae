import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { AdminProductEditor } from "@/components/site/AdminProductEditor";
import { adminGetProductCanonical } from "@/lib/admin-products.functions";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  head: () => ({ meta: [{ title: "Admin — Edit product" }] }),
  component: AdminEditProduct,
});

function AdminEditProduct() {
  const { id } = Route.useParams();
  const getProduct = useServerFn(adminGetProductCanonical);
  const query = useQuery({
    queryKey: ["admin-product-canonical", id],
    queryFn: () => getProduct({ data: { id } }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Edit product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product metadata, translations, variants, canonical inventory and images.
        </p>
      </div>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Loading product…</p> : null}
      {query.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Product could not be loaded.</p>
          <Button size="sm" variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {query.data ? (
        <AdminProductEditor
          product={query.data.product as Parameters<typeof AdminProductEditor>[0]["product"]}
          translations={
            query.data.translations as Parameters<typeof AdminProductEditor>[0]["translations"]
          }
          variants={query.data.variants as Parameters<typeof AdminProductEditor>[0]["variants"]}
          images={query.data.images as Parameters<typeof AdminProductEditor>[0]["images"]}
          categories={
            query.data.categories as Parameters<typeof AdminProductEditor>[0]["categories"]
          }
        />
      ) : null}
    </div>
  );
}
