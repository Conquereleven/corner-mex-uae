import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, Phone, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminAddLeadNote,
  adminDeleteLeadNote,
  adminGetB2bLead,
  adminUpdateB2bLead,
  type B2bLead,
} from "@/lib/b2b-leads.functions";

export const Route = createFileRoute("/_authenticated/admin/leads/$id")({
  head: () => ({ meta: [{ title: "Admin — Lead detail" }] }),
  component: LeadDetail,
});

const STATUSES = ["new", "contacted", "quoting", "closed", "lost"] as const;
const STATUS_COLOR: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  contacted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  quoting: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  closed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function LeadDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetB2bLead);
  const updFn = useServerFn(adminUpdateB2bLead);
  const addNoteFn = useServerFn(adminAddLeadNote);
  const delNoteFn = useServerFn(adminDeleteLeadNote);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [adminNote, setAdminNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-b2b-lead", id],
    queryFn: async () => {
      const r = await getFn({ data: { id } });
      setAdminNote(r.lead.admin_note ?? "");
      return r;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-b2b-lead", id] });
    qc.invalidateQueries({ queryKey: ["admin-b2b-leads"] });
  };

  const mStatus = useMutation({
    mutationFn: (status: B2bLead["status"]) => updFn({ data: { id, status } }),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const mAdminNote = useMutation({
    mutationFn: () => updFn({ data: { id, admin_note: (adminNote ?? "").trim() || null } }),
    onSuccess: () => { toast.success("Note saved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const mAddNote = useMutation({
    mutationFn: () => addNoteFn({ data: { lead_id: id, body: note.trim() } }),
    onSuccess: () => { setNote(""); toast.success("Note added"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not add"),
  });

  const mDelNote = useMutation({
    mutationFn: (noteId: string) => delNoteFn({ data: { id: noteId } }),
    onSuccess: () => { toast.success("Note deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  const copy = (s: string | null) => { if (s) navigator.clipboard.writeText(s).then(() => toast.success("Copied")); };

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) {
    return (
      <div className="space-y-4">
        <Link to="/admin/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Lead not found.</CardContent></Card>
      </div>
    );
  }

  const { lead, history, notes } = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to leads</Link>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{lead.full_name}</h1>
          <p className="text-sm text-muted-foreground">{lead.company ?? "—"} · {lead.country_city ?? "—"} · {new Date(lead.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`capitalize ${STATUS_COLOR[lead.status] ?? ""}`}>{lead.status}</Badge>
          <select
            value={lead.status}
            onChange={(e) => mStatus.mutate(e.target.value as B2bLead["status"])}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Request</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business type" value={lead.business_type} />
              <Field label="Preferred contact" value={lead.contact_preference} />
              <Field label="Products of interest" value={lead.products_interest} full />
              <Field label="Estimated volume" value={lead.estimated_volume} />
              <Field label="Message" value={lead.message} full />
              {lead.contacted_at && <Field label="Contacted at" value={new Date(lead.contacted_at).toLocaleString()} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note visible to admins only" />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!note.trim() || mAddNote.isPending} onClick={() => mAddNote.mutate()}>Add note</Button>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {notes.length === 0 && <li className="py-4 text-sm text-muted-foreground">No notes yet.</li>}
                {notes.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => mDelNote.mutate(n.id)} aria-label="Delete note">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Status history</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No status changes yet.</p>
              ) : (
                <ol className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground/50" />
                      <div className="min-w-0">
                        <p>
                          <span className="capitalize text-muted-foreground">{h.from_status ?? "—"}</span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-medium capitalize">{h.to_status}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
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
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="truncate hover:underline">{lead.email}</a>
                <button onClick={() => copy(lead.email)} className="ms-auto text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="truncate hover:underline">{lead.phone}</a>
                  <button onClick={() => copy(lead.phone)} className="ms-auto text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Admin note (pinned)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={6} value={adminNote ?? ""} onChange={(e) => setAdminNote(e.target.value)} placeholder="Top-of-mind note for this lead" />
              <div className="flex justify-end">
                <Button size="sm" disabled={mAdminNote.isPending} onClick={() => mAdminNote.mutate()}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value ?? "—"}</p>
    </div>
  );
}