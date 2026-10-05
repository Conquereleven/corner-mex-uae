import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { Button } from "@/components/ui/button";
import { marketIdentityLine } from "@/lib/business-identity";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/about")({
  head: () => {
    const title = "Acerca de CornerMex — despensa mexicana por pieza y por mayoreo";
    const description =
      "CornerMex es una tienda de despensa mexicana para el hogar y el negocio: compra en línea por pieza y cotizaciones por volumen revisadas por una persona.";
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
    title: "Productos mexicanos, bien surtidos",
    body: "Un catálogo de básicos de la despensa mexicana —salsas, chiles, sazonadores, botanas y más— elegido para quien sabe a qué sabe lo auténtico.",
  },
  {
    icon: MapPin,
    title: "Hecho para México",
    body: "Precios en pesos mexicanos y envíos cotizados para tu código postal antes de que confirmes tu pedido.",
  },
  {
    icon: ShoppingBag,
    title: "Menudeo, a tu ritmo",
    body: "Explora el catálogo y arma tu carrito cuando quieras, sin crear una cuenta. Cada precio y cada opción de envío se confirman antes de que nada sea definitivo.",
  },
  {
    icon: Building2,
    title: "Mayoreo, por escrito",
    body: "Restaurantes, tiendas y distribuidores pueden solicitar una cotización. Cada solicitud la revisa una persona y se responde con condiciones comerciales por escrito.",
  },
];

function About() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Acerca de CornerMex
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl tracking-tight sm:text-6xl">
          Tu tienda mexicana de la esquina.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          CornerMex reúne un catálogo de despensa mexicana para el hogar con un servicio de
          cotización para negocios revisado por personas. Compras en línea por pieza; para compras
          por volumen, la disponibilidad, el precio, la entrega y las condiciones se confirman por
          escrito antes de cualquier compromiso.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/shop">
            <Button size="lg" className="rounded-full">
              Ver el catálogo
            </Button>
          </Link>
          <Link to="/b2b">
            <Button size="lg" variant="outline" className="rounded-full">
              Para negocios
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
            Cómo trabajamos
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            En CornerMex preferimos la claridad. Los precios del catálogo se muestran en pesos
            mexicanos; el precio final, la disponibilidad y el envío se confirman siempre antes de
            que te comprometas. Las cotizaciones para negocio las aprueba una persona, por escrito.
            Cuando una política o una función aún no está lista, lo decimos en lugar de prometer de
            más.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Si tienes dudas, la{" "}
            <Link to="/contact" className="underline underline-offset-4">
              página de contacto
            </Link>{" "}
            indica a dónde escribir para atención a clientes, mayoreo y temas de privacidad o
            legales.
          </p>
        </section>

        <div className="mt-16 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          {marketIdentityLine()}
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/about" />
        </div>
      </section>
    </SiteLayout>
  );
}
