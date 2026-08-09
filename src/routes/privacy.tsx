import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const title = "Privacy — CornerMex UAE";
    const description =
      "What the CornerMex website currently processes: browsing, optional accounts, local cart storage, cookie preferences and manual email enquiries.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: siteUrl("/privacy") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/privacy") }],
    };
  },
  component: Privacy,
});

function Privacy() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Plain-language summary
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Privacy</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This page describes what the CornerMex website actually does today. The detailed policy
          template is maintained in the{" "}
          <Link to="/legal" className="underline underline-offset-4">
            legal centre
          </Link>{" "}
          and is completed as the corresponding capability is activated.
        </p>
        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <section aria-labelledby="privacy-browsing">
            <h2 id="privacy-browsing" className="font-display text-2xl text-foreground">
              Browsing
            </h2>
            <p className="mt-2">
              The public catalogue can be browsed without creating an account. Essential technical
              information needed for security, reliability and your language, currency and cookie
              preferences may be processed. Non-essential cookies remain subject to your{" "}
              <button
                type="button"
                onClick={openCookiePreferences}
                className="underline underline-offset-4 hover:text-foreground"
              >
                cookie preferences
              </button>
              .
            </p>
          </section>
          <section aria-labelledby="privacy-accounts">
            <h2 id="privacy-accounts" className="font-display text-2xl text-foreground">
              Accounts and carts
            </h2>
            <p className="mt-2">
              Creating an account is optional and uses authenticated sign-in; account details are
              used to operate the account itself. A B2C cart is stored in your own browser until you
              proceed to checkout. Order execution and payment collection run only when the
              corresponding authorized configuration is enabled — while disabled, no order, payment
              or fulfilment processing occurs.
            </p>
          </section>
          <section aria-labelledby="privacy-enquiries">
            <h2 id="privacy-enquiries" className="font-display text-2xl text-foreground">
              Manual enquiries
            </h2>
            <p className="mt-2">
              If you email CornerMex, the information you choose to provide is used to review and
              respond to that enquiry. It is not treated as an order or account registration, and it
              does not enter any automated marketing process.
            </p>
          </section>
          <p>
            Privacy requests:{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.privacy)}>
              {PUBLIC_CONTACT.privacy}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/privacy" />
        </div>
      </section>
    </SiteLayout>
  );
}
