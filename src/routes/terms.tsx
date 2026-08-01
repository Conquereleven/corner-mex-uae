import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms — Corner Mex commercial preview" }] }),
  component: Terms,
});

function Terms() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Preview terms</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>
            This website is a non-transactional commercial preview operated by RodMor TradeCo LLC
            under the CornerMex brand in the UAE.
          </p>
          <p>
            Catalogue descriptions and AED amounts are presented for product discovery. They do not
            confirm live stock, final pricing, taxes, delivery, discounts or availability and are
            not an offer to sell.
          </p>
          <p>
            Checkout, payment, account creation, marketplace participation and automated ordering
            are disabled. A manual enquiry does not create a contract. Any future transaction
            requires a separate human-approved written quote containing the applicable commercial
            terms.
          </p>
          <p>
            Questions:{" "}
            <a className="underline" href="mailto:legal@cornermex.ae">
              legal@cornermex.ae
            </a>
            .
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
