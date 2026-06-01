import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveBanners } from "@/lib/banners.functions";

export function PromoBanners() {
  const fn = useServerFn(listActiveBanners);
  const q = useQuery({ queryKey: ["promo-banners"], queryFn: () => fn({}) });
  const banners = q.data ?? [];
  if (banners.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b: any) => {
          const inner = (
            <article className="group relative overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl">
              {b.image_url && (
                <img src={b.image_url} alt={b.title} className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              )}
              <div className="p-5">
                <h3 className="font-display text-lg tracking-tight">{b.title}</h3>
                {b.subtitle && <p className="mt-1 text-sm text-muted-foreground">{b.subtitle}</p>}
                {b.cta_label && <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-widest text-primary">{b.cta_label} →</span>}
              </div>
            </article>
          );
          return b.link_url ? (
            <a key={b.id} href={b.link_url}>{inner}</a>
          ) : <div key={b.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}