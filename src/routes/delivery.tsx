import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, PackageCheck, Scale } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup, TrustCard } from "@/components/site/Trust";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/delivery")({
  head: () => {
    const title = "Delivery in the UAE — CornerMex";
    const description =
      "How CornerMex handles delivery across the United Arab Emirates: emirate-based coverage, transparent charges confirmed before you commit, and no hidden promises.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl("/delivery") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/delivery") }],
    };
  },
  component: Delivery,
});

const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

function Delivery() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Transparent by design
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Delivery in the UAE</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          CornerMex is built for the United Arab Emirates. Delivery is organised by emirate, and any
          charge or timeframe that applies to you is intended to be confirmed in your specific flow
          — at checkout for retail, or in a written quote for business orders — before you commit to
          anything.
        </p>

        <div
          role="note"
          className="mt-8 max-w-3xl rounded-2xl border border-border bg-secondary/40 p-6 leading-7"
        >
          <p className="font-medium text-foreground">
            Online order and delivery execution are not currently enabled on this website.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            No delivery can be booked or dispatched through this site today, and no delivery area,
            charge or timeframe shown anywhere on this site should be treated as confirmed. This
            page describes how delivery is intended to work once ordering is activated. Business
            enquiries continue to be handled manually in writing.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <TrustCard icon={MapPin} title="Emirate-based coverage" headingLevel={2}>
            Delivery is organised around the seven emirates. Whether a specific destination can be
            served is confirmed for that order rather than promised in advance here.
          </TrustCard>
          <TrustCard icon={Scale} title="Charges shown before you commit" headingLevel={2}>
            Any delivery charge that applies is intended to be shown in your checkout or written
            quote before you commit, so you can decide with the amount in front of you.
          </TrustCard>
          <TrustCard icon={PackageCheck} title="No silent promises" headingLevel={2}>
            We do not advertise delivery times, waived-charge thresholds or express service unless
            they are confirmed for your order.
          </TrustCard>
        </div>

        <section className="mt-14 max-w-3xl" aria-labelledby="delivery-emirates">
          <h2 id="delivery-emirates" className="font-display text-3xl tracking-tight">
            The seven emirates
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Destinations are recorded at emirate level:
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {EMIRATES.map((name) => (
              <li
                key={name}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Listing an emirate here is not a guarantee of service. Coverage, charges and timing for
            a specific address are confirmed in the checkout or quote flow for that order. Delivery
            and payment options can differ between emirates and order types, and the options that
            actually apply are the ones presented in your own flow.
          </p>
        </section>

        <section className="mt-14 max-w-3xl" aria-labelledby="delivery-how">
          <h2 id="delivery-how" className="font-display text-3xl tracking-tight">
            How it works
          </h2>
          <ol className="mt-5 space-y-4 text-base leading-7 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Prepare your cart or quote.</span>{" "}
              Browse the{" "}
              <Link to="/shop" className="underline underline-offset-4">
                catalogue
              </Link>{" "}
              for retail, or the{" "}
              <Link to="/b2b" className="underline underline-offset-4">
                B2B section
              </Link>{" "}
              for wholesale.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Provide your destination.</span> Your
              emirate determines what delivery options apply.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Review before committing.</span> The
              applicable delivery arrangement and charge are intended to be presented in that flow,
              and nothing is final until you see and accept it. While ordering is disabled, this
              step is not available on the website.
            </li>
          </ol>
        </section>

        <div className="mt-14 max-w-3xl rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          Delivery questions for a business order can be sent to{" "}
          <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.b2b)}>
            {PUBLIC_CONTACT.b2b}
          </a>
          . Sending a question does not create an order.
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/delivery" />
        </div>
      </section>
    </SiteLayout>
  );
}
