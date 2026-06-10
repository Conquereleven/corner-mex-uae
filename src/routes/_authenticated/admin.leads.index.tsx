import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Mail, Phone, CheckCircle2 } from "lucide-react";
import { adminListB2bLeads, adminUpdateB2bLead, type B2bLead } from "@/lib/b2b-leads.functions";

export const Route = createFileRoute("/_authenticated/admin/leads/")({
  head: () => ({ meta: [{ title: "Admin — B2B leads" }] }),
  component: AdminLeads,
});

const STATUSES = ["all", "new", "contacted", "quoting", "closed", "lost"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_COLOR: Record<string, string> = {
  new: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  contacted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  quoting: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  closed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function AdminLeads() {
  const listFn = useServerFn(adminListB2bLeads);
  const updFn = useServerFn(adminUpdateB2bLead);
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-b2b-leads", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const m = useMutation({
    mutationFn: (input: { id: string; status?: B2bLead["status"]; admin_note?: string | null }) =>
      updFn({ data: input }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-b2b-leads"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const copy = (s: string | null) => {
    if (!s) return;
    navigator.clipboard.writeText(s).then(() => toast.success("Copied"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">B2B leads</h1>
        <p className="text-sm text-muted-foreground">Wholesale enquiries submitted from the For Business page.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition ${status === s ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72" />
      ) : (q.data ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No leads in this view yet.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{(q.data ?? []).length} leads</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {(q.data ?? []).map((l) => {
                const open = openId === l.id;
                return (
                  <li key={l.id} className="px-6 py-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.full_name}{l.company ? ` · ${l.company}` : ""}</p>
                        <p className="truncate text-xs text-muted-foreground">{l.business_type ?? "—"} · {l.country_city ?? "—"}</p>
                      </div>
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> <span className="truncate">{l.email}</span><button onClick={() => copy(l.email)} className="ms-1 text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button></div>
                        {l.phone && <div className="mt-0.5 flex items-center gap-1.5 truncate"><Phone className="h-3 w-3" /> <span className="truncate">{l.phone}</span><button onClick={() => copy(l.phone)} className="ms-1 hover:text-foreground"><Copy className="h-3 w-3" /></button></div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`capitalize ${STATUS_COLOR[l.status] ?? ""}`}>{l.status}</Badge>
                        <span className="text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        {l.status === "new" && (
                          <Button size="sm" variant="outline" onClick={() => m.mutate({ id: l.id, status: "contacted" })}>
                            <CheckCircle2 className="me-1 h-3.5 w-3.5" /> Mark contacted
                          </Button>
                        )}
                        <select
                          value={l.status}
                          onChange={(e) => m.mutate({ id: l.id, status: e.target.value as B2bLead["status"] })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
                        >
                          {STATUSES.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : l.id)}>{open ? "Hide" : "Quick"}</Button>
                        <Link to="/admin/leads/$id" params={{ id: l.id }}>
                          <Button size="sm" variant="outline">Open</Button>
                        </Link>
                      </div>
                    </div>
                    {open && (
                      <div className="mt-4 grid gap-4 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-2">
                        <div className="space-y-2 text-sm">
                          <Field label="Products of interest" value={l.products_interest} />
                          <Field label="Estimated volume" value={l.estimated_volume} />
                          <Field label="Preferred contact" value={l.contact_preference} />
                          <Field label="Message" value={l.message} />
                          {l.contacted_at && <Field label="Contacted at" value={new Date(l.contacted_at).toLocaleString()} />}
                        </div>
                        <NoteEditor lead={l} onSave={(note) => m.mutate({ id: l.id, admin_note: note })} saving={m.isPending} />
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value ?? "—"}</p>
    </div>
  );
}

function NoteEditor({ lead, onSave, saving }: { lead: B2bLead; onSave: (n: string | null) => void; saving: boolean }) {
  const [note, setNote] = useState(lead.admin_note ?? "");
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Internal note</p>
      <Textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes visible to admins only" />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={saving} onClick={() => onSave(note.trim() || null)}>Save note</Button>
      </div>
    </div>
  );
}