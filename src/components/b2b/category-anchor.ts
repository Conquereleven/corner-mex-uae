import type { B2bCategoryId } from "@/features/b2b-catalog/wave1-products";

export function categoryAnchor(categoryId: B2bCategoryId): string {
  return `category-${categoryId}`;
}
