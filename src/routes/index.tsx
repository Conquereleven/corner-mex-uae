import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Flame, Leaf, Wheat, Cookie, CupSoda, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PromoBanners } from "@/components/site/PromoBanners";
import heroChiles from "@/assets/hero-chiles.jpg";
import featureSalsa from "@/assets/feature-salsa.jpg";
import b2bKitchen from "@/assets/b2b-kitchen.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Corner Mex — Authentic Mexican supply across the UAE" },
      { name: "description", content: "A curated range of Mexican chiles, salsas, masa and snacks for households, restaurants, hotels, caterers and supermarkets across the United Arab Emirates — sold directly by CornerMex." },
      { property: "og:title", content: "Corner Mex — Mexican pantry, delivered across the Emirates" },
      { property: "og:description", content: "Wholesale and retail Mexican products, sold directly by CornerMex across the UAE." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <SiteLayout>
      <Hero />
      <PromoBanners />
      <Categories />
      <Features />
      <B2BBlock />
    </SiteLayout>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:pb-28 md:pt-20 lg:px-8">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t("hero.eyebrow")}
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            {t("hero.title")} <span className="italic text-primary">{t("hero.titleAccent")}</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("hero.sub")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop">
              <Button size="lg" className="group rounded-full bg-foreground text-background hover:bg-foreground/90">
                {t("hero.ctaShop")}
                <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/b2b">
              <Button size="lg" variant="outline" className="rounded-full border-foreground/20">
                {t("hero.ctaB2B")}
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-transparent to-accent/10 blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-border shadow-2xl shadow-primary/10">
            <img
              src={heroChiles}
              alt="Curated dried Mexican chiles delivered across the UAE"
              width={960}
              height={1200}
              decoding="async"
              fetchPriority="high"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -start-6 hidden rounded-2xl border border-border bg-background/95 px-5 py-4 shadow-xl backdrop-blur sm:block">
            <div className="font-display text-3xl font-semibold text-foreground">120+</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">SKUs</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const { t } = useTranslation();
  const items = [
    { key: "chiles", icon: Flame },
    { key: "salsas", icon: Leaf },
    { key: "masa", icon: Wheat },
    { key: "snacks", icon: Cookie },
    { key: "drinks", icon: CupSoda },
    { key: "pantry", icon: Package },
  ] as const;
  return (
    <section className="border-y border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">{t("categories.title")}</h2>
          <Link to="/shop" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map(({ key, icon: Icon }) => (
            <Link
              key={key}
              to="/shop"
              className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(`categories.${key}`)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useTranslation();
  const feats = ["a", "b", "c"] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div className="overflow-hidden rounded-[2rem] border border-border">
          <img
            src={featureSalsa}
            alt="Selection of authentic Mexican salsas"
            width={1200}
            height={900}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl md:text-5xl">{t("features.title")}</h2>
          <div className="mt-8 space-y-6">
            {feats.map((k) => (
              <div key={k} className="border-t border-border pt-6">
                <h3 className="text-base font-semibold text-foreground">{t(`features.${k}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`features.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function B2BBlock() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-foreground text-background">
        <img
          src={b2bKitchen}
          alt=""
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative grid gap-8 p-10 md:grid-cols-2 md:items-center md:p-16">
          <div>
            <span className="text-[11px] uppercase tracking-[0.18em] text-background/70">{t("b2b.eyebrow")}</span>
            <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{t("b2b.title")}</h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-background/80">{t("b2b.body")}</p>
            <Link to="/b2b" className="mt-6 inline-block">
              <Button size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90">
                {t("b2b.cta")} <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
