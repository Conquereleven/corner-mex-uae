import { ManualContactActions } from "./ManualContactActions";

export function ManualQuoteRequestPreview({ preview }: { preview: string }) {
  return (
    <section
      aria-labelledby="request-preview-heading"
      className="mt-10 rounded-2xl border border-sage/40 bg-sage/10 p-5 sm:p-7"
    >
      <span className="text-[11px] uppercase tracking-[0.18em] text-accent">Prepared locally</span>
      <h2 id="request-preview-heading" className="mt-1 font-display text-3xl text-foreground">
        Your request is ready to send.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose how you would like to contact CornerMex.
      </p>
      <pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 font-sans text-sm leading-relaxed text-foreground">
        {preview}
      </pre>
      <ManualContactActions preview={preview} />
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Complete sending in your email or WhatsApp app. Preparing this preview did not submit or
        store your request.
      </p>
    </section>
  );
}
