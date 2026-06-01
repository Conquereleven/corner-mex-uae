import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { ClipboardList, Mail, Truck } from "lucide-react";

export const Route = createFileRoute("/b2b")({
  head: () => ({
    meta: [
      { title: "For Business — Corner Mex" },
      { name: "description", content: "Wholesale Mexican supply for UAE restaurants, hotels, caterings and supermarkets." },
    ],
  }),
  component: B2B,
});

function B2B() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">For business</span>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Wholesale Mexican supply for the UAE.</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Open a verified business account to access wholesale pricing, custom catalogues, monthly invoicing and dedicated account managers across all 7 Emirates.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/b2b/quote"><Button size="lg" className="rounded-full">Request a quote</Button></Link>
          <a href="mailto:b2b@cornermex.ae"><Button size="lg" variant="outline" className="rounded-full"><Mail className="me-2 h-4 w-4" /> Contact sales</Button></a>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { icon: ClipboardList, t: "Tailored catalogues", b: "Tell us what you need; we curate from trusted producers." },
            { icon: Truck, t: "All 7 Emirates", b: "Shipping zones and SLAs covering UAE-wide delivery." },
            { icon: Mail, t: "Account manager", b: "A single point of contact handles your monthly orders." },
          ].map(({ icon: Icon, t, b }) => (
            <div key={t} className="rounded-2xl border border-border p-5">
              <Icon className="h-5 w-5" />
              <h3 className="mt-3 font-medium">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}