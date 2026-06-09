import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitB2bLead } from "@/lib/b2b-leads.functions";

export const Route = createFileRoute("/b2b/lead")({
  head: () => ({
    meta: [
      { title: "Request a wholesale quote — Corner Mex" },
      { name: "description", content: "Tell us about your business and we'll respond with availability, pricing and SLA within one business day." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadForm,
});

type Form = {
  full_name: string;
  company: string;
  email: string;
  phone: string;
  country_city: string;
  business_type: string;
  products_interest: string;
  estimated_volume: string;
  message: string;
  contact_preference: string;
};

const EMPTY: Form = {
  full_name: "", company: "", email: "", phone: "", country_city: "",
  business_type: "", products_interest: "", estimated_volume: "",
  message: "", contact_preference: "email",
};

function LeadForm() {
  const fn = useServerFn(submitB2bLead);
  const [f, setF] = useState<Form>(EMPTY);
  const [done, setDone] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          full_name: f.full_name.trim(),
          company: f.company.trim() || null,
          email: f.email.trim(),
          phone: f.phone.trim() || null,
          country_city: f.country_city.trim() || null,
          business_type: f.business_type.trim() || null,
          products_interest: f.products_interest.trim() || null,
          estimated_volume: f.estimated_volume.trim() || null,
          message: f.message.trim() || null,
          contact_preference: f.contact_preference || null,
        },
      }),
    onSuccess: (r: any) => {
      setDone(true);
      toast.success(r.duplicate ? "We already received your request" : "Request submitted — we'll be in touch.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit"),
  });

  const valid = f.full_name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email);

  if (done) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-4xl tracking-tight">Thank you</h1>
          <p className="mt-3 text-muted-foreground">
            We received your enquiry and will respond within one business day.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/shop"><Button variant="outline" className="rounded-full">Browse shop</Button></Link>
            <Link to="/b2b"><Button className="rounded-full">Back to B2B</Button></Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight">Request a wholesale quote</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your business and what you need. We respond within one business day.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (valid && !m.isPending) m.mutate(); }}
          className="mt-8 space-y-6"
        >
          <Card>
            <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><Label>Full name *</Label><Input required maxLength={200} value={f.full_name} onChange={(e) => upd("full_name", e.target.value)} /></div>
              <div><Label>Company</Label><Input maxLength={200} value={f.company} onChange={(e) => upd("company", e.target.value)} /></div>
              <div><Label>Email *</Label><Input required type="email" maxLength={320} value={f.email} onChange={(e) => upd("email", e.target.value)} /></div>
              <div><Label>Phone / WhatsApp</Label><Input maxLength={60} placeholder="+971…" value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></div>
              <div><Label>Country / city</Label><Input maxLength={120} placeholder="Dubai, UAE" value={f.country_city} onChange={(e) => upd("country_city", e.target.value)} /></div>
              <div>
                <Label>Business type</Label>
                <select
                  value={f.business_type}
                  onChange={(e) => upd("business_type", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="hotel">Hotel</option>
                  <option value="catering">Catering</option>
                  <option value="supermarket">Supermarket / retail</option>
                  <option value="distributor">Distributor</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Your needs</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Products of interest</Label><Input maxLength={1000} placeholder="Dried chiles, salsas, masa…" value={f.products_interest} onChange={(e) => upd("products_interest", e.target.value)} /></div>
              <div><Label>Estimated volume</Label><Input maxLength={120} placeholder="50 kg / month" value={f.estimated_volume} onChange={(e) => upd("estimated_volume", e.target.value)} /></div>
              <div>
                <Label>Preferred contact</Label>
                <select
                  value={f.contact_preference}
                  onChange={(e) => upd("contact_preference", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone call</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div className="sm:col-span-2"><Label>Additional message</Label><Textarea rows={4} maxLength={2000} value={f.message} onChange={(e) => upd("message", e.target.value)} /></div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link to="/b2b"><Button type="button" variant="outline" className="rounded-full">Cancel</Button></Link>
            <Button type="submit" disabled={!valid || m.isPending} className="rounded-full">
              {m.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      </section>
    </SiteLayout>
  );
}