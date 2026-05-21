import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

  const s = seller.data;
  return (
    <SiteLayout>
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
            <h1 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">{s.name}</h1>
            {s.tagline && <p className="mt-2 text-muted-foreground">{s.tagline}</p>}
          </div>
          <span className="text-xs uppercase tracking-widest text-primary">{s.product_count} products</span>
        </div>
        {s.bio && <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.bio}</p>}

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(products.data ?? []).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </SiteLayout>
  );
}