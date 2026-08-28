import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { businessIdentityLine } from "@/lib/business-identity";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { BrandLogo } from "@/components/site/BrandLogo";

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
    heading: "Shop",
    links: [
      { to: "/shop", label: "Catalogue" },
      { to: "/b2b/catalog", label: "B2B catalogue" },
      { to: "/b2b", label: "Business enquiries" },
    ],
  },
  {
    heading: "Help",
    links: [
      { to: "/contact", label: "Contact" },
      { to: "/delivery", label: "Delivery in the UAE" },
      { to: "/returns", label: "Returns & refunds" },
      { action: "cookies", label: "Cookie preferences" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/about", label: "About Intermex" },
      { to: "/contact", label: "Find Us" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
      { to: "/legal", label: "Legal centre" },
    ],
  },
];

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40 pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl border-b border-border/60 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-verde-jalapeno)]">
              Intermex UAE
            </p>
            <h3 className="mt-2 font-display text-2xl tracking-tight">
              Exploring Mexican pantry supply for the UAE
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Retail cart and account access are available. Checkout and order processing run only
              when authorized configuration is enabled; prices, availability, shipping and payment
              are confirmed in the applicable flow. B2B enquiries can be submitted to the CornerMex
              commercial pipeline for human review, but an enquiry is not an order, payment or
              confirmed quote and creates no commercial commitment.
            </p>
          </div>
          <Link to="/b2b/catalog">
            <Button variant="outline" className="rounded-full">
              Request B2B terms
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo className="h-14 w-28 rounded-md bg-[color:var(--brand-mole-brown)] p-1" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Del barrio pa’l mundo · Tradition you can taste
          </p>
          <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
            AED is the primary display currency. Prices and availability shown in preview are not
            offers and must be confirmed manually.
          </p>
          <a
            href={mailto(PUBLIC_CONTACT.complaints, "CornerMex customer enquiry")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {PUBLIC_CONTACT.complaints}
          </a>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.heading} aria-label={`${group.heading} links`}>
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
        © {new Date().getFullYear()} {businessIdentityLine()} · {t("footer.rights")}
      </div>
    </footer>
  );
}
