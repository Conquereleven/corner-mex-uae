import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { B2bProduct } from "@/features/b2b-catalog/wave1-products";

export function QuoteSelectionList({
  products,
  onRemove,
}: {
  products: ReadonlyArray<B2bProduct>;
  onRemove: (productId: string) => void;
}) {
  return (
    <section aria-labelledby="quote-selection-heading">
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-primary">
            Your shortlist
          </span>
          <h2 id="quote-selection-heading" className="mt-1 font-display text-3xl text-foreground">
            Selected products
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">{products.length} selected</span>
      </div>
      <ul className="divide-y divide-border">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {product.brand ? `${product.brand} ` : ""}
                {product.name}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {product.presentation} · Price on request
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 shrink-0 rounded-full"
              aria-label={`Remove ${product.name}`}
              onClick={() => onRemove(product.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
