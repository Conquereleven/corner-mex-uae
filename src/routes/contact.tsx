import { createFileRoute } from "@tanstack/react-router";
import { Building2, Mail, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PolicyLinkGroup } from "@/components/site/Trust";
import { marketIdentityLine } from "@/lib/business-identity";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/contact")({
  head: () => {
    const title = "Contacto — atención a clientes y ventas a negocios | CornerMex";
    const description =
      "Escribe a CornerMex para atención a clientes, ventas por mayoreo o temas de privacidad y legales. Cada consulta la revisa una persona.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: siteUrl("/contact") },
      ],
      links: [{ rel: "canonical", href: siteUrl("/contact") }],
    };
  },
  component: Contact,
});

const CHANNELS = [
  {
    icon: Mail,
    title: "Atención a clientes",
    description:
      "Dudas sobre el catálogo, tu carrito, tu cuenta o una consulta que ya enviaste.",
    email: PUBLIC_CONTACT.complaints,
    subject: "Consulta a CornerMex",
  },
  {
    icon: Building2,
    title: "Mayoreo y negocios",
    description:
      "Restaurantes, tiendas y distribuidores. Las solicitudes de cotización se revisan y se responden por escrito.",
    email: PUBLIC_CONTACT.b2b,
    subject: "Consulta de mayoreo CornerMex",
  },
  {
    icon: ShieldCheck,
    title: "Privacidad y legal",
    description: "Solicitudes de privacidad, dudas legales y correspondencia formal.",
    email: PUBLIC_CONTACT.legal,
    subject: "Consulta legal CornerMex",
  },
];

function Contact() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Leemos cada mensaje
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Contacta a CornerMex</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          Puedes escribirnos por correo. Cada consulta la revisa una persona; enviar una no crea un pedido, un contrato ni un proceso automatizado.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
            <div
              key={channel.title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <channel.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl tracking-tight">{channel.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {channel.description}
              </p>
              <a
                href={mailto(channel.email, channel.subject)}
                className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Correo {channel.title.toLowerCase()}
              </a>
            </div>
          ))}
        </div>

        <div
          id="find-us"
          className="mt-12 scroll-mt-24 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground"
        >
          <p>{marketIdentityLine()}</p>
          <p className="mt-2">
            Por ahora el correo es el medio confirmado para contactar a CornerMex. Un mismo buzón atiende todos los tipos de consulta, así que cada opción usa la misma dirección con un asunto distinto: conserva el asunto para que tu mensaje llegue a quien corresponde.
          </p>
          <p className="mt-2">
            Aún no contamos con teléfono, domicilio para visitas ni horario de atención publicados. CornerMex todavía no opera un dominio de correo propio, así que una dirección en otro dominio no es un canal de contacto de CornerMex.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Más información
          </h2>
          <PolicyLinkGroup className="mt-3" exclude="/contact" />
        </div>
      </section>
    </SiteLayout>
  );
}
