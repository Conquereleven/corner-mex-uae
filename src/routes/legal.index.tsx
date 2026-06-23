import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { LEGAL_INDEX } from "@/lib/legal-docs";
import { FileText, ShieldCheck } from "lucide-react";

const TITLE = "Legal & Compliance Center — Corner Mex";
const DESC = "Terms, privacy, cookies, returns, AI transparency, seller and security policies for the Corner Mex UAE marketplace.";

export const Route = createFileRoute("/legal/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://corner-mex-uae.lovable.app/legal" },
    ],
    links: [{ rel: "canonical", href: "https://corner-mex-uae.lovable.app/legal" }],
  }),
  component: LegalIndex,
});

function LegalIndex() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Legal Center
        </div>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Policies, transparency and your rights</h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Everything that governs your use of Corner Mex as a buyer or seller in the UAE — including how our CornerOps AI features work and how we protect your data. These documents are working templates pending review by qualified UAE legal counsel.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEGAL_INDEX.map((d) => (
            <Link
              key={d.slug}
              to="/legal/$slug"
              params={{ slug: d.slug }}
              className="group flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/40"
            >
              <div className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <Badge variant="outline" className="text-[10px]">v{d.version}</Badge>
              </div>
              <h2 className="mt-4 font-display text-xl tracking-tight group-hover:underline">{d.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{d.summary}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
                <span>Updated {new Date(d.lastUpdated).toLocaleDateString("en-AE", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className={d.reviewStatus === "Approved" ? "text-emerald-700" : "text-amber-700"}>{d.reviewStatus}</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          Contact: legal@cornermex.ae · privacy@cornermex.ae · support@cornermex.ae · complaints@cornermex.ae
        </p>

        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900">
          <p className="font-medium">Arabic readiness</p>
          <p className="mt-1">
            Arabic versions of consumer-facing legal documents, invoices, and key product/contracting information must be prepared and reviewed before full UAE public launch. These templates are currently in English and pending review by qualified UAE legal counsel.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}