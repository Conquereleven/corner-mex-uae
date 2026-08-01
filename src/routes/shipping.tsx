import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export const Route = createFileRoute("/shipping")({
  head: () => ({ meta: [{ title: "Shipping — Corner Mex commercial preview" }] }),
  component: Shipping,
});

function Shipping() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Commercial preview
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Shipping</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>
            Online ordering and shipping are not active in this preview. No delivery area, fee or
            timeframe displayed elsewhere should be treated as confirmed.
          </p>
          <p>
            For a business enquiry, CornerMex will confirm product availability, destination,
            handling requirements, delivery options and any charges in a manual written quote before
            you decide whether to proceed.
          </p>
          <p>
            Questions may be sent to{" "}
            <a className="underline" href={mailto(PUBLIC_CONTACT.b2b)}>
              {PUBLIC_CONTACT.b2b}
            </a>
            . Sending an enquiry does not create an order.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
