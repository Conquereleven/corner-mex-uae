import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => {
    const t = i18n.getFixedT(i18n.language || "en", "t");
    const title = t("pages.about.meta.title");
    const description = t("pages.about.meta.description");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://corner-mex-uae.lovable.app/about" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "https://corner-mex-uae.lovable.app/about" }],
    };
  },
  component: About,
});

function About() {
  const { t } = useTranslation();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">{t("pages.about.title")}</h1>
        <p className="mt-6 text-lg text-muted-foreground">{t("pages.about.lede")}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/shop"><Button size="lg" className="rounded-full">{t("pages.about.ctaShop")}</Button></Link>
          <Link to="/b2b"><Button size="lg" variant="outline" className="rounded-full">{t("pages.about.ctaB2B")}</Button></Link>
          <Link to="/sellers"><Button size="lg" variant="ghost" className="rounded-full">{t("pages.about.ctaSellers")}</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}