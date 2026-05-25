import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  qty: number;
  stock: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty: number) => void;
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, qty: Math.min(i.stock, i.qty + qty) }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, qty: Math.min(item.stock, qty) }] };
        }),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      setQty: (variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(i.stock, qty)) } : i))
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "cornermex-cart-v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as any))),
    },
  ),
);

export function cartTotals(items: CartItem[]) {
  const subtotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  // Free shipping above 150 AED, else 25 AED per seller
  const sellers = new Set(items.map((i) => i.sellerId));
  const shipping = items.length === 0 ? 0 : subtotal >= 150 ? 0 : sellers.size * 25;
  const tax = subtotal * 0.05; // UAE VAT 5%
  const total = subtotal + shipping + tax;
  return { subtotal, shipping, tax, total, sellerCount: sellers.size };
}

export function groupBySeller(items: CartItem[]) {
  const groups = new Map<string, { sellerId: string; sellerSlug: string; sellerName: string; items: CartItem[]; subtotal: number }>();
  for (const i of items) {
    const g = groups.get(i.sellerId) ?? { sellerId: i.sellerId, sellerSlug: i.sellerSlug, sellerName: i.sellerName, items: [], subtotal: 0 };
    g.items.push(i);
    g.subtotal += i.unitPrice * i.qty;
    groups.set(i.sellerId, g);
  }
  return Array.from(groups.values());
}