import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/returns")({
  head: () => {
    const title = "Returns & refunds — CornerMex UAE";
    const description =
      "How returns and refunds work at CornerMex today, and how the applicable terms are confirmed before any order is accepted.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: siteUrl("/returns") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/returns") }],
    };
  },
  component: Returns,
});

function Returns() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Honest by default
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Returns &amp; refunds</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>
            Order execution is not currently enabled on this website, so no website purchase — and
            therefore no website return — is being processed today. We would rather tell you that
            plainly than display a policy that is not yet in operation.
          </p>
          <p>
            When ordering is activated, the applicable cancellation, return and refund terms will be
            presented before you place an order. For business orders, those terms are stated in the
            written quote before acceptance. Statutory rights under applicable UAE law are not
            limited by this page.
          </p>
          <p>
            The structured returns policy template is maintained in the{" "}
            <Link to="/legal" className="underline underline-offset-4">
              legal centre
            </Link>{" "}
            and is finalised with UAE legal review before commercial activation.
          </p>
          <p>
            For a concern about a direct communication from CornerMex, contact{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.complaints)}>
              {PUBLIC_CONTACT.complaints}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/returns" />
        </div>
      </section>
    </SiteLayout>
  );
}
