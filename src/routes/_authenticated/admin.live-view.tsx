import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/site/PageHeader";
import { Globe2, Users, ShoppingBag, DollarSign, BadgeCheck, TrendingUp, Percent, ShoppingCart, UserPlus } from "lucide-react";
import { getLiveView, type LiveView } from "@/lib/live-view.functions";

const LiveGlobe = lazy(() =>
  import("@/components/site/LiveGlobe").then((m) => ({ default: m.LiveGlobe })),
);

export const Route = createFileRoute("/_authenticated/admin/live-view")({
  head: () => ({ meta: [{ title: "Admin — Live view" }] }),
  component: AdminLiveView,
});

const N = (n: number) => (n ?? 0).toLocaleString("en-US");
const AED = (n: number) =>
  `AED ${(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;

function AdminLiveView() {
  const fn = useServerFn(getLiveView);
  const q = useQuery<LiveView>({
    queryKey: ["admin-live-view"],
    queryFn: () => fn({}),
    refetchInterval: 15_000,
  });
  const d = q.data;
  const maxBar = Math.max(1, ...(d?.pageViews ?? [1]));
  const maxHourly = Math.max(1, ...(d?.hourlySales ?? [1]));
  const newReturnTotal = (d?.kpis.newVisitors ?? 0) + (d?.kpis.returningVisitors ?? 0);
  const newPct = newReturnTotal ? ((d?.kpis.newVisitors ?? 0) / newReturnTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe2}
        title="Live view"
        description={d ? `Updated ${new Date(d.generatedAt).toLocaleTimeString()} · last 10 min` : "Loading real-time storefront activity…"}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Suspense fallback={<div className="h-[520px] rounded-2xl border border-border bg-muted/30" />}>
          <LiveGlobe points={d?.orderPoints ?? []} arcs={d?.arcs ?? []} height={520} />
        </Suspense>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Kpi icon={Users} label="Visitors right now" value={N(d?.kpis.visitorsNow ?? 0)} />
            <Kpi icon={ShoppingBag} label="Sessions today" value={N(d?.kpis.totalSessionsToday ?? 0)} />
            <Kpi icon={DollarSign} label="Total sales" value={AED(d?.kpis.totalSales ?? 0)} />
            <Kpi icon={BadgeCheck} label="Total orders" value={N(d?.kpis.totalOrders ?? 0)} />
            <Kpi icon={TrendingUp} label="AOV" value={AED(d?.kpis.aov ?? 0)} />
            <Kpi icon={Percent} label="Conversion rate" value={PCT(d?.kpis.conversionRate ?? 0)} />
            <Kpi icon={ShoppingCart} label="Cart abandonment" value={PCT(d?.kpis.cartAbandonment ?? 0)} />
            <Kpi icon={UserPlus} label="New visitors" value={`${N(d?.kpis.newVisitors ?? 0)} · ${newPct.toFixed(0)}%`} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Customer behavior · 10 min</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end justify-around gap-3 py-3">
                <Bubble label="Active carts" value={d?.behavior.activeCarts ?? 0} tone="muted" />
                <Connector />
                <Bubble label="Checking out" value={d?.behavior.checkingOut ?? 0} tone="brand" />
                <Connector />
                <Bubble label="Purchased" value={d?.behavior.purchased ?? 0} tone="success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Page views · 10 min</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-24 items-end gap-1">
                {(d?.pageViews ?? new Array(10).fill(0)).map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-foreground/70"
                    style={{ height: `${(v / maxBar) * 100}%`, minHeight: 2 }}
                    title={`${v} views`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>10 min ago</span><span>Now</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sales · last 24 h</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-1">
            {(d?.hourlySales ?? new Array(24).fill(0)).map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/80"
                style={{ height: `${(v / maxHourly) * 100}%`, minHeight: 2 }}
                title={`${AED(v)} · ${d?.hourlyOrders?.[i] ?? 0} orders`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>24 h ago</span><span>Peak: {AED(maxHourly)}</span><span>Now</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top locations today</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(d?.topLocations ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet today.</p>
            )}
            {(d?.topLocations ?? []).map((l) => {
              const max = Math.max(...(d?.topLocations.map((x) => x.sales) ?? [1]));
              return (
                <div key={l.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{l.label}</span>
                    <span className="text-xs text-muted-foreground">{AED(l.sales)} · {l.sessions} orders</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(l.sales / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top products today</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(d?.topProducts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No purchases yet today.</p>
            )}
            {(d?.topProducts ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug ?? "" }}
                  className="truncate font-medium hover:underline"
                >
                  {p.name}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.units} units · {AED(p.revenue)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top traffic sources today</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(d?.topSources ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No traffic attribution yet today.</p>
          )}
          {(d?.topSources ?? []).map((s) => {
            const max = Math.max(...(d?.topSources.map((x) => x.sessions) ?? [1]));
            return (
              <div key={s.source}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium capitalize">{s.source}</span>
                  <span className="text-xs text-muted-foreground">
                    {N(s.sessions)} sessions · {N(s.orders)} orders · {PCT(s.conversion)} CR
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(s.sessions / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function Bubble({ label, value, tone }: { label: string; value: number; tone: "muted" | "brand" | "success" }) {
  const size = Math.min(96, 36 + Math.log2(value + 1) * 14);
  const cls =
    tone === "brand" ? "bg-primary/15 ring-primary/40 text-primary"
    : tone === "success" ? "bg-emerald-500/15 ring-emerald-500/40 text-emerald-600 dark:text-emerald-400"
    : "bg-muted ring-border text-foreground";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`grid place-items-center rounded-full ring-2 ${cls}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function Connector() {
  return <div className="h-px w-6 bg-border" />;
}