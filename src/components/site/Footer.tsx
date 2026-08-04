import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40 pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl border-b border-border/60 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Commercial preview
            </p>
            <h3 className="mt-2 font-display text-2xl tracking-tight">
              Exploring Mexican pantry supply for the UAE
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              B2C cart and account access are available. Checkout and order processing run only
              when authorized configuration is enabled; prices, availability, shipping and payment
              are confirmed in the applicable flow. B2B quote requests remain manual, and this page
              does not claim that an order, payment or quote request was processed.
            </p>
          </div>
          <a href={mailto(PUBLIC_CONTACT.b2b, "CornerMex manual quote request")}>
            <Button variant="outline" className="rounded-full">
              <Mail className="me-2 h-4 w-4" /> Request a manual quote
            </Button>
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="font-display text-2xl font-semibold tracking-tight">
            Corner<span className="text-primary">Mex</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            AED is the primary display currency. Prices and availability shown in preview are not
            offers and must be confirmed manually.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/shop" className="hover:text-foreground">
                Catalogue
              </Link>
            </li>
            <li>
              <Link to="/b2b" className="hover:text-foreground">
                Business enquiries
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-foreground">
                About CornerMex
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest">Policies</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/shipping" className="hover:text-foreground">
                Shipping
              </Link>
            </li>
            <li>
              <Link to="/returns" className="hover:text-foreground">
                Returns
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openCookiePreferences}
                className="text-left hover:text-foreground"
              >
                Cookie preferences
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest">Contact</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href={mailto(PUBLIC_CONTACT.b2b)} className="hover:text-foreground">
                {PUBLIC_CONTACT.b2b}
              </a>
            </li>
            <li>
              <a href={mailto(PUBLIC_CONTACT.privacy)} className="hover:text-foreground">
                {PUBLIC_CONTACT.privacy}
              </a>
            </li>
            <li>
              <a href={mailto(PUBLIC_CONTACT.complaints)} className="hover:text-foreground">
                {PUBLIC_CONTACT.complaints}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CornerMex, a trading brand of RodMor TradeCo LLC · Sharjah
        Media City, UAE · Trade license 2647014.01 · {t("footer.rights")}
      </div>
    </footer>
  );
}
