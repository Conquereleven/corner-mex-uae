import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  type B2bLead,
  type B2bLeadPipelineInput,
  type B2bQuoteDraft,
} from "@/lib/b2b-leads.functions";
import {
  B2B_LEAD_PRIORITIES,
  b2bLeadPriorityLabel,
  b2bLeadRiskFlags,
  b2bLeadRiskLabel,
} from "@/lib/b2b-lead-lifecycle";

type Props = {
  lead: B2bLead;
  pipelineSaving: boolean;
  quoteSaving: boolean;
  onSavePipeline: (input: B2bLeadPipelineInput) => void;
  onSaveQuote: (draft: B2bQuoteDraft | null) => void;
};

type PipelineForm = {
  website: string;
  decision_maker: string;
  qualification_score: string;
  priority: B2bLead["priority"];
  owner: string;
  source_url: string;
  last_contact_at: string;
  next_action: string;
  next_action_at: string;
  blocker: string;
  first_order_id: string;
};

type QuoteForm = {
  items_summary: string;
  delivery_fee_aed: string;
  vat_treatment: string;
  availability_note: string;
  valid_until: string;
  payment_terms: string;
  recipient: string;
  notes: string;
};

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring";

const emptyQuote: QuoteForm = {
  items_summary: "",
  delivery_fee_aed: "",
  vat_treatment: "",
  availability_note: "",
  valid_until: "",
  payment_terms: "",
  recipient: "",
  notes: "",
};

function clean(value: string) {
  return value.trim() || null;
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function pipelineFromLead(lead: B2bLead): PipelineForm {
  return {
    website: lead.website ?? "",
    decision_maker: lead.decision_maker ?? "",
    qualification_score: lead.qualification_score?.toString() ?? "",
    priority: lead.priority,
    owner: lead.owner ?? "",
    source_url: lead.source_url ?? "",
    last_contact_at: toDatetimeLocal(lead.last_contact_at),
    next_action: lead.next_action ?? "",
    next_action_at: toDatetimeLocal(lead.next_action_at),
    blocker: lead.blocker ?? "",
    first_order_id: lead.first_order_id ?? "",
  };
}

function quoteFromLead(lead: B2bLead): QuoteForm {
  const draft = lead.quote_draft;
  if (!draft) return emptyQuote;
  return {
    items_summary: draft.items_summary ?? "",
    delivery_fee_aed: draft.delivery_fee_aed?.toString() ?? "",
    vat_treatment: draft.vat_treatment ?? "",
    availability_note: draft.availability_note ?? "",
    valid_until: draft.valid_until ?? "",
    payment_terms: draft.payment_terms ?? "",
    recipient: draft.recipient ?? "",
    notes: draft.notes ?? "",
  };
}

export function AdminB2bLeadPipeline({
  lead,
  pipelineSaving,
  quoteSaving,
  onSavePipeline,
  onSaveQuote,
}: Props) {
  const [pipeline, setPipeline] = useState<PipelineForm>(() => pipelineFromLead(lead));
  const [quote, setQuote] = useState<QuoteForm>(() => quoteFromLead(lead));

  useEffect(() => {
    setPipeline(pipelineFromLead(lead));
    setQuote(quoteFromLead(lead));
  }, [lead.id, lead.updated_at, lead.quote_draft_updated_at]);

  const risks = useMemo(() => b2bLeadRiskFlags(lead), [lead]);

  function savePipeline() {
    onSavePipeline({
      id: lead.id,
      website: clean(pipeline.website),
      decision_maker: clean(pipeline.decision_maker),
      qualification_score: pipeline.qualification_score
        ? Number.parseInt(pipeline.qualification_score, 10)
        : null,
      priority: pipeline.priority,
      owner: clean(pipeline.owner),
      source_url: clean(pipeline.source_url),
      last_contact_at: toIso(pipeline.last_contact_at),
      next_action: clean(pipeline.next_action),
      next_action_at: toIso(pipeline.next_action_at),
      blocker: clean(pipeline.blocker),
      first_order_id: clean(pipeline.first_order_id),
    });
  }

  function saveQuote() {
    const hasContent = Object.values(quote).some((value) => value.trim().length > 0);
    if (!hasContent) {
      onSaveQuote(null);
      return;
    }
    onSaveQuote({
      items_summary: clean(quote.items_summary),
      delivery_fee_aed: quote.delivery_fee_aed ? Number(quote.delivery_fee_aed) : null,
      vat_treatment: clean(quote.vat_treatment),
      availability_note: clean(quote.availability_note),
      valid_until: clean(quote.valid_until),
      payment_terms: clean(quote.payment_terms),
      recipient: clean(quote.recipient),
      notes: clean(quote.notes),
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Commercial pipeline</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {risks.length === 0 ? (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">
                  No active risk flags
                </Badge>
              ) : (
                risks.map((risk) => (
                  <Badge key={risk} variant="outline" className="border-amber-500/30 text-amber-700">
                    {b2bLeadRiskLabel(risk)}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Human-owned GTM profile, last-mile follow-up and first-purchase traceability. Nothing
            here sends outreach or creates an order.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Website"
            value={pipeline.website}
            placeholder="https://…"
            onChange={(value) => setPipeline((current) => ({ ...current, website: value }))}
          />
          <InputField
            label="Decision maker"
            value={pipeline.decision_maker}
            placeholder="Name / role"
            onChange={(value) =>
              setPipeline((current) => ({ ...current, decision_maker: value }))
            }
          />
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Qualification score
            </span>
            <input
              className={INPUT_CLASS}
              type="number"
              min={0}
              max={100}
              value={pipeline.qualification_score}
              onChange={(event) =>
                setPipeline((current) => ({
                  ...current,
                  qualification_score: event.target.value,
                }))
              }
              placeholder="0–100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Priority
            </span>
            <select
              className={INPUT_CLASS}
              value={pipeline.priority}
              onChange={(event) =>
                setPipeline((current) => ({
                  ...current,
                  priority: event.target.value as B2bLead["priority"],
                }))
              }
            >
              {B2B_LEAD_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {b2bLeadPriorityLabel(priority)}
                </option>
              ))}
            </select>
          </label>
          <InputField
            label="Owner"
            value={pipeline.owner}
            placeholder="Human pipeline owner"
            onChange={(value) => setPipeline((current) => ({ ...current, owner: value }))}
          />
          <InputField
            label="Source / provenance URL"
            value={pipeline.source_url}
            placeholder="https://…"
            onChange={(value) => setPipeline((current) => ({ ...current, source_url: value }))}
          />
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Last contact
            </span>
            <input
              className={INPUT_CLASS}
              type="datetime-local"
              value={pipeline.last_contact_at}
              onChange={(event) =>
                setPipeline((current) => ({ ...current, last_contact_at: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Next action due
            </span>
            <input
              className={INPUT_CLASS}
              type="datetime-local"
              value={pipeline.next_action_at}
              onChange={(event) =>
                setPipeline((current) => ({ ...current, next_action_at: event.target.value }))
              }
            />
          </label>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Next action
            </p>
            <Textarea
              rows={2}
              value={pipeline.next_action}
              onChange={(event) =>
                setPipeline((current) => ({ ...current, next_action: event.target.value }))
              }
              placeholder="The next human action required to move this lead"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Blocker / risk
            </p>
            <Textarea
              rows={2}
              value={pipeline.blocker}
              onChange={(event) =>
                setPipeline((current) => ({ ...current, blocker: event.target.value }))
              }
              placeholder="Leave blank when there is no known blocker"
            />
          </div>
          <div className="sm:col-span-2">
            <InputField
              label="First purchase order ID"
              value={pipeline.first_order_id}
              placeholder="Existing canonical order UUID"
              onChange={(value) =>
                setPipeline((current) => ({ ...current, first_order_id: value }))
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Linking only. The order must already exist; this action does not create or mutate it.
            </p>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={savePipeline} disabled={pipelineSaving}>
              Save pipeline
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Quote draft</CardTitle>
            <Badge variant="outline">Draft only · manual approval/send</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Blank fields stay unconfirmed. Saving this draft does not send a quote, reserve stock,
            confirm availability, create an order or change payment state.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Quantity and AED pricing
            </p>
            <Textarea
              rows={4}
              value={quote.items_summary}
              onChange={(event) => setQuote((current) => ({ ...current, items_summary: event.target.value }))}
              placeholder="Human-entered lines only. Example: Product · qty · AED unit price"
            />
          </div>
          <InputField
            label="Delivery fee AED"
            value={quote.delivery_fee_aed}
            type="number"
            placeholder="Unconfirmed"
            onChange={(value) => setQuote((current) => ({ ...current, delivery_fee_aed: value }))}
          />
          <InputField
            label="Valid until"
            value={quote.valid_until}
            type="date"
            onChange={(value) => setQuote((current) => ({ ...current, valid_until: value }))}
          />
          <InputField
            label="VAT treatment"
            value={quote.vat_treatment}
            placeholder="Unconfirmed"
            onChange={(value) => setQuote((current) => ({ ...current, vat_treatment: value }))}
          />
          <InputField
            label="Recipient"
            value={quote.recipient}
            placeholder="Exact intended recipient"
            onChange={(value) => setQuote((current) => ({ ...current, recipient: value }))}
          />
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Availability confirmation
            </p>
            <Textarea
              rows={2}
              value={quote.availability_note}
              onChange={(event) =>
                setQuote((current) => ({ ...current, availability_note: event.target.value }))
              }
              placeholder="Point-in-time human confirmation or leave blank"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Payment terms
            </p>
            <Textarea
              rows={2}
              value={quote.payment_terms}
              onChange={(event) =>
                setQuote((current) => ({ ...current, payment_terms: event.target.value }))
              }
              placeholder="Unconfirmed until approved"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Notes</p>
            <Textarea
              rows={3}
              value={quote.notes}
              onChange={(event) => setQuote((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Internal quote-preparation notes"
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {lead.quote_draft_updated_at
                ? `Last saved ${new Date(lead.quote_draft_updated_at).toLocaleString()}`
                : "No saved draft"}
            </p>
            <Button onClick={saveQuote} disabled={quoteSaving}>
              Save draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        className={INPUT_CLASS}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
