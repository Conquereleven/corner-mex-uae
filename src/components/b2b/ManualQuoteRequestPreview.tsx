import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualContactActions } from "./ManualContactActions";

export function ManualQuoteRequestPreview({
  preview,
  onSubmit,
  submitting,
  submittedLeadId,
  submitError,
}: {
  preview: string;
  onSubmit: () => void;
  submitting: boolean;
  submittedLeadId?: string;
  submitError?: string;
}) {
  return (
    <section
      aria-labelledby="request-preview-heading"
      className="mt-10 rounded-2xl border border-sage/40 bg-sage/10 p-5 sm:p-7"
    >
      <span className="text-[11px] uppercase tracking-[0.18em] text-accent">
        Revisa antes de enviar
      </span>
      <h2 id="request-preview-heading" className="mt-1 font-display text-3xl text-foreground">
        Tu solicitud está lista.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Al enviarla, la solicitud queda registrada para que una persona de CornerMex la revise. No
        crea un pedido ni confirma precios, existencias, entrega o condiciones comerciales.
      </p>
      <pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 font-sans text-sm leading-relaxed text-foreground">
        {preview}
      </pre>

      {submittedLeadId ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-medium text-foreground">CornerMex recibió tu solicitud.</p>
              <p className="mt-1 text-muted-foreground">
                Folio {submittedLeadId.slice(0, 8)}. Nuestro equipo la revisará y te responderá por
                escrito.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={submitting}
          className="mt-6 min-h-11 w-full rounded-full sm:w-auto"
        >
          {submitting ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="me-2 h-4 w-4" />
          )}
          {submitting ? "Enviando…" : "Enviar solicitud a CornerMex"}
        </Button>
      )}

      {submitError && !submittedLeadId && (
        <p role="alert" className="mt-3 text-sm text-primary">
          {submitError}
        </p>
      )}

      <div className="mt-7 border-t border-border/70 pt-1">
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          ¿Prefieres otro medio? También puedes enviar la misma solicitud desde tu correo o
          copiarla.
        </p>
        <ManualContactActions preview={preview} />
      </div>
    </section>
  );
}
