import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Mail, Phone, CheckCircle2 } from "lucide-react";
import { adminListB2bLeads, adminUpdateB2bLead, type B2bLead } from "@/lib/b2b-leads.functions";
import {
  B2B_LEAD_STATUSES,
  allowedB2bLeadTransitions,
  b2bLeadPriorityLabel,
  b2bLeadRiskFlags,
  b2bLeadRiskLabel,
  b2bLeadStatusLabel,
  type B2bLeadStatus,
} from "@/lib/b2b-lead-lifecycle";

export const Route = createFileRoute("/_authenticated/admin/leads/")({
  head: () => ({ meta: [{ title: "Admin — B2B leads" }] }),
  component: AdminLeads,
});

const FILTER_STATUSES = ["all", ...B2B_LEAD_STATUSES] as const;
type StatusFilter = (typeof FILTER_STATUSES)[number];

const STATUS_COLOR: Record<B2bLeadStatus, string> = {
  new: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  contacted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  quoting: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  won: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AdminLeads() {
  const listFn = useServerFn(adminListB2bLeads);
  const updateFn = useServerFn(adminUpdateB2bLead);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-b2b-leads", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status?: B2bLead["status"]; admin_note?: string | null }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-b2b-leads"] });
      toast.success("Lead updated");
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not update lead")),
  });

  function copy(value: string | null) {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => toast.success("Copied"));
  }

  const leads = query.data ?? [];
  const highPriority = leads.filter((lead) => lead.priority === "high").length;
  const overdue = leads.filter((lead) =>
    b2bLeadRiskFlags(lead).includes("FOLLOW_UP_OVERDUE"),
  ).length;
  const blocked = leads.filter((lead) => b2bLeadRiskFlags(lead).includes("BLOCKED")).length;
  const needsOwner = leads.filter((lead) => b2bLeadRiskFlags(lead).includes("OWNER_MISSING")).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">B2B leads</h1>
        <p className="text-sm text-muted-foreground">
          Human-owned commercial pipeline from enquiry through first-purchase traceability.
        </p>
      </div>

      {!query.isLoading && !query.isError && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="High priority" value={highPriority} />
          <Metric label="Follow-up overdue" value={overdue} />
          <Metric label="Blocked" value={blocked} />
          <Metric label="Needs owner" value={needsOwner} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTER_STATUSES.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatus(filter)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition ${status === filter ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {filter === "all" ? "All" : b2bLeadStatusLabel(filter)}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton className="h-72" />
      ) : query.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Could not load B2B leads. Try again in a moment.
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="space-y-1 py-12 text-center text-sm text-muted-foreground">
            <p>No B2B enquiries yet.</p>
            <p>
              New business enquiries will appear here for human review, ownership and follow-up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{leads.length} leads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {leads.map((lead) => {
                const open = openId === lead.id;
                const nextStatuses = allowedB2bLeadTransitions(lead.status);
                const risks = b2bLeadRiskFlags(lead);
                return (
                  <li key={lead.id} className="px-6 py-4">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1.4fr_1fr_1.4fr_auto] xl:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {lead.full_name}
                          {lead.company ? ` · ${lead.company}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.business_type ?? "—"} · {lead.country_city ?? "—"}
                        </p>
                      </div>
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{lead.email}</span>
                          <button
                            onClick={() => copy(lead.email)}
                            className="ms-1 text-muted-foreground hover:text-foreground"
                            aria-label="Copy email"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        {lead.phone && (
                          <div className="mt-0.5 flex items-center gap-1.5 truncate">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{lead.phone}</span>
                            <button
                              onClick={() => copy(lead.phone)}
                              className="ms-1 hover:text-foreground"
                              aria-label="Copy phone"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{b2bLeadPriorityLabel(lead.priority)}</Badge>
                          {lead.qualification_score !== null && (
                            <span className="text-muted-foreground">Score {lead.qualification_score}</span>
                          )}
                        </div>
                        <p className="truncate text-muted-foreground">
                          Owner: {lead.owner ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-medium">{lead.next_action ?? "No next action"}</p>
                        <p className="text-muted-foreground">
                          {lead.next_action_at
                            ? `Due ${new Date(lead.next_action_at).toLocaleString()}`
                            : "No due date"}
                        </p>
                        {risks.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {risks.slice(0, 2).map((risk) => (
                              <Badge
                                key={risk}
                                variant="outline"
                                className="border-amber-500/30 px-1.5 py-0 text-[10px] text-amber-700"
                              >
                                {b2bLeadRiskLabel(risk)}
                              </Badge>
                            ))}
                            {risks.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">+{risks.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge variant="outline" className={STATUS_COLOR[lead.status]}>
                          {b2bLeadStatusLabel(lead.status)}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                        {lead.status === "new" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => update.mutate({ id: lead.id, status: "contacted" })}
                          >
                            <CheckCircle2 className="me-1 h-3.5 w-3.5" /> Mark contacted
                          </Button>
                        )}
                        <select
                          value={lead.status}
                          disabled={nextStatuses.length === 0 || update.isPending}
                          onChange={(event) =>
                            update.mutate({
                              id: lead.id,
                              status: event.target.value as B2bLeadStatus,
                            })
                          }
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
                          aria-label={`Change status for ${lead.full_name}`}
                        >
                          <option value={lead.status}>{b2bLeadStatusLabel(lead.status)}</option>
                          {nextStatuses.map((nextStatus) => (
                            <option key={nextStatus} value={nextStatus}>
                              {b2bLeadStatusLabel(nextStatus)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenId(open ? null : lead.id)}
                        >
                          {open ? "Hide" : "Quick"}
                        </Button>
                        <Link to="/admin/leads/$id" params={{ id: lead.id }}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                    {open && (
                      <div className="mt-4 grid gap-4 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-2">
                        <div className="space-y-2 text-sm">
                          <Field label="Contact role" value={lead.contact_role} />
                          <Field label="Products of interest" value={lead.products_interest} />
                          <Field label="Estimated volume" value={lead.estimated_volume} />
                          <Field label="Preferred contact" value={lead.contact_preference} />
                          <Field label="Decision maker" value={lead.decision_maker} />
                          <Field label="Blocker" value={lead.blocker} />
                          <Field label="Message" value={lead.message} />
                          {lead.last_contact_at && (
                            <Field
                              label="Last contact"
                              value={new Date(lead.last_contact_at).toLocaleString()}
                            />
                          )}
                          {lead.first_order_id && (
                            <Field label="First purchase order" value={lead.first_order_id} />
                          )}
                        </div>
                        <NoteEditor
                          lead={lead}
                          onSave={(note) => update.mutate({ id: lead.id, admin_note: note })}
                          saving={update.isPending}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value ?? "—"}</p>
    </div>
  );
}

function NoteEditor({
  lead,
  onSave,
  saving,
}: {
  lead: B2bLead;
  onSave: (note: string | null) => void;
  saving: boolean;
}) {
  const [note, setNote] = useState(lead.admin_note ?? "");
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Internal note</p>
      <Textarea
        rows={6}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Pinned note visible to admins only"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={saving} onClick={() => onSave(note.trim() || null)}>
          Save note
        </Button>
      </div>
    </div>
  );
}
