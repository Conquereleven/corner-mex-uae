import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles, TrendingUp, ShieldAlert, Lightbulb, Brain } from "lucide-react";
import type { LiveView } from "@/lib/live-view.functions";
import type { AnomalyCandidate } from "@/lib/anomaly-cases.functions";

type Severity = "info" | "opportunity" | "warning" | "critical";

type Anomaly = {
  id: string;
  anomalyKey: string;
  type: string;
  title: string;
  severity: Severity;
  evidence: string;
  action: string;
  hypotheses?: string[];
  emirateCode?: string;
  emirateName?: string;
  productSlug?: string;
  productName?: string;
  confidenceScore?: number;
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
      anomalyKey: "global:cart-abandonment",
      type: "cart_abandonment",
      title: "High cart abandonment",
      severity: "warning",
      evidence: `Cart abandonment at ${(k.cartAbandonment * 100).toFixed(0)}% across today's sessions.`,
      action: "Review cart friction: shipping cost, delivery estimate, or account requirement.",
      confidenceScore: 0.7,
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
      anomalyKey: "global:checkout-drop",
      type: "checkout_drop",
      title: "Checkout drop-off detected",
      severity: "critical",
      evidence: `${(k.checkoutAbandonment * 100).toFixed(0)}% of checkouts did not convert.`,
      action: "Inspect payment errors and BNPL eligibility for recent sessions.",
      confidenceScore: 0.8,
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
      anomalyKey: "global:strong-conversion",
      type: "opportunity_conversion",
      title: "Strong conversion signal",
      severity: "opportunity",
      evidence: `Conversion rate at ${(k.conversionRate * 100).toFixed(1)}% today.`,
      action: "Consider increasing ad spend on top-performing traffic sources.",
      confidenceScore: 0.6,
      hypotheses: [
        "Recent campaign is landing well",
        "Top product has strong demand fit",
      ],
    });
  }

  if (k.visitorsNow === 0 && k.totalSessionsToday === 0) {
    out.push({
      id: "no-traffic",
      anomalyKey: "global:no-traffic",
      type: "no_traffic",
      title: "No storefront traffic",
      severity: "warning",
      evidence: "No visitors detected in the last 10 minutes and no sessions today.",
      action: "Verify tracking is firing and campaigns are live.",
      confidenceScore: 0.5,
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
        anomalyKey: "global:sales-spike",
        type: "sales_spike",
        title: "Sales spike in the last hour",
        severity: "opportunity",
        evidence: `Last hour sales are ${(last / prevAvg).toFixed(1)}× the recent average.`,
        action: "Verify stock and shipping capacity to sustain the surge.",
        confidenceScore: 0.65,
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
      anomalyKey: `product-concentration:${tp[0].id}`,
      type: "revenue_concentration",
      title: "Revenue concentrated in one product",
      severity: "info",
      evidence: `${tp[0].name} contributes ${((tp[0].revenue / totalRev) * 100).toFixed(0)}% of today's revenue.`,
      action: "Ensure inventory depth and diversify featured products on the home page.",
      productSlug: tp[0].slug,
      productName: tp[0].name,
      confidenceScore: 0.55,
      hypotheses: [
        "Homepage merchandising over-indexes one SKU",
        "Complementary products lack visibility",
      ],
    });
  }

  // ---- Location-aware signals ----
  const loc = d.locationSummary ?? [];
  const active = loc.filter((l) => l.orders > 0);
  if (active.length > 0) {
    const totalSales = active.reduce((a, b) => a + b.salesAed, 0);
    const topEmirate = [...active].sort((a, b) => b.salesAed - a.salesAed)[0];
    if (topEmirate && totalSales > 0 && topEmirate.salesAed / totalSales > 0.6) {
      out.push({
        id: `emirate-concentration-${topEmirate.emirateCode}`,
        anomalyKey: `emirate-concentration:${topEmirate.emirateCode}`,
        type: "emirate_concentration",
        title: `Revenue concentrated in ${topEmirate.emirateName}`,
        severity: "info",
        evidence: `${topEmirate.emirateName} accounts for ${((topEmirate.salesAed / totalSales) * 100).toFixed(0)}% of paid revenue today.`,
        action: "Recommended review: diversify demand across other emirates.",
        emirateCode: topEmirate.emirateCode,
        emirateName: topEmirate.emirateName,
        confidenceScore: 0.55,
        hypotheses: ["Campaign geo-targeting skewed to Dubai", "Delivery friction outside top emirate"],
      });
    }
    // Best-converting emirate (only when session data exists — currently not available)
    const withCr = active.filter((l) => l.conversionRate != null);
    if (withCr.length > 0) {
      const best = [...withCr].sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))[0];
      if (best && (best.conversionRate ?? 0) > 0.05) {
        out.push({
          id: `emirate-strong-cr-${best.emirateCode}`,
          anomalyKey: `emirate-strong-cr:${best.emirateCode}`,
          type: "emirate_strong_cr",
          title: `Strong conversion in ${best.emirateName}`,
          severity: "opportunity",
          evidence: `Conversion at ${((best.conversionRate ?? 0) * 100).toFixed(1)}% in ${best.emirateName}.`,
          action: "Suggested signal: expand paid reach in this emirate.",
          emirateCode: best.emirateCode,
          emirateName: best.emirateName,
          confidenceScore: 0.6,
        });
      }
    }
  } else if ((d.locationSummary?.length ?? 0) > 0) {
    out.push({
      id: "no-emirate-activity",
      anomalyKey: "global:no-emirate-activity",
      type: "no_emirate_activity",
      title: "No paid orders across the UAE",
      severity: "warning",
      evidence: "No paid orders detected in any emirate in the last 24h.",
      action: "Recommended review: verify demand pipeline and campaign delivery.",
      confidenceScore: 0.5,
    });
  }

  return out;
}

export function CommerceAnomalies({
  d,
  onTrackCase,
  trackedKeys,
}: {
  d?: LiveView;
  onTrackCase?: (candidate: AnomalyCandidate) => void;
  trackedKeys?: Set<string>;
}) {
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
              const tracked = trackedKeys?.has(a.anomalyKey);
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
                        {a.emirateName && (
                          <Badge variant="secondary" className="text-[9px] font-normal">{a.emirateName}</Badge>
                        )}
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
                      {onTrackCase && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant={tracked ? "secondary" : "outline"}
                            className="h-7 text-[11px]"
                            disabled={tracked}
                            onClick={() =>
                              onTrackCase({
                                anomalyKey: a.anomalyKey,
                                type: a.type,
                                severity: a.severity,
                                title: a.title,
                                suggestedAction: a.action,
                                evidence: { text: a.evidence },
                                hypotheses: a.hypotheses,
                                emirateCode: a.emirateCode ?? null,
                                emirateName: a.emirateName ?? null,
                                productSlug: a.productSlug ?? null,
                                confidenceScore: a.confidenceScore ?? null,
                              })
                            }
                          >
                            {tracked ? "Tracked as case" : "Track as case"}
                          </Button>
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