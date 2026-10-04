import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export const Route = createFileRoute("/b2b_/lead")({
  head: () => ({
    meta: [
      { title: "Ventas a negocios — CornerMex" },
      {
        name: "description",
        content:
          "Envía una solicitud de cotización desde el catálogo para negocios o contacta al equipo por correo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusinessEnquiry,
});

function BusinessEnquiry() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Ventas a negocios
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          Solicita una cotización de CornerMex
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Usa el catálogo para negocios para elegir productos y enviar tu solicitud a CornerMex. Una
          persona revisa cada solicitud antes de confirmar precios, disponibilidad, entrega o
          condiciones comerciales. Una solicitud no es un pedido.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/b2b/catalog">
            <Button className="rounded-full">Abrir catálogo para negocios</Button>
          </Link>
          <a href={mailto(PUBLIC_CONTACT.b2b, "Solicitud de cotización CornerMex")}>
            <Button variant="outline" className="rounded-full">
              <Mail className="me-2 h-4 w-4" /> Correo {PUBLIC_CONTACT.b2b}
            </Button>
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
