import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles, TrendingUp, ShieldAlert, Lightbulb, Brain } from "lucide-react";
import type { LiveView } from "@/lib/live-view.functions";

type Severity = "info" | "opportunity" | "warning" | "critical";

type Anomaly = {
  id: string;
  title: string;
  severity: Severity;
  evidence: string;
  action: string;
  hypotheses?: string[];
};

const SEV: Record<Severity, { icon: any; badge: string; wrap: string; label: string }> = {
  info:        { icon: Sparkles,     badge: "bg-muted text-foreground",                             wrap: "border-border",                       label: "Info" },
  opportunity: { icon: TrendingUp,   badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", wrap: "border-emerald-500/30",           label: "Opportunity" },
  warning:     { icon: AlertTriangle,badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",  wrap: "border-amber-500/30",                 label: "Possible issue" },
  critical:    { icon: ShieldAlert,  badge: "bg-red-500/15 text-red-700 dark:text-red-300",        wrap: "border-red-500/40",                   label: "Recommended review" },
};

function buildAnomalies(d: LiveView): Anomaly[] {
  const out: Anomaly[] = [];
  const k = d.kpis;

  if (k.cartAbandonment > 0.7 && (d.behavior.activeCarts > 0 || k.totalOrders > 0)) {
    out.push({
      id: "cart-abandon",
      title: "High cart abandonment",
      severity: "warning",
      evidence: `Cart abandonment at ${(k.cartAbandonment * 100).toFixed(0)}% across today's sessions.`,
      action: "Review cart friction: shipping cost, delivery estimate, or account requirement.",
      hypotheses: [
        "Shipping cost friction near the free-shipping threshold",
        "Unclear delivery estimate at cart step",
        "Payment method not eligible for cart total",
      ],
    });
  }

  if (k.checkoutAbandonment > 0.5 && d.behavior.checkingOut > 0) {
    out.push({
      id: "checkout-drop",
      title: "Checkout drop-off detected",
      severity: "critical",
      evidence: `${(k.checkoutAbandonment * 100).toFixed(0)}% of checkouts did not convert.`,
      action: "Inspect payment errors and BNPL eligibility for recent sessions.",
      hypotheses: [
        "Payment provider outage or 3DS failure",
        "Tabby / Tamara eligibility rejected",
        "COD unavailable for the customer's emirate",
      ],
    });
  }

  if (k.conversionRate > 0.05 && k.totalOrders > 0) {
    out.push({
      id: "strong-cr",
      title: "Strong conversion signal",
      severity: "opportunity",
      evidence: `Conversion rate at ${(k.conversionRate * 100).toFixed(1)}% today.`,
      action: "Consider increasing ad spend on top-performing traffic sources.",
      hypotheses: [
        "Recent campaign is landing well",
        "Top product has strong demand fit",
      ],
    });
  }

  if (k.visitorsNow === 0 && k.totalSessionsToday === 0) {
    out.push({
      id: "no-traffic",
      title: "No storefront traffic",
      severity: "warning",
      evidence: "No visitors detected in the last 10 minutes and no sessions today.",
      action: "Verify tracking is firing and campaigns are live.",
      hypotheses: [
        "Analytics event pipeline paused",
        "Ad campaigns disabled or budget exhausted",
      ],
    });
  }

  // Sales spike: last-hour bucket dominates
  const hs = d.hourlySales ?? [];
  if (hs.length >= 3) {
    const last = hs[hs.length - 1];
    const prevAvg = hs.slice(-6, -1).reduce((a, b) => a + b, 0) / Math.max(1, hs.slice(-6, -1).length);
    if (last > 0 && last > prevAvg * 2 && prevAvg > 0) {
      out.push({
        id: "sales-spike",
        title: "Sales spike in the last hour",
        severity: "opportunity",
        evidence: `Last hour sales are ${(last / prevAvg).toFixed(1)}× the recent average.`,
        action: "Verify stock and shipping capacity to sustain the surge.",
        hypotheses: [
          "Campaign or influencer post going live",
          "Organic viral moment on a product",
        ],
      });
    }
  }

  // Product concentration
  const tp = d.topProducts ?? [];
  const totalRev = tp.reduce((a, b) => a + b.revenue, 0);
  if (tp.length > 0 && totalRev > 0 && tp[0].revenue / totalRev > 0.6) {
    out.push({
      id: "concentration",
      title: "Revenue concentrated in one product",
      severity: "info",
      evidence: `${tp[0].name} contributes ${((tp[0].revenue / totalRev) * 100).toFixed(0)}% of today's revenue.`,
      action: "Ensure inventory depth and diversify featured products on the home page.",
      hypotheses: [
        "Homepage merchandising over-indexes one SKU",
        "Complementary products lack visibility",
      ],
    });
  }

  return out;
}

export function CommerceAnomalies({ d }: { d?: LiveView }) {
  const anomalies = d ? buildAnomalies(d) : [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-muted-foreground" />
          Commerce anomalies
        </CardTitle>
        <Badge variant="outline" className="text-[10px] font-normal">CornerOps AI-ready</Badge>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No anomalies detected. Signals will surface here as they emerge.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {anomalies.map((a) => {
              const sev = SEV[a.severity];
              const Icon = sev.icon;
              return (
                <li key={a.id} className={`rounded-lg border ${sev.wrap} bg-background p-3`}>
                  <div className="flex items-start gap-2">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${sev.badge}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{a.title}</span>
                        <Badge variant="outline" className="text-[9px] font-normal uppercase tracking-wide">
                          {sev.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.evidence}</p>
                      <p className="mt-1.5 flex items-start gap-1 text-[11px] text-foreground">
                        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span>{a.action}</span>
                      </p>
                      {a.hypotheses && a.hypotheses.length > 0 && (
                        <div className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2">
                          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                            Hypotheses · AI review recommended
                          </div>
                          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                            {a.hypotheses.map((h, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span className="text-muted-foreground/60">·</span>
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}