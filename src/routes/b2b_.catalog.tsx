import { createFileRoute } from "@tanstack/react-router";
import { B2bCatalogHero } from "@/components/b2b/B2bCatalogHero";
import { B2bCategoryNav } from "@/components/b2b/B2bCategoryNav";
import { B2bProductGrid } from "@/components/b2b/B2bProductGrid";
import { B2bQuoteBar } from "@/components/b2b/B2bQuoteBar";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useQuoteSelection } from "@/features/b2b-catalog/use-quote-selection";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/b2b_/catalog")({
  head: () => ({
    meta: [
      { title: "B2B catalogue — Intermex UAE" },
      {
        name: "description",
        content:
          "Build a product shortlist for a human-reviewed Intermex business quotation in the UAE.",
      },
    ],
    links: [{ rel: "canonical", href: siteUrl("/b2b/catalog") }],
  }),
  component: B2bCatalogRoute,
});

function B2bCatalogRoute() {
  const { selectedProductIds, toggleProduct } = useQuoteSelection();
  return (
    <SiteLayout>
      <div className="pb-48 md:pb-32">
        <B2bCatalogHero selectedCount={selectedProductIds.length} />
        <B2bCategoryNav />
        <B2bProductGrid selectedProductIds={selectedProductIds} onToggle={toggleProduct} />
      </div>
      <B2bQuoteBar selectedCount={selectedProductIds.length} />
    </SiteLayout>
  );
}
