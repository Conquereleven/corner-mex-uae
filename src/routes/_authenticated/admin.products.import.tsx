import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListSellers } from "@/lib/admin.functions";
import { CsvImporter } from "@/components/site/CsvImporter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products/import")({
  head: () => ({ meta: [{ title: "Admin — Import products" }] }),
  component: AdminImport,
});

function AdminImport() {
  const { t } = useTranslation();
  const fn = useServerFn(adminListSellers);
  const sellers = useQuery({ queryKey: ["admin-sellers"], queryFn: () => fn({}) });
  const [sellerId, setSellerId] = useState<string>("");
  const selected = (sellers.data ?? []).find((s: any) => s.id === sellerId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{t("dash.import.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dash.import.adminSub")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("dash.import.seller")}</CardTitle></CardHeader>
        <CardContent>
          <Select value={sellerId} onValueChange={setSellerId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder={t("dash.import.selectSeller")} /></SelectTrigger>
            <SelectContent>
              {(sellers.data ?? []).filter((s: any) => s.status === "active").map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.store_name} ({s.contact_email ?? "—"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {sellerId ? <CsvImporter sellerId={sellerId} sellerLabel={selected?.store_name} /> : (
        <p className="text-sm text-muted-foreground">{t("dash.import.pickFirst")}</p>
      )}
    </div>
  );
}