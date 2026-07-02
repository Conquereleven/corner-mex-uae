import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LEGAL_INDEX, BUSINESS_MODEL } from "@/lib/legal-docs";
import { AlertTriangle, ExternalLink, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/legal")({
  component: AdminLegal,
});

function AdminLegal() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal & Compliance"
        description="Templates pending UAE legal review. Full editing, publishing and archival will plug into this view."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-card p-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current model</div>
          <p className="mt-1 font-medium text-foreground">First-party e-commerce</p>
          <p className="mt-1 text-xs text-muted-foreground">Seller of record: {BUSINESS_MODEL.sellerOfRecord}. {BUSINESS_MODEL.supplierModel}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Future model</div>
          <p className="mt-1 font-medium text-foreground">Marketplace — Phase 2</p>
          <p className="mt-1 text-xs text-muted-foreground">{BUSINESS_MODEL.marketplaceStatus}</p>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Do not activate marketplace/seller onboarding until the Seller Agreement, KYC/KYB, product compliance, payment flows and UAE legal review are complete.
        </p>
      </div>
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={d.reviewStatus === "Approved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>
                      {d.reviewStatus}
                    </Badge>
                    {d.lifecycle === "phase-2-draft" && (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">Phase 2 · Not active</Badge>
                    )}
                  </div>
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