import { B2B_CATEGORIES } from "@/features/b2b-catalog/wave1-products";
import { categoryAnchor } from "./category-anchor";

export function B2bCategoryNav() {
  return (
    <nav aria-label="Product categories" className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {B2B_CATEGORIES.map((category) => (
          <a
            key={category.id}
            href={`#${categoryAnchor(category.id)}`}
            className="inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {category.label}
            <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-muted-foreground">
              {category.count}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}
