import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { EmptyQuoteSelection } from "@/components/b2b/EmptyQuoteSelection";
import { ManualQuoteRequestForm } from "@/components/b2b/ManualQuoteRequestForm";
import { ManualQuoteRequestPreview } from "@/components/b2b/ManualQuoteRequestPreview";
import { QuoteSelectionList } from "@/components/b2b/QuoteSelectionList";
import { SiteLayout } from "@/components/site/SiteLayout";
import { TrustBar } from "@/components/site/Trust";
import { Button } from "@/components/ui/button";
import {
  EMPTY_MANUAL_QUOTE_REQUEST,
  formatManualQuoteRequest,
  quantityInterestLabel,
  validateManualQuoteRequest,
  type ManualQuoteRequestErrors,
  type ManualQuoteRequestFields,
} from "@/features/b2b-catalog/manual-quote-request";
import { useQuoteSelection } from "@/features/b2b-catalog/use-quote-selection";
import { getWave1Product } from "@/features/b2b-catalog/wave1-products";
import { submitB2bLead } from "@/lib/b2b-leads.functions";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/b2b_/quote")({
  head: () => ({
    meta: [
      { title: "Request a B2B quote — Intermex UAE" },
      {
        name: "description",
        content:
          "Build and submit a B2B enquiry for human-reviewed Intermex pricing, availability and commercial terms.",
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
  const submitFn = useServerFn(submitB2bLead);
  const [fields, setFields] = useState<ManualQuoteRequestFields>(EMPTY_MANUAL_QUOTE_REQUEST);
  const [errors, setErrors] = useState<ManualQuoteRequestErrors>({});
  const [preview, setPreview] = useState<string>();
  const [submissionKey, setSubmissionKey] = useState<string>();

  const submit = useMutation({
    mutationFn: async () => {
      if (!submissionKey) throw new Error("Prepare the request before submitting.");
      const productsInterest = products
        .map(
          (product) =>
            `${product.brand ? `${product.brand} ` : ""}${product.name} — ${product.presentation}`,
        )
        .join("; ");
      return submitFn({
        data: {
          full_name: fields.contactPerson,
          company: fields.businessName,
          email: fields.email,
          phone: fields.phone || null,
          country_city: fields.emirate,
          contact_role: fields.role || null,
          business_type: fields.businessType,
          products_interest: productsInterest,
          estimated_volume: quantityInterestLabel(fields.quantityInterest),
          message: fields.notes || null,
          contact_preference: fields.phone ? "Email or phone / WhatsApp" : "Email",
          idempotency_key: submissionKey,
        },
      });
    },
  });

  function resetSubmission() {
    setPreview(undefined);
    setSubmissionKey(undefined);
    submit.reset();
  }

  function updateField<Key extends keyof ManualQuoteRequestFields>(
    field: Key,
    value: ManualQuoteRequestFields[Key],
  ) {
    setFields((current) => ({ ...current, [field]: value }));
    resetSubmission();
  }

  function removeSelectedProduct(productId: string) {
    removeProduct(productId);
    resetSubmission();
  }

  function prepareRequest() {
    const nextErrors = validateManualQuoteRequest(fields, products);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      resetSubmission();
      return;
    }
    submit.reset();
    setSubmissionKey(createSubmissionKey());
    setPreview(formatManualQuoteRequest(fields, products));
  }

  let submitError: string | undefined;
  if (submit.error instanceof Error) submitError = submit.error.message;
  else if (submit.error) submitError = "Could not submit enquiry.";

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
            Human-reviewed B2B pipeline
          </span>
          <h1 className="mt-3 font-display text-5xl leading-none tracking-tight text-foreground sm:text-6xl">
            Request commercial terms.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Build your shortlist, review the enquiry, then submit it directly to Intermex. A team
            member reviews every request before any pricing, availability, delivery or commercial
            commitment is made.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-8">
          {products.length === 0 ? (
            <EmptyQuoteSelection />
          ) : (
            <>
              <QuoteSelectionList products={products} onRemove={removeSelectedProduct} />
              <ManualQuoteRequestForm
                fields={fields}
                errors={errors}
                selectedCount={products.length}
                onChange={updateField}
                onPrepare={prepareRequest}
              />
              {preview && (
                <ManualQuoteRequestPreview
                  preview={preview}
                  onSubmit={() => submit.mutate()}
                  submitting={submit.isPending}
                  submittedLeadId={submit.data?.id}
                  submitError={submitError}
                />
              )}
            </>
          )}
        </div>

        <TrustBar context="b2b" className="mt-8" />
      </main>
    </SiteLayout>
  );
}

function createSubmissionKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `b2b-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
