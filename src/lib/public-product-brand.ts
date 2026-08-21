const PLACEHOLDER_PRODUCT_BRANDS = new Set(["my store", "intermex uae"]);

export function publicProductBrand(brand: string | null | undefined): string | null {
  const value = brand?.trim();
  if (!value) return null;
  if (PLACEHOLDER_PRODUCT_BRANDS.has(value.toLowerCase())) return null;
  return value;
}

export function isPlaceholderProductBrand(brand: string | null | undefined): boolean {
  return publicProductBrand(brand) === null;
}
