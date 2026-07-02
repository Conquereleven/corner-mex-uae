import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Corner Mex" },
      { name: "description", content: "Legacy Terms summary — see /legal for the current CornerMex first-party e-commerce terms." },
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
          <p>
            This is a legacy summary. The current, versioned Terms &amp; Conditions live in the{" "}
            <a href="/legal/terms-and-conditions">Legal Center</a>.
          </p>
          <h2>1. Who you are buying from</h2>
          <p>CornerMex is a first-party e-commerce retailer. CornerMex is the seller of record for all orders placed on this site and sources its products from suppliers (e.g. Intermex) for direct resale.</p>
          <h2>2. Orders and payment</h2>
          <p>Prices are in AED. Applicable VAT is shown at checkout. Payments are processed by our payment partners. An order is confirmed once payment is captured.</p>
          <h2>3. Shipping and returns</h2>
          <p>Delivery windows depend on the shipping zone selected at checkout. Returns are handled by CornerMex per our Returns &amp; Refunds Policy.</p>
          <h2>4. Future marketplace</h2>
          <p>Third-party seller / marketplace features are planned for a future phase and are not active in the current MVP.</p>
          <h2>5. Contact</h2>
          <p>Questions? Email <a href="mailto:hello@cornermex.ae">hello@cornermex.ae</a>.</p>
        </div>
      </section>
    </SiteLayout>
  );
}