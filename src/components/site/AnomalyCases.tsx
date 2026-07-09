import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleDot, Search, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import type { AnomalyEventRow, AnomalyStatus } from "@/lib/anomaly-cases.functions";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  investigating: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  dismissed: "bg-muted text-muted-foreground",
};

const SEV_BADGE: Record<string, string> = {
  info: "bg-muted text-foreground",
  opportunity: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  critical: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(diff / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function AnomalyCasesPanel({
  cases,
  isLoading,
  onUpdateStatus,
}: {
  cases: AnomalyEventRow[];
  isLoading: boolean;
  onUpdateStatus: (id: string, status: AnomalyStatus) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Anomaly Case Mode
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-normal">CornerOps AI-ready</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading cases…</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open cases. Track an anomaly to open one.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {cases.map((c: any) => (
              <li key={c.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{c.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${SEV_BADGE[c.severity] ?? "bg-muted"}`}>
                    {c.severity}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${STATUS_BADGE[c.status] ?? "bg-muted"}`}>
                    {c.status}
                  </span>
                  {c.emirate_name && (
                    <Badge variant="secondary" className="text-[9px] font-normal">{c.emirate_name}</Badge>
                  )}
                </div>
                {c.evidence?.text && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{String(c.evidence.text)}</p>
                )}
                {c.suggested_action && (
                  <p className="mt-1 text-[11px]">{c.suggested_action}</p>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  First {rel(c.first_detected_at)} · Last {rel(c.last_detected_at)}
                  {c.confidence_score != null && ` · confidence ${Math.round(Number(c.confidence_score) * 100)}%`}
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                  {c.status !== "investigating" && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onUpdateStatus(c.id, "investigating")}>
                      <Search className="mr-1 h-3 w-3" /> Investigate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onUpdateStatus(c.id, "dismissed")}>
                    <XCircle className="mr-1 h-3 w-3" /> Dismiss
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onUpdateStatus(c.id, "resolved")}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* TODO CornerOps AI: assignment, comments, audit trail, digest alerts, playbooks. */}
        <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CircleDot className="h-2.5 w-2.5" /> Rule-based signals · CornerOps AI scoring pending.
        </p>
      </CardContent>
    </Card>
  );
}