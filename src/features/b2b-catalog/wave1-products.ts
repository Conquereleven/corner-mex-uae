export const B2B_CATEGORY_ORDER = ["beverages", "snacks", "pantry-sauces"] as const;

export type B2bCategoryId = (typeof B2B_CATEGORY_ORDER)[number];

export type B2bProduct = Readonly<{
  id: string;
  categoryId: B2bCategoryId;
  brand?: string;
  name: string;
  presentation: string;
}>;

export const B2B_CATEGORIES: ReadonlyArray<
  Readonly<{ id: B2bCategoryId; label: string; count: number }>
> = [
  { id: "beverages", label: "Beverages", count: 7 },
  { id: "snacks", label: "Snacks", count: 5 },
  { id: "pantry-sauces", label: "Pantry & Sauces", count: 3 },
];

export const WAVE_1_PRODUCTS: ReadonlyArray<B2bProduct> = [
  {
    id: "jarritos-fruit-punch-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Fruit Punch Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-grapefruit-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Grapefruit Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-guava-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Guava Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-lime-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Lime Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-mandarin-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Mandarin Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-mexican-cola-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Mexican Cola Drink",
    presentation: "370ML",
  },
  {
    id: "jarritos-pineapple-370ml",
    categoryId: "beverages",
    brand: "Jarritos",
    name: "Pineapple Drink",
    presentation: "370ML",
  },
  {
    id: "japanese-peanuts-valentina-30g",
    categoryId: "snacks",
    name: "Japanese Style Peanuts With Valentina Sauce",
    presentation: "30g",
  },
  {
    id: "tamaroca-banderilla-1pcs",
    categoryId: "snacks",
    brand: "Tamaroca",
    name: "Banderilla Tamarind Mexican Stick",
    presentation: "1pcs",
  },
  {
    id: "pepe-crunch-habanero-500g",
    categoryId: "snacks",
    brand: "Pepe Crunch",
    name: "Peanuts Habanero Flavour",
    presentation: "500g",
  },
  {
    id: "pepe-crunch-chipotle-500g",
    categoryId: "snacks",
    brand: "Pepe Crunch",
    name: "Peanuts Chipotle Flavour",
    presentation: "500g",
  },
  {
    id: "blue-corn-tortilla-chips-300g",
    categoryId: "snacks",
    name: "Blue Corn Tortilla Chips",
    presentation: "300g",
  },
  {
    id: "guajillo-chiles-200g",
    categoryId: "pantry-sauces",
    name: "Guajillo Chiles",
    presentation: "200g",
  },
  {
    id: "green-salsa-450g",
    categoryId: "pantry-sauces",
    name: "Green Salsa",
    presentation: "450g",
  },
  {
    id: "la-costena-green-salsa-475gm",
    categoryId: "pantry-sauces",
    brand: "La Costeña",
    name: "Green Salsa",
    presentation: "475gm",
  },
];

export const WAVE_1_PRODUCT_IDS = new Set(WAVE_1_PRODUCTS.map((product) => product.id));

export function getWave1Product(productId: string): B2bProduct | undefined {
  return WAVE_1_PRODUCTS.find((product) => product.id === productId);
}

export function productsInCategory(categoryId: B2bCategoryId): ReadonlyArray<B2bProduct> {
  return WAVE_1_PRODUCTS.filter((product) => product.categoryId === categoryId);
}
