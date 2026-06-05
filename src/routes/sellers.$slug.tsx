import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { getSeller, listProducts } from "@/lib/catalog.functions";

export const Route = createFileRoute("/sellers/$slug")({
  head: () => ({ meta: [{ title: "Seller — Corner Mex" }] }),
  component: SellerPage,
});

function SellerPage() {
  const { slug } = Route.useParams();
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "es" | "ar";
  const seller = useQuery({ queryKey: ["seller", slug], queryFn: () => getSeller({ data: { slug } }) });
  const products = useQuery({
    queryKey: ["seller-products", slug, lang],
    queryFn: () => listProducts({ data: { lang, sellerSlug: slug } }),
    enabled: !!seller.data,
  });

  if (seller.isLoading) {
    return <SiteLayout><div className="mx-auto max-w-7xl px-4 py-20"><div className="h-64 animate-pulse rounded-2xl bg-muted" /></div></SiteLayout>;
  }
  if (!seller.data) throw notFound();

  const s = seller.data as any;
  const allProducts = products.data ?? [];
  const featuredIds: string[] = s.featured_product_ids ?? [];
  const featured = featuredIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as any[];
  const rest = featuredIds.length ? allProducts.filter((p) => !featuredIds.includes(p.id)) : allProducts;
  const bh = s.business_hours ?? {};
  const theme = (s.theme ?? {}) as any;
  const themeStyle: CSSProperties & Record<string, string> = {};
  if (theme.primary) themeStyle["--store-primary"] = theme.primary;
  if (theme.accent) themeStyle["--store-accent"] = theme.accent;
  if (theme.bg) themeStyle["--store-bg"] = theme.bg;
  if (theme.text) themeStyle["--store-text"] = theme.text;
  const fontFamily = theme.font && theme.font !== "System" ? `'${theme.font}', sans-serif` : undefined;
  const radiusMap: Record<string, string> = { none: "0", sm: "0.25rem", md: "0.5rem", lg: "0.75rem", xl: "1rem" };
  if (theme.radius) themeStyle["--store-radius"] = radiusMap[theme.radius];
  const DAY_ORDER: Array<[string, string]> = [
    ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
  ];
  const hasHours = DAY_ORDER.some(([k]) => bh[k] && (bh[k].open || bh[k].close || bh[k].closed));
  return (
    <SiteLayout>
      <div style={{ ...themeStyle, fontFamily, background: theme.bg, color: theme.text }}>
      {s.cover_url && (
        <div className="relative h-64 w-full overflow-hidden md:h-80">
          <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="-mt-16 flex flex-col items-start gap-4 md:flex-row md:items-end md:gap-8">
          {s.logo_url && (
            <img src={s.logo_url} alt={s.name} className="h-24 w-24 rounded-2xl border-4 border-background object-cover shadow-lg" />
          )}
          <div className="flex-1">
            <Link to="/sellers" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">← All sellers</Link>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl" style={{ color: theme.primary || undefined }}>{s.name}</h1>
            {s.tagline && <p className="mt-2 text-muted-foreground">{s.tagline}</p>}
          </div>
          <span className="text-xs uppercase tracking-widest" style={{ color: theme.accent || undefined }}>{s.product_count} products</span>
        </div>
        {s.bio && <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.bio}</p>}

        {hasHours && (
          <div className="mt-8 max-w-md rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Business hours</h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {DAY_ORDER.map(([k, label]) => {
                const v = bh[k] ?? {};
                return (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span>{v.closed ? "Closed" : v.open && v.close ? `${v.open}–${v.close}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {featured.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl tracking-tight mb-4">Featured</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        )}

        <div className="mt-12">
          {featured.length > 0 && <h2 className="font-display text-2xl tracking-tight mb-4">All products</h2>}
          <div className={theme.layout === "list" ? "flex flex-col gap-4" : theme.layout === "masonry" ? "columns-2 sm:columns-3 lg:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"}>
            {rest.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>
      </div>
    </SiteLayout>
  );
}