import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { ACTIVE_MARKET } from "@/config/market";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";

export const Route = createFileRoute("/returns")({
  head: () => {
    const title = "Devoluciones y reembolsos — CornerMex";
    const description =
      "Cómo solicitar una devolución o un reembolso en CornerMex y cómo se confirman las condiciones antes de aceptar un pedido.";
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Sin letras chiquitas
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Devoluciones y reembolsos</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-muted-foreground">
          {ONLINE_ORDERING_ENABLED ? (
            <p>
              Para solicitar una devolución o un reembolso, escribe a{" "}
              <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.complaints)}>
                {PUBLIC_CONTACT.complaints}
              </a>{" "}
              con tu número de pedido. En los pedidos de negocio, las condiciones aplicables se
              indican en la cotización por escrito antes de su aceptación.
            </p>
          ) : (
            <p>
              Por el momento no estamos recibiendo pedidos en línea, así que hoy no se procesa
              ninguna compra —ni ninguna devolución— desde este sitio. Preferimos decirlo con
              claridad a mostrar una política que todavía no está en operación.
            </p>
          )}
          <p>
            La Política de devoluciones completa para {ACTIVE_MARKET.countryNameLocal} se publicará
            en el{" "}
            <Link to="/legal" className="underline underline-offset-4">
              centro legal
            </Link>{" "}
            antes de abrir la venta al público. Esta página no limita los derechos que la ley te
            reconoce como consumidor.
          </p>
          <p>
            Si tienes una inquietud sobre una comunicación de CornerMex, escribe a{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.complaints)}>
              {PUBLIC_CONTACT.complaints}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/returns" />
        </div>
      </section>
    </SiteLayout>
  );
}
