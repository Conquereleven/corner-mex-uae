import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { siteUrl } from "@/lib/site-url";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { ONLINE_ORDERING_ENABLED } from "@/lib/commerce-mode";

const POLICIES = [
  {
    to: "/delivery" as const,
    title: "Envíos",
    summary: "Cómo se cotiza el envío a tu código postal antes de confirmar.",
  },
  {
    to: "/returns" as const,
    title: "Devoluciones",
    summary: "Cómo solicitar una devolución o un reembolso.",
  },
  {
    to: "/privacy" as const,
    title: "Privacidad",
    summary: "Qué datos trata CornerMex y cómo contactarnos.",
  },
  {
    to: "/terms" as const,
    title: "Términos",
    summary: "Cómo funciona el sitio y la compra en línea.",
  },
];

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: "Políticas — CornerMex" },
      {
        name: "description",
        content: "Envíos, devoluciones, privacidad y términos de CornerMex.",
      },
      { property: "og:url", content: siteUrl("/legal") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/legal") }],
  }),
  component: LegalIndex,
});

function LegalIndex() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-eyebrow">
          <ShieldCheck className="h-3.5 w-3.5" /> Políticas
        </div>
        <h1 className="mt-3 font-display text-5xl tracking-tight">
          Reglas claras antes de comprar
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          {ONLINE_ORDERING_ENABLED
            ? "En CornerMex puedes explorar el catálogo, comprar como invitado o con una cuenta, y solicitar cotizaciones para tu negocio. Estos resúmenes describen cómo funciona el sitio hoy; los documentos legales completos para México se publican aquí antes de abrir la venta al público."
            : "En CornerMex puedes explorar el catálogo, preparar tu carrito y solicitar cotizaciones para tu negocio. Por el momento no estamos recibiendo pedidos en línea. Los documentos legales completos para México se publican aquí antes de abrir la venta al público."}
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {POLICIES.map((policy) => (
            <Link
              key={policy.to}
              to={policy.to}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="mt-4 font-display text-2xl tracking-tight group-hover:underline">
                {policy.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{policy.summary}</p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Dudas legales:{" "}
          <a className="underline" href={mailto(PUBLIC_CONTACT.legal)}>
            {PUBLIC_CONTACT.legal}
          </a>
        </p>
      </section>
    </SiteLayout>
  );
}
