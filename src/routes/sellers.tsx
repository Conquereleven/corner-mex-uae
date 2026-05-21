import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { listSellers } from "@/lib/catalog.functions";

export const Route = createFileRoute("/sellers")({
  head: () => ({ meta: [{ title: "Sellers — Corner Mex" }] }),
  component: Sellers,
});

function Sellers() {
  const { data, isLoading } = useQuery({ queryKey: ["sellers"], queryFn: () => listSellers() });
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl tracking-tight">Verified sellers</h1>
        <p className="mt-2 text-muted-foreground">Mexican producers and curators shipping across the Emirates.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)
            : (data ?? []).map((s) => (
                <Link key={s.id} to="/sellers/$slug" params={{ slug: s.slug }} className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl">
                  {s.cover_url && <img src={s.cover_url} alt="" className="aspect-[16/9] w-full object-cover" />}
                  <div className="p-5">
                    <h2 className="font-display text-2xl tracking-tight text-foreground">{s.name}</h2>
                    {s.tagline && <p className="mt-1 text-sm text-muted-foreground">{s.tagline}</p>}
                    <p className="mt-3 text-xs uppercase tracking-widest text-primary">{s.product_count} products</p>
                  </div>
                </Link>
              ))}
        </div>
      </section>
    </SiteLayout>
  );
}