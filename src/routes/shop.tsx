import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Corner Mex" },
      { name: "description", content: "Browse Mexican chiles, salsas, masa, snacks and pantry staples — delivered across the UAE." },
    ],
  }),
  component: Shop,
});

function Shop() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">Shop</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          The catalogue is loading. Sellers are uploading products — full filters, search and product pages land in the next phase.
        </p>
      </section>
    </SiteLayout>
  );
}