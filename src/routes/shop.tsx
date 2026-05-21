import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { listProducts, listCategories } from "@/lib/catalog.functions";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Corner Mex" },
      { name: "description", content: "Browse Mexican chiles, salsas, masa, snacks and pantry staples — delivered across the UAE." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "es" | "ar";
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");

  const cats = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => listCategories({ data: { lang } }),
  });
  const products = useQuery({
    queryKey: ["products", lang, category, q],
    queryFn: () => listProducts({ data: { lang, category, q: q || undefined } }),
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-5xl tracking-tight">Shop</h1>
            <p className="mt-2 text-muted-foreground">Authentic Mexican pantry, sourced for the UAE.</p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-full border border-border bg-card px-5 py-2.5 text-sm outline-none focus:border-primary md:w-72"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(undefined)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${!category ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {(cats.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${category === c.slug ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />)
            : (products.data ?? []).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {products.data && products.data.length === 0 && (
          <p className="mt-12 text-center text-muted-foreground">No products match your search.</p>
        )}

        <div className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          Browse by <Link to="/sellers" className="font-medium text-foreground underline">verified sellers</Link>.
        </div>
      </section>
    </SiteLayout>
  );
}