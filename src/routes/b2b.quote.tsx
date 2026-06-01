import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitQuote } from "@/lib/quotes.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/b2b/quote")({
  head: () => ({ meta: [{ title: "Request a quote — Corner Mex" }] }),
  component: QuoteRequest,
});

type Row = { name: string; qty: number; notes: string };

function QuoteRequest() {
  const nav = useNavigate();
  const fn = useServerFn(submitQuote);
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);

  const [form, setForm] = useState({ company_name: "", contact_email: "", contact_phone: "", notes: "" });
  const [rows, setRows] = useState<Row[]>([{ name: "", qty: 1, notes: "" }]);

  const m = useMutation({
    mutationFn: () => fn({
      data: {
        company_name: form.company_name || null,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || null,
        notes: form.notes || null,
        items: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), qty: r.qty, notes: r.notes || null })),
      },
    }),
    onSuccess: (q: any) => {
      toast.success(`Quote ${q.quote_number} submitted`);
      nav({ to: "/account/quotes" });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit"),
  });

  if (authed === false) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-3xl">Sign in to request a quote</h1>
          <p className="mt-3 text-sm text-muted-foreground">Quotes are tied to your business account.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login"><Button variant="outline" className="rounded-full">Sign in</Button></Link>
            <Link to="/signup"><Button className="rounded-full">Create account</Button></Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const valid = form.contact_email && rows.some((r) => r.name.trim() && r.qty > 0);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight">Request a wholesale quote</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tell us what you need. We respond within one business day with availability, pricing and SLA.</p>

        <form onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }} className="mt-8 space-y-6">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Optional" /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+971…" /></div>
              <div className="sm:col-span-2"><Label>Email *</Label><Input required type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_100px_1fr_auto]">
                  <Input placeholder="Product or description" value={r.name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input type="number" min={1} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                  <Input placeholder="Notes (size, brand…)" value={r.notes} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={rows.length >= 40} onClick={() => setRows([...rows, { name: "", qty: 1, notes: "" }])}>
                <Plus className="me-2 h-4 w-4" /> Add item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Delivery preferences, required dates, payment terms…" />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link to="/b2b"><Button type="button" variant="outline" className="rounded-full">Cancel</Button></Link>
            <Button type="submit" disabled={!valid || m.isPending} className="rounded-full">
              {m.isPending ? "Submitting…" : "Submit quote request"}
            </Button>
          </div>
        </form>
      </section>
    </SiteLayout>
  );
}