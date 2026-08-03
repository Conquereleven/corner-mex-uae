import { B2bProductCard } from "./B2bProductCard";
import { categoryAnchor } from "./category-anchor";
import { B2B_CATEGORIES, productsInCategory } from "@/features/b2b-catalog/wave1-products";

export function B2bProductGrid({
  selectedProductIds,
  onToggle,
}: {
  selectedProductIds: ReadonlyArray<string>;
  onToggle: (productId: string) => void;
}) {
  return (
    <div id="wave-1-products" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-10 sm:px-6 lg:px-8">
      {B2B_CATEGORIES.map((category, categoryIndex) => {
        const products = productsInCategory(category.id);
        return (
          <section
            key={category.id}
            id={categoryAnchor(category.id)}
            aria-labelledby={`${category.id}-heading`}
            className={`scroll-mt-28 ${categoryIndex === 0 ? "" : "pt-16"}`}
          >
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-primary">
                  Category {categoryIndex + 1}
                </span>
                <h2
                  id={`${category.id}-heading`}
                  className="mt-1 font-display text-4xl tracking-tight text-foreground"
                >
                  {category.label}
                </h2>
              </div>
              <span className="text-sm text-muted-foreground">{products.length} products</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <B2bProductCard
                  key={product.id}
                  product={product}
                  selected={selectedProductIds.includes(product.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
