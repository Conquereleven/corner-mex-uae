import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { ACTIVE_MARKET } from "@/config/market";
import { marketIdentityLine, marketSellerLine } from "@/lib/business-identity";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/terms")({
  head: () => {
    const title = "Términos — CornerMex";
    const description =
      "Cómo funciona hoy el sitio de CornerMex: catálogo, carrito, compra en línea y cotizaciones para negocio aprobadas por una persona.";
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
  // Shown only once the Mexico seller entity has been supplied; never guessed.
  const seller = marketSellerLine();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Resumen en lenguaje claro
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Términos del sitio</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          <p>
            Este sitio opera en {ACTIVE_MARKET.countryNameLocal}. {marketIdentityLine()}.
          </p>
          {seller && <p>{seller}.</p>}
          <p>
            Los precios se muestran en pesos mexicanos ({ACTIVE_MARKET.currency}). El importe que
            pagas —tus productos y el envío a tu código postal— lo calcula nuestro servidor y lo ves
            antes de confirmar tu pedido.
          </p>
          {ONLINE_ORDERING_ENABLED ? (
            <p>
              Puedes comprar como invitado o con una cuenta. No se registra ningún pedido hasta que
              lo confirmas. Una solicitud de cotización no crea un contrato: las operaciones de
              negocio requieren una cotización por escrito, aprobada por una persona, con sus
              condiciones comerciales.
            </p>
          ) : (
            <p>
              Por el momento no estamos recibiendo pedidos en línea. Las descripciones y los
              importes del catálogo sirven para conocer los productos; no confirman existencias,
              precio final ni envío, y no constituyen una oferta de venta. Una solicitud de
              cotización no crea un contrato.
            </p>
          )}
          <p>
            Los Términos y condiciones completos para {ACTIVE_MARKET.countryNameLocal} se publicarán
            en el{" "}
            <Link to="/legal" className="underline underline-offset-4">
              centro legal
            </Link>{" "}
            antes de abrir la venta al público.
          </p>
          <p>
            Dudas:{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.legal)}>
              {PUBLIC_CONTACT.legal}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/terms" />
        </div>
      </section>
    </SiteLayout>
  );
}
