import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { businessIdentityLine } from "@/lib/business-identity";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/terms")({
  head: () => {
    const title = "Terms — CornerMex UAE";
    const description =
      "The current terms of using the CornerMex website: catalogue discovery, optional accounts and carts, and manually approved business quotes.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: siteUrl("/terms") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/terms") }],
    };
  },
  component: Terms,
});

function Terms() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Plain-language summary
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Website terms</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>This website is operated in the UAE. {businessIdentityLine()}.</p>
          <p>
            Catalogue descriptions and AED amounts are presented for product discovery. They do not
            confirm live stock, final pricing, taxes, delivery, discounts or availability and are
            not an offer to sell. Final commercial terms are always confirmed in the applicable flow
            before you commit.
          </p>
          <p>
            Creating an account and preparing a B2C cart are available. Order execution, payment
            collection and automated ordering run only when the corresponding authorized
            configuration is enabled; while disabled, no order or payment is processed. A manual
            enquiry does not create a contract. Business transactions require a separate
            human-approved written quote containing the applicable commercial terms.
          </p>
          <p>
            The full terms template is maintained in the{" "}
            <Link to="/legal" className="underline underline-offset-4">
              legal centre
            </Link>{" "}
            and is finalised with qualified UAE legal review before commercial activation.
          </p>
          <p>
            Questions:{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.legal)}>
              {PUBLIC_CONTACT.legal}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/terms" />
        </div>
      </section>
    </SiteLayout>
  );
}
