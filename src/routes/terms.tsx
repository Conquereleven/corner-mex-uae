import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Corner Mex" },
      { name: "description", content: "Terms governing the use of Corner Mex marketplace in the UAE." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-AE")}</p>
        <div className="prose prose-neutral mt-8 max-w-none text-foreground">
          <p>By browsing or buying on Corner Mex you agree to the terms below. We may update them periodically; the latest version always lives at this URL.</p>
          <h2>1. The marketplace</h2>
          <p>Corner Mex is an online marketplace connecting verified Mexican producers and importers with buyers across the UAE. Each seller is responsible for the accuracy of their listings and the fulfilment of their orders.</p>
          <h2>2. Orders and payment</h2>
          <p>Prices are in AED and include applicable VAT. Payments are processed by our payment partners. An order is considered confirmed once payment is captured.</p>
          <h2>3. Shipping and returns</h2>
          <p>Delivery windows depend on the seller and shipping zone selected at checkout. Returns are handled per our refunds policy and the seller's stated return window.</p>
          <h2>4. Contact</h2>
          <p>Questions? Email <a href="mailto:hello@cornermex.ae">hello@cornermex.ae</a>.</p>
        </div>
      </section>
    </SiteLayout>
  );
}