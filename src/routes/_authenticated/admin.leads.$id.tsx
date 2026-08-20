import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, Phone, Trash2 } from "lucide-react";
import { AdminB2bLeadPipeline } from "@/components/b2b/AdminB2bLeadPipeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminAddLeadNote,
  adminDeleteLeadNote,
  adminGetB2bLead,
  adminSaveB2bQuoteDraft,
  adminUpdateB2bLead,
  adminUpdateB2bLeadPipeline,
  type B2bLead,
  type B2bLeadPipelineInput,
  type B2bQuoteDraft,
} from "@/lib/b2b-leads.functions";
import {
  allowedB2bLeadTransitions,
  b2bLeadStatusLabel,
  type B2bLeadStatus,
} from "@/lib/b2b-lead-lifecycle";

export const Route = createFileRoute("/_authenticated/admin/leads/$id")({
  head: () => ({ meta: [{ title: "Admin — Lead detail" }] }),
  component: LeadDetail,
});

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

function LeadDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetB2bLead);
  const updateFn = useServerFn(adminUpdateB2bLead);
  const pipelineFn = useServerFn(adminUpdateB2bLeadPipeline);
  const quoteFn = useServerFn(adminSaveB2bQuoteDraft);
  const addNoteFn = useServerFn(adminAddLeadNote);
  const deleteNoteFn = useServerFn(adminDeleteLeadNote);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [adminNote, setAdminNote] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-b2b-lead", id],
    queryFn: async () => {
      const result = await getFn({ data: { id } });
      setAdminNote(result.lead.admin_note ?? "");
      return result;
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-b2b-lead", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-b2b-leads"] });
  }

  const statusMutation = useMutation({
    mutationFn: (status: B2bLead["status"]) => updateFn({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not update status")),
  });

  const pipelineMutation = useMutation({
    mutationFn: (input: B2bLeadPipelineInput) => pipelineFn({ data: input }),
    onSuccess: () => {
      toast.success("Pipeline saved");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not save pipeline")),
  });

  const quoteMutation = useMutation({
    mutationFn: (draft: B2bQuoteDraft | null) => quoteFn({ data: { lead_id: id, draft } }),
    onSuccess: () => {
      toast.success("Quote draft saved");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not save quote draft")),
  });

  const adminNoteMutation = useMutation({
    mutationFn: () =>
      updateFn({ data: { id, admin_note: (adminNote ?? "").trim() || null } }),
    onSuccess: () => {
      toast.success("Pinned note saved");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not save note")),
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addNoteFn({ data: { lead_id: id, body: note.trim() } }),
    onSuccess: () => {
      setNote("");
      toast.success("Note added");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not add note")),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => deleteNoteFn({ data: { id: noteId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      invalidate();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Could not delete note")),
  });

  function copy(value: string | null) {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => toast.success("Copied"));
  }

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Could not load this lead. It may not exist or the canonical B2B pipeline may be
            unavailable.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lead, history, notes } = query.data;
  const nextStatuses = allowedB2bLeadTransitions(lead.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/leads"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
          </Link>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{lead.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.company ?? "—"} · {lead.country_city ?? "—"} ·{" "}
            {new Date(lead.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_COLOR[lead.status]}>
            {b2bLeadStatusLabel(lead.status)}
          </Badge>
          <select
            value={lead.status}
            disabled={nextStatuses.length === 0 || statusMutation.isPending}
            onChange={(event) => statusMutation.mutate(event.target.value as B2bLeadStatus)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-60"
            aria-label="Change lead status"
          >
            <option value={lead.status}>{b2bLeadStatusLabel(lead.status)}</option>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>
                {b2bLeadStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business type" value={lead.business_type} />
              <Field label="Contact role" value={lead.contact_role} />
              <Field label="Preferred contact" value={lead.contact_preference} />
              <Field label="Estimated volume" value={lead.estimated_volume} />
              <Field label="Products of interest" value={lead.products_interest} full />
              <Field label="Message" value={lead.message} full />
              {lead.contacted_at && (
                <Field
                  label="First contacted at"
                  value={new Date(lead.contacted_at).toLocaleString()}
                />
              )}
            </CardContent>
          </Card>

          <AdminB2bLeadPipeline
            lead={lead}
            pipelineSaving={pipelineMutation.isPending}
            quoteSaving={quoteMutation.isPending}
            onSavePipeline={(input) => pipelineMutation.mutate(input)}
            onSaveQuote={(draft) => quoteMutation.mutate(draft)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a note visible to admins only"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!note.trim() || addNoteMutation.isPending}
                    onClick={() => addNoteMutation.mutate()}
                  >
                    Add note
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {notes.length === 0 && (
                  <li className="py-4 text-sm text-muted-foreground">No notes yet.</li>
                )}
                {notes.map((leadNote) => (
                  <li
                    key={leadNote.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm">{leadNote.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(leadNote.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deleteNoteMutation.isPending}
                      onClick={() => deleteNoteMutation.mutate(leadNote.id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status history</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No status events yet.</p>
              ) : (
                <ol className="space-y-3">
                  {history.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground/50" />
                      <div className="min-w-0">
                        <p>
                          <span className="text-muted-foreground">
                            {event.from_status ? b2bLeadStatusLabel(event.from_status) : "Intake"}
                          </span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-medium">{b2bLeadStatusLabel(event.to_status)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="truncate hover:underline">
                  {lead.email}
                </a>
                <button
                  onClick={() => copy(lead.email)}
                  className="ms-auto text-muted-foreground hover:text-foreground"
                  aria-label="Copy email"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="truncate hover:underline">
                    {lead.phone}
                  </a>
                  <button
                    onClick={() => copy(lead.phone)}
                    className="ms-auto text-muted-foreground hover:text-foreground"
                    aria-label="Copy phone"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pinned admin note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={6}
                value={adminNote ?? ""}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Top-of-mind note for this lead"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={adminNoteMutation.isPending}
                  onClick={() => adminNoteMutation.mutate()}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value ?? "—"}</p>
    </div>
  );
}
