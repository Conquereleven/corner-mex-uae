import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { ACTIVE_MARKET } from "@/config/market";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const title = "Privacidad — CornerMex";
    const description =
      "Qué datos trata hoy el sitio de CornerMex: navegación, cuentas opcionales, carrito en tu navegador, preferencias de cookies y los datos de tu pedido.";
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Resumen en lenguaje claro
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Privacidad</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Esta página describe lo que el sitio de CornerMex hace hoy con tus datos. El Aviso de
          privacidad completo para {ACTIVE_MARKET.countryNameLocal} se publicará en el{" "}
          <Link to="/legal" className="underline underline-offset-4">
            centro legal
          </Link>{" "}
          antes de abrir la venta al público.
        </p>
        <div className="mt-8 space-y-6 text-base leading-7 text-muted-foreground">
          <section aria-labelledby="privacy-browsing">
            <h2 id="privacy-browsing" className="font-display text-2xl text-foreground">
              Navegación
            </h2>
            <p className="mt-2">
              Puedes explorar el catálogo sin crear una cuenta. Se trata la información técnica
              indispensable para la seguridad y el funcionamiento del sitio, y para recordar tu
              idioma y tus preferencias de cookies. Las cookies no esenciales dependen de tus{" "}
              <button
                type="button"
                onClick={openCookiePreferences}
                className="underline underline-offset-4 hover:text-foreground"
              >
                preferencias de cookies
              </button>
              .
            </p>
          </section>
          <section aria-labelledby="privacy-accounts">
            <h2 id="privacy-accounts" className="font-display text-2xl text-foreground">
              Cuentas y carrito
            </h2>
            <p className="mt-2">
              Crear una cuenta es opcional; sus datos se usan para operar la propia cuenta. El
              carrito se guarda en tu navegador hasta que finalizas la compra.
            </p>
          </section>
          <section aria-labelledby="privacy-orders">
            <h2 id="privacy-orders" className="font-display text-2xl text-foreground">
              Pedidos
            </h2>
            <p className="mt-2">
              Al hacer un pedido usamos tu nombre, teléfono, correo y dirección para registrarlo,
              entregarlo y darte seguimiento. Los datos de entrega se comparten con la paquetería
              que lleva tu pedido, únicamente para ese fin.
            </p>
          </section>
          <section aria-labelledby="privacy-enquiries">
            <h2 id="privacy-enquiries" className="font-display text-2xl text-foreground">
              Consultas por correo
            </h2>
            <p className="mt-2">
              Si escribes a CornerMex, la información que decidas compartir se usa para revisar y
              responder esa consulta. No se trata como un pedido ni como un registro de cuenta, y no
              entra en ningún proceso automatizado de mercadotecnia.
            </p>
          </section>
          <p>
            Solicitudes de privacidad:{" "}
            <a className="underline underline-offset-4" href={mailto(PUBLIC_CONTACT.privacy)}>
              {PUBLIC_CONTACT.privacy}
            </a>
            .
          </p>
        </div>
        <div className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/privacy" />
        </div>
      </section>
    </SiteLayout>
  );
}
