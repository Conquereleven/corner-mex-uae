import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Ordering unavailable — Corner Mex commercial preview" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartUnavailable,
});

function CartUnavailable() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Online ordering is not active</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Cart, checkout, payment and live inventory are disabled. Catalogue items and AED amounts
          are for discovery and must be confirmed in a manual written quote.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/shop">
            <Button className="rounded-full">Browse catalogue</Button>
          </Link>
          <Link to="/b2b">
            <Button variant="outline" className="rounded-full">
              Business enquiry
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
