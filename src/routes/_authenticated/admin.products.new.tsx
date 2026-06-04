import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListSellers } from "@/lib/admin.functions";
import { ProductForm } from "@/components/site/ProductForm";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  head: () => ({ meta: [{ title: "Admin — New product" }] }),
  component: AdminNewProduct,
});

function AdminNewProduct() {
  const nav = useNavigate();
  const fn = useServerFn(adminListSellers);
  const sellers = useQuery({ queryKey: ["admin-sellers"], queryFn: () => fn({}) });
  const [sellerId, setSellerId] = useState<string>("");
  const active = (sellers.data ?? []).filter((s: any) => s.status === "active");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create a product on behalf of any active seller.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Seller</CardTitle></CardHeader>
        <CardContent>
          <Select value={sellerId} onValueChange={setSellerId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose a seller…" /></SelectTrigger>
            <SelectContent>
              {active.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.store_name} ({s.contact_email ?? "—"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {sellerId ? (
        <ProductForm adminSellerId={sellerId} onSaved={() => nav({ to: "/admin/sellers" })} />
      ) : (
        <p className="text-sm text-muted-foreground">Pick a seller to start adding a product.</p>
      )}
    </div>
  );
}