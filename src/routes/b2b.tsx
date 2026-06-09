import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { ClipboardList, Mail, Truck } from "lucide-react";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/b2b")({
  head: () => {
    const t = i18n.getFixedT(i18n.language || "en", "t");
    const title = t("pages.b2b.meta.title");
    const description = t("pages.b2b.meta.description");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://corner-mex-uae.lovable.app/b2b" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "https://corner-mex-uae.lovable.app/b2b" }],
    };
  },
  component: B2B,
});

function B2B() {
  const { t } = useTranslation();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("pages.b2b.eyebrow")}</span>
        <h1 className="mt-4 font-display text-5xl tracking-tight">{t("pages.b2b.title")}</h1>
        <p className="mt-6 text-lg text-muted-foreground">{t("pages.b2b.lede")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/b2b/lead"><Button size="lg" className="rounded-full">{t("pages.b2b.ctaQuote")}</Button></Link>
          <a href="mailto:b2b@cornermex.ae"><Button size="lg" variant="outline" className="rounded-full"><Mail className="me-2 h-4 w-4" /> {t("pages.b2b.ctaContact")}</Button></a>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { icon: ClipboardList, key: "catalogues" as const },
            { icon: Truck, key: "emirates" as const },
            { icon: Mail, key: "manager" as const },
          ].map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border border-border p-5">
              <Icon className="h-5 w-5" />
              <h3 className="mt-3 font-medium">{t(`pages.b2b.perks.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`pages.b2b.perks.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}