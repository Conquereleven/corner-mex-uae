import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { listProducts, listCategories, listProductFacets } from "@/lib/catalog.functions";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ShopFilters, type ShopFilterState } from "@/components/site/ShopFilters";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Search } from "lucide-react";

const shopSearchSchema = z.object({
  category: fallback(z.string().optional(), undefined),
  q: fallback(z.string().optional(), undefined),
  origin: fallback(z.string().optional(), undefined),
  brand: fallback(z.string().optional(), undefined),
  priceMin: fallback(z.number().optional(), undefined),
  priceMax: fallback(z.number().optional(), undefined),
  inStock: fallback(z.boolean().optional(), undefined),
  bulk: fallback(z.boolean().optional(), undefined),
  spice: fallback(z.number().int().min(0).max(4).optional(), undefined),
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
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setQInput(search.q ?? ""), [search.q]);

  function update(patch: Partial<ShopFilterState>) {
    navigate({ search: (prev: any) => ({ ...prev, ...patch }), replace: true });
  }
  function resetAll() {
    navigate({ search: { sort: "newest" } as any, replace: true });
    setMobileOpen(false);
  }

  // Debounced search input
  useEffect(() => {
    const id = setTimeout(() => {
      const v = qInput.trim();
      if ((v || undefined) !== search.q) update({ q: v || undefined });
    }, 350);
    return () => clearTimeout(id);
  }, [qInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = useQuery({
    queryKey: ["categories", lang],
    queryFn: () => listCategories({ data: { lang } }),
  });
  const facets = useQuery({
    queryKey: ["product-facets"],
    queryFn: () => listProductFacets(),
    staleTime: 5 * 60_000,
  });
  const products = useInfiniteQuery({
    queryKey: ["products", lang, search],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    queryFn: ({ pageParam }) =>
      listProducts({
        data: {
          lang,
          category: search.category,
          q: search.q,
          origin: search.origin,
          brand: search.brand,
          priceMin: search.priceMin,
          priceMax: search.priceMax,
          inStock: search.inStock,
          bulk: search.bulk,
          spice: search.spice,
          sort: search.sort,
          cursor: pageParam,
        },
      }),
  });
  const productItems = (products.data?.pages ?? []).flatMap((p) => p.items);

  const filterState: ShopFilterState = {
    category: search.category,
    q: search.q,
    origin: search.origin,
    brand: search.brand,
    priceMin: search.priceMin,
    priceMax: search.priceMax,
    inStock: search.inStock,
    bulk: search.bulk,
    spice: search.spice,
    sort: search.sort,
  };

  const categories = (cats.data ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
  const origins = facets.data?.origins ?? [];
  const brands = facets.data?.brands ?? [];
  const resultCount = productItems.length;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Shop</h1>
            <p className="mt-1 text-sm text-muted-foreground">Authentic Mexican pantry, sourced for the UAE.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-full border border-border bg-card ps-9 pe-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
              aria-label="Search products"
            />
          </div>
        </header>

        <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-sm">
              <ShopFilters
                state={filterState}
                update={update}
                reset={resetAll}
                categories={categories}
                origins={origins}
                brands={brands}
                resultCount={resultCount}
              />
            </div>
          </aside>

          <div className="min-w-0">
            {/* Mobile filter trigger */}
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {(filterState.category || filterState.brand || filterState.origin || filterState.priceMin != null || filterState.priceMax != null || filterState.inStock || filterState.bulk || filterState.spice != null) && (
                      <span className="ms-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-sm overflow-y-auto p-5 sm:max-w-sm">
                  <SheetHeader className="mb-4 p-0">
                    <SheetTitle className="text-left font-display text-xl tracking-tight">Filters</SheetTitle>
                  </SheetHeader>
                  <ShopFilters
                    state={filterState}
                    update={update}
                    reset={resetAll}
                    categories={categories}
                    origins={origins}
                    brands={brands}
                    resultCount={resultCount}
                  />
                  <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => {
                        resetAll();
                        setMobileOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      className="flex-1 rounded-full"
                      onClick={() => {
                        setMobileOpen(false);
                        // Wait for the sheet close animation, then scroll to the grid.
                        setTimeout(() => {
                          document
                            .getElementById("shop-results")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 220);
                      }}
                    >
                      Show {resultCount ?? ""} results
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <p className="text-xs text-muted-foreground">{resultCount ?? 0} products</p>
            </div>

            <div id="shop-results" className="scroll-mt-24 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {products.isLoading
                ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />)
                : productItems.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
            {!products.isLoading && productItems.length === 0 && (
              <div className="mt-16 text-center">
                <p className="text-sm text-muted-foreground">No products match your filters.</p>
                <Button variant="outline" className="mt-4 rounded-full" onClick={resetAll}>Clear filters</Button>
              </div>
            )}
            {products.hasNextPage && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={products.isFetchingNextPage}
                  onClick={() => products.fetchNextPage()}
                >
                  {products.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          Browse by <Link to="/sellers" className="font-medium text-foreground underline">verified sellers</Link>.
        </div>
      </section>
    </SiteLayout>
  );
}