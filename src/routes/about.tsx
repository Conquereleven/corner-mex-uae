import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Corner Mex" },
      { name: "description", content: "Corner Mex connects trusted Mexican producers with restaurants, hotels and homes across the UAE." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">A Mexican corner in the Emirates.</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Corner Mex is a curated marketplace bringing authentic Mexican pantry — chiles, moles, masa, snacks and drinks — to the UAE's restaurants, hotels, caterings, supermarkets and homes.
        </p>
      </section>
    </SiteLayout>
  );
}