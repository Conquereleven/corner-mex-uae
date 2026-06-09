import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { listProducts, listCategories, listProductFacets } from "@/lib/catalog.functions";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const shopSearchSchema = z.object({
  category: fallback(z.string().optional(), undefined),
  q: fallback(z.string().optional(), undefined),
  origin: fallback(z.string().optional(), undefined),
  brand: fallback(z.string().optional(), undefined),
  priceMin: fallback(z.number().optional(), undefined),
  priceMax: fallback(z.number().optional(), undefined),
  sort: fallback(z.enum(["newest", "price_asc", "price_desc", "most_viewed"]), "newest").default("newest"),
});

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(shopSearchSchema),
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const [qInput, setQInput] = useState(search.q ?? "");
  useEffect(() => setQInput(search.q ?? ""), [search.q]);

  function update(patch: Partial<typeof search>) {
    navigate({ search: (prev: any) => ({ ...prev, ...patch }), replace: true });
  }

  const cats = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => listCategories({ data: { lang } }),
  });
  const facets = useQuery({
    queryKey: ["product-facets"],
    queryFn: () => listProductFacets(),
    staleTime: 5 * 60_000,
  });
  const products = useQuery({
    queryKey: ["products", lang, search],
    queryFn: () =>
      listProducts({
        data: {
          lang,
          category: search.category,
          q: search.q,
          origin: search.origin,
          brand: search.brand,
          priceMin: search.priceMin,
          priceMax: search.priceMax,
          sort: search.sort,
        },
      }),
  });

  const hasFilters = Boolean(
    search.category || search.q || search.origin || search.brand ||
      search.priceMin || search.priceMax || (search.sort && search.sort !== "newest"),
  );

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-5xl tracking-tight">Shop</h1>
            <p className="mt-2 text-muted-foreground">Authentic Mexican pantry, sourced for the UAE.</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); update({ q: qInput || undefined }); }}
            className="w-full md:w-72"
          >
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-border bg-card px-5 py-2.5 text-sm outline-none focus:border-primary"
              aria-label="Search products"
            />
          </form>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => update({ category: undefined })}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${!search.category ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {(cats.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => update({ category: c.slug })}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${search.category === c.slug ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Origin</span>
            <select
              value={search.origin ?? ""}
              onChange={(e) => update({ origin: e.target.value || undefined })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">All origins</option>
              {(facets.data?.origins ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Brand</span>
            <select
              value={search.brand ?? ""}
              onChange={(e) => update({ brand: e.target.value || undefined })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">All brands</option>
              {(facets.data?.brands ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Min price (AED)</span>
            <input
              type="number" min={0} inputMode="numeric"
              value={search.priceMin ?? ""}
              onChange={(e) => update({ priceMin: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Max price (AED)</span>
            <input
              type="number" min={0} inputMode="numeric"
              value={search.priceMax ?? ""}
              onChange={(e) => update({ priceMax: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Sort</span>
            <select
              value={search.sort}
              onChange={(e) => update({ sort: e.target.value as any })}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="most_viewed">Most viewed</option>
            </select>
          </label>
          {hasFilters && (
            <button
              onClick={() => navigate({ search: { sort: "newest" } as any, replace: true })}
              className="self-end rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:col-span-2 lg:col-span-1"
            >
              Clear filters
            </button>
          )}
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