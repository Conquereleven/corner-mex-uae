import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CsvImporter } from "@/components/site/CsvImporter";

export const Route = createFileRoute("/_authenticated/seller/products/import")({
  head: () => ({ meta: [{ title: "Import products" }] }),
  component: SellerImport,
});

function SellerImport() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl space-y-2">
      <h1 className="font-display text-3xl tracking-tight">{t("dash.import.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("dash.import.sub")}</p>
      <div className="mt-6"><CsvImporter /></div>
    </div>
  );
}