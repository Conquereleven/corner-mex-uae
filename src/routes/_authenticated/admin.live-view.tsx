import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, ShoppingBag, DollarSign, BadgeCheck, TrendingUp, Percent, ShoppingCart, UserPlus,
  RefreshCw, Pause, Play, Eye, EyeOff, Maximize2, Minimize2, Activity, Eye as EyeIcon,
  Package, CreditCard, CheckCircle2, AlertTriangle, Globe2, Map as MapIcon, Brain,
} from "lucide-react";
import { getLiveView, type LiveView } from "@/lib/live-view.functions";
import { LiveUaeMap } from "@/components/site/LiveUaeMap";
import { CommerceAnomalies } from "@/components/site/CommerceIntelligence";

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
const HIDDEN = "••••";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function AdminLiveView() {
  const fn = useServerFn(getLiveView);
  const [paused, setPaused] = useState(false);
  const [streamer, setStreamer] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = useQuery<LiveView>({
    queryKey: ["admin-live-view"],
    queryFn: () => fn({}),
    refetchInterval: paused ? false : 15_000,
  });
  const d = q.data;
  const [view, setView] = useState<"globe" | "map" | "intel">("globe");
  const maxBar = Math.max(1, ...(d?.pageViews ?? [1]));
  const maxHourly = Math.max(1, ...(d?.hourlySales ?? [1]));
  const newReturnTotal = (d?.kpis.newVisitors ?? 0) + (d?.kpis.returningVisitors ?? 0);
  const returningPct = newReturnTotal ? ((d?.kpis.returningVisitors ?? 0) / newReturnTotal) * 100 : 0;
  const windowLabel = d?.windowLabel ?? "Last 24h";
  const money = (n: number) => (streamer ? HIDDEN : AED(n));

  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  };

  return (
    <div ref={containerRef} className="space-y-6 bg-background">
      <LiveViewCommandBar
        generatedAt={d?.generatedAt}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onRefresh={() => q.refetch()}
        streamer={streamer}
        onToggleStreamer={() => setStreamer((s) => !s)}
        isFs={isFs}
        onToggleFullscreen={toggleFullscreen}
        view={view}
        onViewChange={setView}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {view === "globe" && (
            <Suspense fallback={<div className="h-[520px] rounded-2xl border border-border bg-muted/30" />}>
              <LiveGlobe
                points={d?.orderPoints ?? []}
                arcs={d?.arcs ?? []}
                height={520}
                stats={d?.globeStats}
              />
            </Suspense>
          )}
          {view === "map" && (
            <LiveUaeMap
              topLocations={d?.topLocations ?? []}
              lastLabel={d?.globeStats?.lastLabel}
              streamer={streamer}
              money={money}
            />
          )}
          {view === "intel" && (
            <div className="space-y-4">
              <CommerceAnomalies d={d} />
              <LiveUaeMap
                topLocations={d?.topLocations ?? []}
                lastLabel={d?.globeStats?.lastLabel}
                streamer={streamer}
                money={money}
              />
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <LiveKpiGrid d={d} isLoading={q.isLoading} money={money} windowLabel={windowLabel} returningPct={returningPct} />
          <LiveActivityFeed items={d?.activityFeed ?? []} isLoading={q.isLoading} streamer={streamer} />
          {view !== "intel" && <CommerceAnomalies d={d} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LiveAnalyticsCard title="Customer funnel · 10 min">
          <LiveCustomerFunnel
            activeCarts={d?.behavior.activeCarts ?? 0}
            checkingOut={d?.behavior.checkingOut ?? 0}
            purchased={d?.behavior.purchased ?? 0}
            checkoutAbandonment={d?.kpis.checkoutAbandonment ?? 0}
          />
        </LiveAnalyticsCard>

        <LiveAnalyticsCard title={`Sales · ${windowLabel.toLowerCase()}`}>
          {(d?.hourlySales ?? []).every((v) => !v) ? (
            <EmptyRow label="No sales in this window yet." />
          ) : (
            <>
              <div className="flex h-28 items-end gap-1">
                {(d?.hourlySales ?? new Array(24).fill(0)).map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
                    style={{ height: `${(v / maxHourly) * 100}%`, minHeight: 2 }}
                    title={`${AED(v)} · ${d?.hourlyOrders?.[i] ?? 0} orders`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>24 h ago</span><span>Peak: {money(maxHourly)}</span><span>Now</span>
              </div>
            </>
          )}
        </LiveAnalyticsCard>

        <LiveAnalyticsCard title="Page views · 10 min">
          {(d?.pageViews ?? []).every((v) => !v) ? (
            <EmptyRow label="No page views in the last 10 minutes." />
          ) : (
            <>
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
            </>
          )}
        </LiveAnalyticsCard>

        <LiveAnalyticsCard title={`Top products · ${windowLabel.toLowerCase()}`}>
          {(d?.topProducts ?? []).length === 0 ? (
            <EmptyRow label="No purchases yet." />
          ) : (
            <div className="space-y-2">
              {d!.topProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    to="/product/$slug"
                    params={{ slug: p.slug ?? "" }}
                    className="truncate font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {p.units} units · {money(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </LiveAnalyticsCard>

        <LiveAnalyticsCard title={`Top locations · ${windowLabel.toLowerCase()}`}>
          {(d?.topLocations ?? []).length === 0 ? (
            <EmptyRow label="No paid orders yet." />
          ) : (
            <div className="space-y-2">
              {d!.topLocations.map((l) => {
                const max = Math.max(...d!.topLocations.map((x) => x.sales), 1);
                return (
                  <div key={l.label}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{l.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {money(l.sales)} · {l.orders} orders
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(l.sales / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </LiveAnalyticsCard>

        <LiveAnalyticsCard title={`Traffic sources · ${windowLabel.toLowerCase()}`}>
          {(d?.topSources ?? []).length === 0 ? (
            <EmptyRow label="No traffic attribution yet." />
          ) : (
            <div className="space-y-2">
              {d!.topSources.map((s) => {
                const max = Math.max(...d!.topSources.map((x) => x.sessions), 1);
                return (
                  <div key={s.source}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium capitalize">{s.source}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {N(s.sessions)} sessions · {N(s.orders)} orders · {PCT(s.conversion)} CR
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(s.sessions / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </LiveAnalyticsCard>
      </div>
    </div>
  );
}

function LiveViewCommandBar({
  generatedAt, isLoading, isFetching, paused, onTogglePause, onRefresh,
  streamer, onToggleStreamer, isFs, onToggleFullscreen,
  view, onViewChange,
}: {
  generatedAt?: string; isLoading: boolean; isFetching: boolean;
  paused: boolean; onTogglePause: () => void; onRefresh: () => void;
  streamer: boolean; onToggleStreamer: () => void;
  isFs: boolean; onToggleFullscreen: () => void;
  view: "globe" | "map" | "intel";
  onViewChange: (v: "globe" | "map" | "intel") => void;
}) {
  const dotCls = paused
    ? "bg-amber-500"
    : "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotCls}`} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Commerce Spatial Intelligence</h1>
            {paused && <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            CornerMex storefront activity · signals, orders, carts, and delivery risk
            {generatedAt && (
              <>
                {" · "}Updated {new Date(generatedAt).toLocaleTimeString()}
                {" · "}UAE time
              </>
            )}
            {isLoading && " · loading…"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5 text-[11px]">
          {([
            { id: "globe", label: "Globe", icon: Globe2 },
            { id: "map", label: "UAE Map", icon: MapIcon },
            { id: "intel", label: "Intelligence", icon: Brain },
          ] as const).map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onViewChange(v.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {v.label}
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={onTogglePause}>
          {paused ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button size="sm" variant="outline" onClick={onToggleStreamer}>
          {streamer ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          Streamer
        </Button>
        <Button size="sm" variant="outline" onClick={onToggleFullscreen}>
          {isFs ? <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> : <Maximize2 className="mr-1.5 h-3.5 w-3.5" />}
          {isFs ? "Exit" : "Fullscreen"}
        </Button>
      </div>
    </div>
  );
}

function LiveKpiGrid({
  d, isLoading, money, windowLabel, returningPct,
}: {
  d?: LiveView; isLoading: boolean; money: (n: number) => string;
  windowLabel: string; returningPct: number;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <LiveKpiCard icon={Users} label="Visitors now" value={N(d?.kpis.visitorsNow ?? 0)} helper="live · 10 min" isLoading={isLoading} emphasized />
        <LiveKpiCard icon={DollarSign} label={`Sales · ${windowLabel}`} value={d ? money(d.kpis.totalSales) : "—"} isLoading={isLoading} emphasized />
        <LiveKpiCard icon={BadgeCheck} label={`Orders · ${windowLabel}`} value={N(d?.kpis.totalOrders ?? 0)} isLoading={isLoading} emphasized />
        <LiveKpiCard icon={Percent} label="Conversion rate" value={PCT(d?.kpis.conversionRate ?? 0)} isLoading={isLoading} emphasized />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LiveKpiCard icon={TrendingUp} label="AOV" value={d ? money(d.kpis.aov) : "—"} isLoading={isLoading} />
        <LiveKpiCard icon={ShoppingCart} label="Active carts" value={N(d?.behavior.activeCarts ?? 0)} isLoading={isLoading} />
        <LiveKpiCard icon={ShoppingBag} label="Checkout abandon." value={PCT(d?.kpis.checkoutAbandonment ?? 0)} isLoading={isLoading} />
        <LiveKpiCard icon={UserPlus} label="Returning" value={`${N(d?.kpis.returningVisitors ?? 0)} · ${returningPct.toFixed(0)}%`} isLoading={isLoading} />
      </div>
    </div>
  );
}

function LiveKpiCard({
  icon: Icon, label, value, helper, isLoading, emphasized,
}: {
  icon: any; label: string; value: string; helper?: string;
  isLoading?: boolean; emphasized?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className={`font-semibold tabular-nums tracking-tight ${emphasized ? "text-2xl" : "text-lg"}`}>{value}</div>
        )}
        {helper && <div className="mt-0.5 text-[10px] text-muted-foreground">{helper}</div>}
      </CardContent>
    </Card>
  );
}

function LiveCustomerFunnel({
  activeCarts, checkingOut, purchased, checkoutAbandonment,
}: {
  activeCarts: number; checkingOut: number; purchased: number; checkoutAbandonment: number;
}) {
  const total = Math.max(activeCarts, 1);
  const stages = [
    { label: "Active carts", value: activeCarts, icon: ShoppingCart, tone: "bg-muted-foreground/60" },
    { label: "Checking out", value: checkingOut, icon: CreditCard, tone: "bg-primary/80" },
    { label: "Purchased", value: purchased, icon: CheckCircle2, tone: "bg-emerald-500/80" },
  ];
  const dropCheckout = activeCarts ? 1 - checkingOut / activeCarts : 0;
  const dropPurchase = checkingOut ? 1 - purchased / checkingOut : 0;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = Math.max(4, Math.round((s.value / total) * 100));
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {s.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {s.value}
                {i === 1 && activeCarts > 0 && <span className="ml-1 text-[10px]">· −{Math.round(dropCheckout * 100)}%</span>}
                {i === 2 && checkingOut > 0 && <span className="ml-1 text-[10px]">· −{Math.round(dropPurchase * 100)}%</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div className={`h-full rounded-full ${s.tone}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {checkoutAbandonment > 0.7 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Checkout abandonment above 70% ({PCT(checkoutAbandonment)}).
        </div>
      )}
    </div>
  );
}

function LiveActivityFeed({
  items, isLoading, streamer,
}: {
  items: LiveView["activityFeed"]; isLoading: boolean; streamer: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Live activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyRow label="No storefront activity yet." />
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {items.map((e) => {
              const meta = EVENT_META[e.eventType] ?? { icon: EyeIcon, label: e.eventType, tone: "text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex items-center gap-2.5 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-border hover:bg-muted/40">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted ${meta.tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="font-medium">{meta.label}</span>
                      {e.productName && (
                        e.productSlug ? (
                          <Link to="/product/$slug" params={{ slug: e.productSlug }} className="ml-1 truncate text-muted-foreground hover:underline">
                            {e.productName}
                          </Link>
                        ) : (
                          <span className="ml-1 truncate text-muted-foreground">{e.productName}</span>
                        )
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatRelative(e.createdAt)}{e.source ? ` · ${e.source}` : ""}
                    </div>
                  </div>
                  {e.revenueAed != null && e.revenueAed > 0 && (
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {streamer ? HIDDEN : AED(e.revenueAed)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const EVENT_META: Record<string, { icon: any; label: string; tone: string }> = {
  product_view: { icon: EyeIcon, label: "Product view", tone: "text-muted-foreground" },
  add_to_cart: { icon: ShoppingCart, label: "Added to cart", tone: "text-primary" },
  checkout_started: { icon: CreditCard, label: "Checkout started", tone: "text-amber-600 dark:text-amber-400" },
  purchase_completed: { icon: Package, label: "Purchase completed", tone: "text-emerald-600 dark:text-emerald-400" },
};

function LiveAnalyticsCard({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {right}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground">{label}</p>
  );
}