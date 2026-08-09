import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { Button } from "@/components/ui/button";
import { businessIdentityLine } from "@/lib/business-identity";
import i18n from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/about")({
  head: () => {
    const t = i18n.getFixedT(i18n.language || "en", "t");
    const title = t("pages.about.meta.title");
    const description = t("pages.about.meta.description");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl("/about") },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: siteUrl("/about") }],
    };
  },
  component: About,
});

const PILLARS = [
  {
    icon: UtensilsCrossed,
    title: "Mexican products, properly sourced",
    body: "A curated catalogue of Mexican pantry staples — salsas, chiles, tortillas, seasonings and more — selected for people who know what the real thing tastes like.",
  },
  {
    icon: MapPin,
    title: "Built for the UAE",
    body: "Prices in AED, delivery organised around the seven emirates, and policies written for the UAE market rather than copied from somewhere else.",
  },
  {
    icon: ShoppingBag,
    title: "Retail, at your pace",
    body: "Browse the catalogue and prepare a cart whenever you like. Every price and delivery detail is confirmed transparently in the checkout flow before anything is final.",
  },
  {
    icon: Building2,
    title: "Wholesale, done in writing",
    body: "Restaurants, retailers and distributors can request a quote. Each request is reviewed by a person and answered with written commercial terms — no automated commitments.",
  },
];

function About() {
  const { t } = useTranslation();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          About CornerMex
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl tracking-tight sm:text-6xl">
          {t("pages.about.title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          {t("pages.about.lede")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/shop">
            <Button size="lg" className="rounded-full">
              {t("pages.about.ctaShop")}
            </Button>
          </Link>
          <Link to="/b2b">
            <Button size="lg" variant="outline" className="rounded-full">
              {t("pages.about.ctaB2B")}
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl border border-border bg-card p-6">
              <pillar.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl tracking-tight">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>

        <section className="mt-20 max-w-3xl" aria-labelledby="about-how-we-work">
          <h2 id="about-how-we-work" className="font-display text-3xl tracking-tight">
            How we work
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            CornerMex favours clarity over hype. Catalogue prices are shown in AED for discovery;
            final pricing, availability and delivery are always confirmed in the relevant flow
            before you commit. Business quotes are approved by a person, in writing. Where a policy
            or capability is still being finalised, we say so instead of overpromising.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Questions are welcome — the{" "}
            <Link to="/contact" className="underline underline-offset-4">
              contact page
            </Link>{" "}
            lists the right route for customer support, wholesale and privacy or legal matters.
          </p>
        </section>

        <div className="mt-16 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          {businessIdentityLine()}
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            More information
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/about" />
        </div>
      </section>
    </SiteLayout>
  );
}
