import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/site/ProductForm";

export const Route = createFileRoute("/_authenticated/seller/products/new")({
  head: () => ({ meta: [{ title: "New product" }] }),
  component: NewProduct,
});

function NewProduct() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight">New product</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add a product to your catalogue. You can edit it any time.</p>
      <div className="mt-8">
        <ProductForm onSaved={() => nav({ to: "/seller/products" })} />
      </div>
    </div>
  );
}