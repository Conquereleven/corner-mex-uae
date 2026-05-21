import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Corner Mex" }] }),
  component: Cart,
});

function Cart() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8 text-center">
        <h1 className="font-display text-4xl tracking-tight">Your cart is empty</h1>
        <p className="mt-4 text-muted-foreground">Start browsing the catalogue to add Mexican goods.</p>
      </section>
    </SiteLayout>
  );
}