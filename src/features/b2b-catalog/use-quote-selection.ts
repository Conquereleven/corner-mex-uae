import { useCallback, useEffect, useState } from "react";
import { readQuoteSelection, writeQuoteSelection } from "./quote-selection";

export function useQuoteSelection() {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedProductIds(readQuoteSelection());
  }, []);

  const commit = useCallback((nextProductIds: ReadonlyArray<string>) => {
    const safeIds = writeQuoteSelection(nextProductIds);
    setSelectedProductIds(safeIds);
  }, []);

  const toggleProduct = useCallback(
    (productId: string) => {
      const next = selectedProductIds.includes(productId)
        ? selectedProductIds.filter((selectedId) => selectedId !== productId)
        : [...selectedProductIds, productId];
      commit(next);
    },
    [commit, selectedProductIds],
  );

  const removeProduct = useCallback(
    (productId: string) => commit(selectedProductIds.filter((id) => id !== productId)),
    [commit, selectedProductIds],
  );

  const clearSelection = useCallback(() => commit([]), [commit]);

  return { selectedProductIds, toggleProduct, removeProduct, clearSelection };
}
