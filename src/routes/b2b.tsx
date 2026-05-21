import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/b2b")({
  head: () => ({
    meta: [
      { title: "For Business — Corner Mex" },
      { name: "description", content: "Wholesale Mexican supply for UAE restaurants, hotels, caterings and supermarkets." },
    ],
  }),
  component: B2B,
});

function B2B() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">For business</span>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Wholesale Mexican supply for the UAE.</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Open a verified business account to access wholesale pricing, custom catalogues, monthly invoicing and dedicated account managers across all 7 Emirates.
        </p>
        <div className="mt-8">
          <Button size="lg" className="rounded-full">Request access</Button>
        </div>
      </section>
    </SiteLayout>
  );
}