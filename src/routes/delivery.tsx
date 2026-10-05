import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, PackageCheck, Scale } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup, TrustCard } from "@/components/site/Trust";
import { ACTIVE_MARKET } from "@/config/market";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";

export const Route = createFileRoute("/delivery")({
  head: () => {
    const title = `Envíos en ${ACTIVE_MARKET.countryNameLocal} — CornerMex`;
    const description =
      "Cómo funcionan los envíos de CornerMex: el costo y el tiempo de entrega se calculan para tu código postal y los ves antes de confirmar tu pedido.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl("/delivery") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/delivery") }],
    };
  },
  component: Delivery,
});

function Delivery() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Claro desde el principio
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">
          Envíos en {ACTIVE_MARKET.countryNameLocal}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          El costo y el tiempo de entrega dependen de tu código postal y de lo que lleva tu pedido.
          Los calculamos al capturar tu dirección y los ves antes de confirmar: en el proceso de
          compra para pedidos de menudeo, o en una cotización por escrito para pedidos de negocio.
        </p>

        <div
          role="note"
          className="mt-8 max-w-3xl rounded-2xl border border-border bg-secondary/40 p-6 leading-7"
        >
          {ONLINE_ORDERING_ENABLED ? (
            <>
              <p className="font-medium text-foreground">
                Puedes comprar en línea sin necesidad de crear una cuenta.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Las opciones de envío para tu código postal se muestran al finalizar la compra, cada
                una con su costo y su tiempo estimado. No se registra ningún pedido hasta que
                confirmas.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">
                Por el momento no estamos recibiendo pedidos en línea.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Hoy no es posible contratar ni despachar un envío desde este sitio. Esta página
                describe cómo funcionarán los envíos cuando se abran los pedidos. Las solicitudes de
                negocio se atienden por escrito.
              </p>
            </>
          )}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <TrustCard icon={MapPin} title="Cotizado para tu código postal" headingLevel={2}>
            La cobertura se confirma para cada dirección. No prometemos de antemano llegar a un
            destino que la paquetería no cubre.
          </TrustCard>
          <TrustCard icon={Scale} title="El costo antes de confirmar" headingLevel={2}>
            Ves el costo de cada opción de envío antes de confirmar tu pedido, para decidir con el
            importe a la vista.
          </TrustCard>
          <TrustCard icon={PackageCheck} title="Sin promesas en el aire" headingLevel={2}>
            Solo mostramos tiempos de entrega que la paquetería confirma para tu pedido.
          </TrustCard>
        </div>

        <section className="mt-14 max-w-3xl" aria-labelledby="delivery-how">
          <h2 id="delivery-how" className="font-display text-3xl tracking-tight">
            Cómo funciona
          </h2>
          <ol className="mt-5 space-y-4 text-base leading-7 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Arma tu carrito.</span> Explora el{" "}
              <Link to="/shop" className="underline underline-offset-4">
                catálogo
              </Link>{" "}
              para menudeo, o la{" "}
              <Link to="/b2b" className="underline underline-offset-4">
                sección para negocios
              </Link>{" "}
              si compras por volumen.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Captura tu dirección.</span> Con tu
              código postal, estado, municipio y colonia cotizamos las opciones de envío
              disponibles.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Elige y confirma.</span> Escoges la
              opción que prefieras —por precio o por rapidez— y nada es definitivo hasta que la ves
              y la aceptas.
            </li>
          </ol>
        </section>

        <div className="mt-14 max-w-3xl rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          Las dudas sobre el envío de un pedido de negocio se pueden enviar a{" "}
          <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.b2b)}>
            {PUBLIC_CONTACT.b2b}
          </a>
          . Enviar una pregunta no crea un pedido.
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/delivery" />
        </div>
      </section>
    </SiteLayout>
  );
}
