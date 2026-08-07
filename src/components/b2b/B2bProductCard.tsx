import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { B2bProduct } from "@/features/b2b-catalog/wave1-products";

export function B2bProductCard({
  product,
  selected,
  onToggle,
}: {
  product: B2bProduct;
  selected: boolean;
  onToggle: (productId: string) => void;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl">
      <div className="flex aspect-[4/3] items-end bg-sand p-5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            {product.brand ?? "Wave 1 selection"}
          </span>
          <p className="mt-2 max-w-[14rem] font-display text-2xl leading-none text-obsidian">
            {product.name}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <span>{product.presentation}</span>
          <span>Price on request</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Availability confirmed at quotation.
        </p>
        <Button
          type="button"
          aria-pressed={selected}
          onClick={() => onToggle(product.id)}
          variant={selected ? "default" : "outline"}
          className="mt-5 min-h-11 w-full rounded-full"
        >
          {selected ? <Check className="me-2 h-4 w-4" /> : <Plus className="me-2 h-4 w-4" />}
          {selected ? "Added to quote request" : "Add to quote request"}
        </Button>
      </div>
    </article>
  );
}
