import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marketIdentityLine } from "@/lib/business-identity";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { BrandLogo } from "@/components/site/BrandLogo";
import { ACTIVE_BRAND } from "@/config/brand";
import { ACTIVE_MARKET } from "@/config/market";

type FooterLink =
  | {
      to:
        | "/shop"
        | "/b2b"
        | "/b2b/catalog"
        | "/about"
        | "/contact"
        | "/delivery"
        | "/returns"
        | "/privacy"
        | "/terms"
        | "/legal";
      label: string;
    }
  | { action: "cookies"; label: string };

const FOOTER_GROUPS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "Tienda",
    links: [
      { to: "/shop", label: "Catálogo" },
      { to: "/b2b/catalog", label: "Catálogo para negocios" },
      { to: "/b2b", label: "Ventas a negocios" },
    ],
  },
  {
    heading: "Ayuda",
    links: [
      { to: "/contact", label: "Contacto" },
      { to: "/delivery", label: "Envíos" },
      { to: "/returns", label: "Devoluciones y reembolsos" },
      { action: "cookies", label: "Preferencias de cookies" },
    ],
  },
  {
    heading: "Empresa",
    links: [
      { to: "/about", label: "Acerca de CornerMex" },
      { to: "/contact", label: "Encuéntranos" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/privacy", label: "Privacidad" },
      { to: "/terms", label: "Términos" },
      { to: "/legal", label: "Centro legal" },
    ],
  },
];

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="cornermex-footer mt-24 border-t border-border pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl border-b border-border/60 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
              CornerMex
            </p>
            <h3 className="mt-2 font-display text-2xl tracking-tight">
              Abasto mexicano para tu casa y tu negocio
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Compra por pieza o por volumen. Los precios, la disponibilidad y el envío se confirman
              antes de que finalices tu pedido. Las solicitudes de negocio las revisa una persona:
              una solicitud no es un pedido ni una cotización confirmada, y no crea ningún
              compromiso comercial.
            </p>
          </div>
          <Link to="/b2b/catalog">
            <Button variant="outline" className="rounded-full">
              Solicitar condiciones de mayoreo
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo surface="onDark" className="h-14 w-28" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            {ACTIVE_BRAND.verbal.primary}
          </p>
          <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
            Precios en pesos mexicanos ({ACTIVE_MARKET.currency}). El precio y la disponibilidad se
            confirman al finalizar la compra.
          </p>
          <a
            href={mailto(PUBLIC_CONTACT.complaints, "Consulta a CornerMex")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Escríbenos
          </a>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">
              {group.heading}
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {group.links.map((link) =>
                "action" in link ? (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={openCookiePreferences}
                      className="text-left hover:text-foreground"
                    >
                      {link.label}
                    </button>
                  </li>
                ) : (
                  <li key={link.to}>
                    <Link to={link.to} className="hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border/60 px-4 py-6 text-center text-xs leading-5 text-muted-foreground">
        © {new Date().getFullYear()} {marketIdentityLine()} · {t("footer.rights")}
      </div>
    </footer>
  );
}
