import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

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
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/shop"><Button size="lg" className="rounded-full">Shop the marketplace</Button></Link>
          <Link to="/b2b"><Button size="lg" variant="outline" className="rounded-full">For business</Button></Link>
          <Link to="/sellers"><Button size="lg" variant="ghost" className="rounded-full">Meet the sellers</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}