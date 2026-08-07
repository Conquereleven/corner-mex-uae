import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EmptyQuoteSelection } from "@/components/b2b/EmptyQuoteSelection";
import { ManualQuoteRequestForm } from "@/components/b2b/ManualQuoteRequestForm";
import { ManualQuoteRequestPreview } from "@/components/b2b/ManualQuoteRequestPreview";
import { QuoteSelectionList } from "@/components/b2b/QuoteSelectionList";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import {
  EMPTY_MANUAL_QUOTE_REQUEST,
  formatManualQuoteRequest,
  validateManualQuoteRequest,
  type ManualQuoteRequestErrors,
  type ManualQuoteRequestFields,
} from "@/features/b2b-catalog/manual-quote-request";
import { useQuoteSelection } from "@/features/b2b-catalog/use-quote-selection";
import { getWave1Product } from "@/features/b2b-catalog/wave1-products";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/b2b_/quote")({
  head: () => ({
    meta: [
      { title: "Prepare a manual B2B quote request — CornerMex UAE" },
      {
        name: "description",
        content: "Prepare a local request preview for a manually reviewed CornerMex B2B quote.",
      },
    ],
    links: [{ rel: "canonical", href: siteUrl("/b2b/quote") }],
  }),
  component: B2bQuoteRoute,
});

function B2bQuoteRoute() {
  const { selectedProductIds, removeProduct } = useQuoteSelection();
  const products = useMemo(
    () => selectedProductIds.map(getWave1Product).filter((product) => product !== undefined),
    [selectedProductIds],
  );
  const [fields, setFields] = useState<ManualQuoteRequestFields>(EMPTY_MANUAL_QUOTE_REQUEST);
  const [errors, setErrors] = useState<ManualQuoteRequestErrors>({});
  const [preview, setPreview] = useState<string>();

  function updateField<Key extends keyof ManualQuoteRequestFields>(
    field: Key,
    value: ManualQuoteRequestFields[Key],
  ) {
    setFields((current) => ({ ...current, [field]: value }));
    setPreview(undefined);
  }

  function prepareRequest() {
    const nextErrors = validateManualQuoteRequest(fields, products);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPreview(undefined);
      return;
    }
    setPreview(formatManualQuoteRequest(fields, products));
  }

  return (
    <SiteLayout>
      <main className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <Link to="/b2b/catalog" className="inline-block">
          <Button variant="ghost" className="min-h-11 rounded-full px-3">
            <ArrowLeft className="me-2 h-4 w-4" /> Back to catalogue
          </Button>
        </Link>
        <div className="mt-6 max-w-3xl">
          <span className="text-[11px] uppercase tracking-[0.2em] text-primary">
            Manual quote builder
          </span>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight text-foreground sm:text-6xl">
            Prepare your request.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Review your shortlist and create a readable message. Nothing is submitted, sent, or
            stored by this page.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-8">
          {products.length === 0 ? (
            <EmptyQuoteSelection />
          ) : (
            <>
              <QuoteSelectionList products={products} onRemove={removeProduct} />
              <ManualQuoteRequestForm
                fields={fields}
                errors={errors}
                selectedCount={products.length}
                onChange={updateField}
                onPrepare={prepareRequest}
              />
              {preview && <ManualQuoteRequestPreview preview={preview} />}
            </>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
