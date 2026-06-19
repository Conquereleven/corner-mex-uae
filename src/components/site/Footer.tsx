import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { toast } from "sonner";
import { openCookiePreferences } from "@/lib/cookie-consent";

export function Footer() {
  const { t } = useTranslation();
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await subscribe({ data: { email, locale: "en", source: "footer" } });
      toast.success("You're subscribed!");
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not subscribe");
    } finally { setBusy(false); }
  }
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl border-b border-border/60 px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="font-display text-2xl tracking-tight">Get Mexican news & offers</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              New drops, promo codes and HORECA deals — once a month. By subscribing you agree to our{" "}
              <Link to="/legal/$slug" params={{ slug: "privacy-policy" }} className="underline">Privacy Policy</Link>.
            </p>
          </div>
          <form onSubmit={onSubscribe} className="flex w-full max-w-md gap-2">
            <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={busy} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              {busy ? "..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-5 lg:px-8">
        <div>
          <div className="font-display text-2xl font-semibold tracking-tight">
            Corner<span className="text-primary">Mex</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">{t("footer.shop")}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/shop" className="hover:text-foreground">{t("nav.shop")}</Link></li>
            <li><Link to="/b2b" className="hover:text-foreground">{t("nav.b2b")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">{t("footer.company")}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">{t("nav.about")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">{t("footer.legal")}</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/legal" className="hover:text-foreground">Legal Center</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "terms-and-conditions" }} className="hover:text-foreground">Terms & Conditions</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "privacy-policy" }} className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "cookie-policy" }} className="hover:text-foreground">Cookie Policy</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "returns-refunds" }} className="hover:text-foreground">Returns & Refunds</Link></li>
            <li>
              <button type="button" onClick={openCookiePreferences} className="text-left hover:text-foreground">
                Cookie preferences
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">Trust & AI</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/legal/$slug" params={{ slug: "ai-transparency" }} className="hover:text-foreground">AI Transparency</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "seller-agreement" }} className="hover:text-foreground">Seller Agreement</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "intellectual-property" }} className="hover:text-foreground">IP Policy</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "acceptable-use" }} className="hover:text-foreground">Acceptable Use</Link></li>
            <li><Link to="/legal/$slug" params={{ slug: "security" }} className="hover:text-foreground">Security</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Corner Mex · {t("footer.rights")}
      </div>
    </footer>
  );
}