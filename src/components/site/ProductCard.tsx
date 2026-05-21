import { Link } from "@tanstack/react-router";
import type { ProductListItem } from "@/lib/catalog.functions";
import { Flame } from "lucide-react";

export function ProductCard({ p }: { p: ProductListItem }) {
  const hasDiscount = p.compare_at_price_aed && p.compare_at_price_aed > p.price_aed;
  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {p.image && (
          <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        {hasDiscount && (
          <span className="absolute start-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">Sale</span>
        )}
        {p.is_bulk && (
          <span className="absolute end-3 top-3 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">HORECA</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {p.seller && <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.seller.name}</span>}
        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground">{p.name}</h3>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-foreground">AED {p.price_aed.toFixed(0)}</span>
            {hasDiscount && <span className="text-xs text-muted-foreground line-through">{p.compare_at_price_aed!.toFixed(0)}</span>}
          </div>
          {p.spice_level && p.spice_level > 0 && (
            <span className="flex items-center gap-0.5 text-primary">
              {Array.from({ length: Math.min(p.spice_level, 4) }).map((_, i) => <Flame key={i} className="h-3 w-3 fill-current" />)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}