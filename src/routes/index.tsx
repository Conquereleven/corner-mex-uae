import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/SiteLayout";
import { siteUrl } from "@/lib/site-url";
import { ACTIVE_BRAND } from "@/config/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CornerMex — Mexican food for the Middle East" },
      {
        name: "description",
        content:
          "Explore the CornerMex Mexican pantry catalogue for the UAE. Signed-in customers can place cash-on-delivery orders; business quotes are reviewed manually.",
      },
      { property: "og:title", content: "CornerMex — Mexican food for the Middle East" },
      {
        property: "og:description",
        content: "Mexican catalogue discovery and human-reviewed B2B quote enquiries for the UAE.",
      },
      { property: "og:url", content: siteUrl("/") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/") }],
  }),
  component: Index,
});

function Index() {
  return (
    <SiteLayout>
      <Hero />
      <Categories />
      <Features />
      <B2BBlock />
    </SiteLayout>
  );
}

// Legacy CM-COM-1B source sentinel: UAE commercial preview.

function Hero() {
  return (
    <section className="intermex-hero relative overflow-hidden">
      <img
        src={ACTIVE_BRAND.assets.hero.src}
        alt={ACTIVE_BRAND.assets.hero.alt}
        width={3000}
        height={1003}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-ink/35" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[27rem] max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl rounded-[1.5rem] border border-border bg-card/95 px-6 py-10 text-center shadow-[0_18px_50px_color-mix(in_oklch,var(--cm-palette-black)_28%,transparent)] backdrop-blur-sm sm:px-14 sm:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-eyebrow">
            CornerMex · Authentic Mexican pantry in the UAE
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-7xl">
            {ACTIVE_BRAND.verbal.primary}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            We bring traditional Mexican products to the Middle East for everyone looking to
            experience authentic Mexican culture.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop">
              <Button size="lg" className="group rounded-full">
                Browse the catalogue
                <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/b2b">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-foreground/25 hover:bg-accent"
              >
                Wholesale enquiries
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  // Real canonical category slugs (public.categories), so every tile lands on a
  // populated category. Images come from ACTIVE_BRAND.assets.collections.
  const items = [
    ["salsas-moles", "Salsas & Moles"],
    ["snacks-sweets", "Snacks & Sweets"],
    ["pantry-staples", "Pantry Staples"],
    ["chiles-spices", "Chiles & Spices"],
    ["tortillas-masa", "Tortillas & Masa"],
    ["drinks", "Drinks"],
    ["gifts-lifestyle", "Gifts & Lifestyle"],
  ] as const;
  return (
    <section className="border-y border-border bg-sand">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eyebrow">
              Shop by collection
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              Find your favourites
            </h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {items.map(([slug, label]) => (
            <Link
              key={slug}
              to="/shop"
              search={{ category: slug, sort: "newest" }}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
            >
              <img
                src={ACTIVE_BRAND.assets.collections[slug].src}
                alt=""
                width={750}
                height={750}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
              <span className="block px-3 py-3 text-sm font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-8 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-sand p-7">
          <ShoppingBag className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-6 font-display text-3xl tracking-tight text-foreground">
            Special Offers
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Discover limited-price favourites and pantry essentials from the CornerMex catalogue.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-eyebrow"
          >
            Shop offers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-ink p-7 text-ivory">
          <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-6 font-display text-3xl tracking-tight">Find Us</h2>
          <p className="mt-3 text-sm leading-6 text-ivory/85">
            Serving Mexican food lovers, restaurants and retailers across the UAE.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ivory underline-offset-4 hover:underline"
          >
            Contact the team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-arena p-7 text-ink">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
            Our promise
          </p>
          <h2 className="mt-6 font-display text-3xl tracking-tight">
            {ACTIVE_BRAND.verbal.secondary}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/80">
            Authentic Mexican products, thoughtfully brought to the Middle East.
          </p>
        </div>
      </div>
    </section>
  );
}

function B2BBlock() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-border bg-ink p-10 text-ivory md:p-16">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-[11px] uppercase tracking-[0.18em] text-ivory/70">
              For restaurants, retailers &amp; distributors
            </span>
            <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
              Bring CornerMex to your table.
            </h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-ivory/85">
              Tell us what you need and our team will review availability, volumes and delivery in
              writing.
            </p>
            <Link to="/b2b" className="mt-6 inline-block">
              <Button size="lg" className="rounded-full">
                Business enquiries <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
