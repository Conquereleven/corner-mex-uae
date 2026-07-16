import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminCatalogImportVisibility, adminListSellers } from "@/lib/admin.functions";
import { CsvImporter } from "@/components/site/CsvImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products/import")({
  head: () => ({ meta: [{ title: "Admin — Import products" }] }),
  component: AdminImport,
});

function AdminImport() {
  const { t } = useTranslation();
  const fn = useServerFn(adminListSellers);
  const sellers = useQuery({ queryKey: ["admin-sellers"], queryFn: () => fn({}) });
  const visibilityFn = useServerFn(adminCatalogImportVisibility);
  const visibility = useQuery({
    queryKey: ["admin-cornerops-catalog-visibility"],
    queryFn: () => visibilityFn({}),
  });
  const [sellerId, setSellerId] = useState<string>("");
  const selected = (sellers.data ?? []).find((s: any) => s.id === sellerId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{t("dash.import.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dash.import.adminSub")}</p>
      </div>
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            CornerOps catalog foundation <Badge variant="outline">internal only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Validated packages appear here as draft products or explicit review records. Drafts are
            hidden from customers, non-sellable and initialized with inventory zero.
          </p>
          <p>Publication, automatic inventory sync and unrestricted media copy remain disabled.</p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <span className="block text-2xl font-semibold text-foreground">
                {visibility.data?.drafts.length ?? 0}
              </span>
              draft records
            </div>
            <div>
              <span className="block text-2xl font-semibold text-foreground">
                {visibility.data?.reviews.length ?? 0}
              </span>
              review records
            </div>
            <div>
              <span className="block text-2xl font-semibold text-foreground">0</span>commercial
              stock
            </div>
          </div>
          {(visibility.data?.reviews ?? []).slice(0, 8).map((item: any) => (
            <div key={item.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {item.sku || `source row ${item.source_row}`} —{" "}
                {item.name || "Unnamed source record"}
              </span>
              <Badge variant="secondary">{item.classification}</Badge>
            </div>
          ))}
          {visibility.data?.errors?.length ? (
            <p className="text-destructive">
              Catalog visibility is unavailable; no data was fabricated.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("dash.import.seller")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={sellerId} onValueChange={setSellerId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder={t("dash.import.selectSeller")} />
            </SelectTrigger>
            <SelectContent>
              {(sellers.data ?? [])
                .filter((s: any) => s.status === "active")
                .map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.store_name} ({s.contact_email ?? "—"})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {sellerId ? (
        <CsvImporter sellerId={sellerId} sellerLabel={selected?.store_name} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("dash.import.pickFirst")}</p>
      )}
    </div>
  );
}
