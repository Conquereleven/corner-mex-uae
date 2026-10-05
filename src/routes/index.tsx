import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/SiteLayout";
import { siteUrl } from "@/lib/site-url";
import { ACTIVE_BRAND } from "@/config/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CornerMex — Despensa mexicana por pieza y por mayoreo" },
      {
        name: "description",
        content:
          "Chiles, salsas, masa y botanas mexicanas. Compra en línea sin crear una cuenta, con envío cotizado a tu código postal, o solicita una cotización para tu negocio.",
      },
      { property: "og:title", content: "CornerMex — Despensa mexicana por pieza y por mayoreo" },
      {
        property: "og:description",
        content:
          "Despensa mexicana por pieza y cotizaciones para negocio revisadas por una persona.",
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
            CornerMex · Despensa mexicana
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-7xl">
            {ACTIVE_BRAND.verbal.primary}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Chiles, salsas, masa y botanas de siempre. Compra por pieza para tu casa o por caja para
            tu negocio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop">
              <Button size="lg" className="group rounded-full">
                Ver el catálogo
                <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/b2b">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-foreground/25 hover:bg-accent"
              >
                Ventas por mayoreo
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
    ["salsas-moles", "Salsas y moles"],
    ["snacks-sweets", "Botanas y dulces"],
    ["pantry-staples", "Despensa"],
    ["chiles-spices", "Chiles y especias"],
    ["tortillas-masa", "Tortillas y masa"],
    ["drinks", "Bebidas"],
    ["gifts-lifestyle", "Regalos"],
  ] as const;
  return (
    <section className="border-y border-border bg-sand">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eyebrow">
              Compra por categoría
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              Encuentra tus favoritos
            </h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex items-center gap-1"
          >
            Ver todo <ArrowRight className="h-3.5 w-3.5" />
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
          <h2 className="mt-6 font-display text-3xl tracking-tight text-foreground">Ofertas</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Descubre favoritos a precio especial y básicos de despensa del catálogo CornerMex.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-eyebrow"
          >
            Ver ofertas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-ink p-7 text-ivory">
          <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-6 font-display text-3xl tracking-tight">Encuéntranos</h2>
          <p className="mt-3 text-sm leading-6 text-ivory/85">
            Atendemos a hogares, restaurantes, tiendas y distribuidores.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ivory underline-offset-4 hover:underline"
          >
            Contáctanos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="rounded-3xl border border-border bg-arena p-7 text-ink">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70">
            Nuestro compromiso
          </p>
          <h2 className="mt-6 font-display text-3xl tracking-tight">
            {ACTIVE_BRAND.verbal.secondary}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/80">
            Productos mexicanos de verdad, con precios y entregas claros.
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
              Para restaurantes, tiendas y distribuidores
            </span>
            <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
              Surte tu negocio con CornerMex.
            </h2>
          </div>
          <div>
            <p className="text-base leading-relaxed text-ivory/85">
              Cuéntanos qué necesitas y nuestro equipo revisará por escrito disponibilidad,
              volúmenes y entrega.
            </p>
            <Link to="/b2b" className="mt-6 inline-block">
              <Button size="lg" className="rounded-full">
                Ventas a negocios <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
