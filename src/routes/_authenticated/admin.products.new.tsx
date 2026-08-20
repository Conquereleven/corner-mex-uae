import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminProductEditor } from "@/components/site/AdminProductEditor";
import { adminListProductCategoriesCanonical } from "@/lib/admin-products.functions";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  head: () => ({ meta: [{ title: "Admin — New product" }] }),
  component: AdminNewProduct,
});

function AdminNewProduct() {
  const listCategories = useServerFn(adminListProductCategoriesCanonical);
  const categories = useQuery({
    queryKey: ["admin-product-categories-canonical"],
    queryFn: () => listCategories({}),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a CornerMex product directly. New products start as drafts until variants and pricing are ready.
        </p>
      </div>
      {categories.isLoading ? <p className="text-sm text-muted-foreground">Loading categories…</p> : null}
      {categories.isError ? <p className="text-sm text-destructive">Categories could not be loaded.</p> : null}
      {!categories.isLoading && !categories.isError ? (
        <AdminProductEditor categories={categories.data ?? []} />
      ) : null}
    </div>
  );
}
