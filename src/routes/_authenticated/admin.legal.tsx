import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEGAL_INDEX } from "@/lib/legal-docs";
import { ExternalLink, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/legal")({
  component: AdminLegal,
});

function AdminLegal() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal & Compliance"
        subtitle="Templates pending UAE legal review. Full editing, publishing and archival will plug into this view."
      />
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Last updated</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {LEGAL_INDEX.map((d) => (
              <tr key={d.slug} className="border-t border-border/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {d.title}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{d.summary}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">v{d.version}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(d.lastUpdated).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={d.reviewStatus === "Approved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>
                    {d.reviewStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to="/legal/$slug" params={{ slug: d.slug }} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      View <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Future actions: edit, publish new version, archive, and assign legal owner. Documents are currently sourced from <code>src/lib/legal-docs.ts</code>.
      </p>
    </div>
  );
}