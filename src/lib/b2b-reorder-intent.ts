import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type B2bCartDraftItem = {
  variantId: string;
  qty: number;
};

type B2bReorderIntentState = {
  accountId: string | null;
  sourceOrderId: string | null;
  items: B2bCartDraftItem[];
  setDraft: (input: {
    accountId: string;
    sourceOrderId: string;
    items: B2bCartDraftItem[];
  }) => void;
  clear: () => void;
};

// Separate from the B2C cart until CM-B2B-PORTAL-1B adds reviewed account pricing.
export const useB2bReorderIntent = create<B2bReorderIntentState>()(
  persist(
    (set) => ({
      accountId: null,
      sourceOrderId: null,
      items: [],
      setDraft: ({ accountId, sourceOrderId, items }) => set({ accountId, sourceOrderId, items }),
      clear: () => set({ accountId: null, sourceOrderId: null, items: [] }),
    }),
    {
      name: "cornermex-b2b-reorder-intent-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : (undefined as never),
      ),
    },
  ),
);
