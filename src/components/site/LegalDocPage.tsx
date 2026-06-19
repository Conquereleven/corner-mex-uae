import { Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { getLegalDoc, LEGAL_DOCS, type LegalDoc, type ReviewStatus } from "@/lib/legal-docs";
import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";

function statusTone(s: ReviewStatus) {
  if (s === "Approved") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (s === "Draft") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/10 text-amber-700 border-amber-500/30";
}

export function LegalDocPage({ slug }: { slug: string }) {
  const doc = getLegalDoc(slug);
  if (!doc) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <h1 className="font-display text-3xl tracking-tight">Document not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">The legal document you're looking for doesn't exist.</p>
          <Link to="/legal" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground underline">
            <ArrowLeft className="h-4 w-4" /> Back to Legal Center
          </Link>
        </section>
      </SiteLayout>
    );
  }
  return <LegalDocBody doc={doc} />;
}

function LegalDocBody({ doc }: { doc: LegalDoc }) {
  const related = LEGAL_DOCS.filter((d) => d.slug !== doc.slug).slice(0, 4);
  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/legal" className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Legal Center
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusTone(doc.reviewStatus)}>{doc.reviewStatus}</Badge>
          <Badge variant="outline">v{doc.version}</Badge>
          <Badge variant="outline">Last updated {new Date(doc.lastUpdated).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}</Badge>
        </div>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{doc.title}</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">{doc.summary}</p>
        {doc.reviewStatus !== "Approved" && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This document is a working template and must be reviewed by qualified UAE legal counsel before publication.</p>
          </div>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
            <nav className="mt-3 space-y-1.5 text-sm">
              {doc.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block truncate text-muted-foreground hover:text-foreground">
                  {s.heading}
                </a>
              ))}
            </nav>
          </aside>
          <article className="max-w-3xl">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-border/60 py-8 first:border-t-0 first:pt-0">
                <h2 className="font-display text-2xl tracking-tight">{s.heading}</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90">
                  {s.body.map((p, i) => <p key={i}>{p}</p>)}
                  {s.list && (
                    <ul className="ml-5 list-disc space-y-1.5 text-foreground/90">
                      {s.list.map((li, i) => <li key={i}>{li}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </article>
        </div>

        <div className="mt-16 border-t border-border/60 pt-10">
          <h3 className="font-display text-xl tracking-tight">Related policies</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <Link key={r.slug} to="/legal/$slug" params={{ slug: r.slug }} className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-foreground/40">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground group-hover:underline">{r.shortTitle}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}