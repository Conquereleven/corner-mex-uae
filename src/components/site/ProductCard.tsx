import { Link } from "@tanstack/react-router";
import type { ProductListItem } from "@/lib/catalog.functions";
import { Flame } from "lucide-react";
import { useCurrency } from "@/lib/use-currency";
import { imageSrcSet, PRODUCT_CARD_SIZES } from "@/lib/image";

export function ProductCard({
  p,
  priority = false,
  source = "shop",
}: {
  p: ProductListItem;
  priority?: boolean;
  source?: string;
}) {
  const cur = useCurrency();
  const img = imageSrcSet(p.image);
  void source;
  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      preload="intent"
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {p.image && (
          <img
            src={img.src}
            srcSet={img.srcSet}
            sizes={PRODUCT_CARD_SIZES}
            alt={p.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            width={400}
            height={400}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        {p.is_bulk && (
          <span className="absolute start-3 bottom-3 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
            HORECA
          </span>
        )}
        <span className="absolute end-3 top-3 rounded-full border border-white/40 bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
          Preview
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Sold by CornerMex
        </span>
        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground">{p.name}</h3>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-foreground">
              {cur.format(p.price_aed)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              indicative
            </span>
          </div>
          {p.spice_level && p.spice_level > 0 && (
            <span className="flex items-center gap-0.5 text-primary">
              {Array.from({ length: Math.min(p.spice_level, 4) }).map((_, i) => (
                <Flame key={i} className="h-3 w-3 fill-current" />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
