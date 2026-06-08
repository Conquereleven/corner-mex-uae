import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "@/components/site/ProductForm";
import { PageHeader } from "@/components/site/PageHeader";
import { PackagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/seller/products/new")({
  head: () => ({ meta: [{ title: "New product" }] }),
  component: NewProduct,
});

function NewProduct() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New product"
        description="Add a product to your catalogue. You can keep editing after publishing."
        icon={PackagePlus}
        breadcrumbs={[
          { label: "Seller Studio", to: "/seller" },
          { label: "Products", to: "/seller/products" },
          { label: "New" },
        ]}
      />
      <div>
        <ProductForm
          onSaved={() => nav({ to: "/seller/products" })}
          onCancel={() => nav({ to: "/seller/products" })}
        />
      </div>
    </div>
  );
}