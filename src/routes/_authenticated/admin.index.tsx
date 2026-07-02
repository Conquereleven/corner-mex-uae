import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Box, Clock,
  CreditCard, DollarSign, Package, ShoppingCart, Store, TrendingUp, Users,
} from "lucide-react";
import { adminOverview } from "@/lib/admin.functions";
import { listTopViewedProducts } from "@/lib/catalog.functions";
import { Eye } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overview" }] }),
  component: AdminHome,
});

const AED = (n: number) => `${(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
const N = (n: number) => (n ?? 0).toLocaleString("en-US");

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(45 90% 55%)",
  confirmed: "hsl(210 90% 60%)",
  shipped: "hsl(260 70% 60%)",
  delivered: "hsl(150 60% 45%)",
  cancelled: "hsl(0 70% 55%)",
  refunded: "hsl(20 70% 55%)",
  paid: "hsl(150 60% 45%)",
  failed: "hsl(0 70% 55%)",
};

function AdminHome() {
  const fn = useServerFn(adminOverview);
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn({}), refetchInterval: 60_000 });
  const topViewedFn = useServerFn(listTopViewedProducts);
  const [viewedDays, setViewedDays] = useState<number>(30);
  const topViewed = useQuery({
    queryKey: ["admin-top-viewed", viewedDays],
    queryFn: () => topViewedFn({ data: { days: viewedDays, limit: 10 } }),
    refetchInterval: 120_000,
  });
  const d = q.data;

  if (q.isLoading || !d) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Commerce overview</h1>
          <p className="text-sm text-muted-foreground">Loading metrics…</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const totalSellers = Math.max(d.sellers, 1);
  const activeShare = Math.round((d.activeSellers / totalSellers) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Commerce overview</h1>
          <p className="text-sm text-muted-foreground">Live performance across CornerMex first-party orders and revenue. Seller / marketplace metrics activate in Phase 2.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live · refreshed every 60s
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="GMV (30d)" value={AED(d.gmv30)} delta={d.gmvDelta} hint={`Today ${AED(d.gmvToday)}`} />
        <Kpi icon={ShoppingCart} label="Orders (30d)" value={N(d.orders30)} hint={`Today ${N(d.ordersToday)} · 7d ${N(d.orders7)}`} />
        <Kpi icon={TrendingUp} label="Avg. order value" value={AED(d.aov)} hint={`${N(d.uniqueBuyers30)} unique buyers (30d)`} />
        <Kpi icon={CreditCard} label="Commission earned" value={AED(d.commission)} hint="Lifetime" />
        <Kpi icon={Store} label="Active sellers" value={`${N(d.activeSellers)} / ${N(d.sellers)}`} hint={`${activeShare}% activation`} />
        <Kpi icon={Package} label="Active products" value={N(d.activeProducts)} hint={`${N(d.draftProducts)} drafts`} />
        <Kpi icon={Clock} label="Pending fulfillment" value={N(d.pendingFulfillment)} hint="Pending + confirmed" tone={d.pendingFulfillment > 0 ? "warn" : "default"} />
        <Kpi icon={AlertTriangle} label="Low stock variants" value={N(d.lowStockCount)} hint="≤ 5 units" tone={d.lowStockCount > 0 ? "warn" : "default"} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Revenue · last 30 days</CardTitle>
              <CardDescription>Daily GMV in AED</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono">{AED(d.gmv30)}</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={50} />
                <Tooltip
                  contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name) => name === "gmv" ? [AED(Number(v)), "GMV"] : [N(Number(v)), "Orders"]}
                />
                <Area type="monotone" dataKey="gmv" stroke="var(--primary)" strokeWidth={2} fill="url(#gmvFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by status</CardTitle>
            <CardDescription>Last 60 days</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.statusBreakdown.filter((s) => s.count > 0)} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {d.statusBreakdown.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "var(--muted)"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="-mt-4 flex flex-wrap gap-2 text-xs">
              {d.statusBreakdown.filter((s) => s.count > 0).map((s) => (
                <span key={s.status} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                  <span className="capitalize text-muted-foreground">{s.status}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily orders + payment methods */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily orders</CardTitle>
            <CardDescription>Volume over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={40} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment status</CardTitle>
            <CardDescription>Order payment health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {d.paymentBreakdown.map((p) => {
              const total = d.paymentBreakdown.reduce((a, x) => a + x.count, 0) || 1;
              const pct = Math.round((p.count / total) * 100);
              return (
                <div key={p.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize">{p.status}</span>
                    <span className="tabular-nums text-muted-foreground">{p.count} · {pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            <div className="border-t border-border/60 pt-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Payment methods</p>
              <div className="flex flex-wrap gap-2">
                {d.methodBreakdown.map((m) => (
                  <Badge key={m.method} variant="secondary" className="capitalize">{m.method.replace(/_/g, " ")} · {m.count}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Top sellers</CardTitle>
            <CardDescription>By GMV</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topSellers.length === 0 ? <Empty label="No sales yet" /> : (
              <ul className="divide-y divide-border">
                {d.topSellers.map((s, i) => (
                  <li key={s.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 py-3">
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{N(s.units)} units · {AED(s.commission)} commission</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{AED(s.gmv)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4" /> Top products</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topProducts.length === 0 ? <Empty label="No products sold yet" /> : (
              <ul className="divide-y divide-border">
                {d.topProducts.map((p, i) => (
                  <li key={p.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 py-3">
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{N(p.units)} units</p>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{AED(p.gmv)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most viewed products (last 30 days) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Most viewed products</CardTitle>
            <CardDescription>Top 10 products by view count</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Today", v: 1 },
              { label: "7d", v: 7 },
              { label: "30d", v: 30 },
              { label: "All", v: 365 },
            ].map((p) => (
              <button
                key={p.v}
                onClick={() => setViewedDays(p.v)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${viewedDays === p.v ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
              >
                {p.label}
              </button>
            ))}
            <Badge variant="outline">{N((topViewed.data ?? []).reduce((s, p) => s + p.views, 0))} views</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {topViewed.isLoading ? (
            <div className="p-6"><Skeleton className="h-32" /></div>
          ) : (topViewed.data ?? []).length === 0 ? (
            <div className="p-6"><Empty label="No views tracked yet" /></div>
          ) : (
            <ul className="divide-y divide-border">
              {(topViewed.data ?? []).map((p, i) => {
                const conv = p.views > 0 ? ((p.orders / p.views) * 100).toFixed(1) : "0.0";
                return (
                  <li key={p.product_id} className="grid grid-cols-[28px_56px_1fr_auto_auto] items-center gap-3 px-6 py-3">
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    <div className="h-14 w-14 overflow-hidden rounded-md bg-muted">
                      {p.image && <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <Link to="/product/$slug" params={{ slug: p.slug }} className="truncate text-sm font-medium hover:underline">{p.name}</Link>
                      <p className="text-xs text-muted-foreground">{p.category ?? "—"}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono tabular-nums">{N(p.views)} views</Badge>
                    <Badge variant="outline" className="font-mono tabular-nums">{conv}% conv</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent orders</CardTitle>
            <CardDescription>Latest 8 transactions</CardDescription>
          </div>
          <Badge variant="outline">{N(d.orders)} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {d.recentOrders.length === 0 ? <div className="p-6"><Empty label="No orders yet" /></div> : (
            <ul className="divide-y divide-border">
              {d.recentOrders.map((o: any) => (
                <li key={o.id} className="grid grid-cols-1 gap-2 px-6 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium text-sm">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="capitalize" style={{ borderColor: STATUS_COLORS[o.status], color: STATUS_COLORS[o.status] }}>{o.status}</Badge>
                  <Badge variant="secondary" className="capitalize">{o.payment_status}</Badge>
                  <span className="font-mono text-sm tabular-nums md:text-right">{AED(Number(o.total_aed))}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Footer summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat icon={Users} label="Registered buyers" value={N(d.buyers)} />
        <MiniStat icon={Store} label="Pending applications" value={N(d.pendingSellers)} tone={d.pendingSellers > 0 ? "warn" : "default"} />
        <MiniStat icon={DollarSign} label="Lifetime GMV" value={AED(d.gmv)} />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, hint, delta, tone = "default",
}: {
  icon: any; label: string; value: string; hint?: string; delta?: number | null; tone?: "default" | "warn";
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={tone === "warn" ? "border-amber-500/40" : ""}>
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-500" : "text-muted-foreground"}`} />
        </div>
        <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {delta !== undefined && delta !== null && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${up ? "text-emerald-600" : "text-red-600"}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-500/40" : ""}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`rounded-md p-2 ${tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-lg tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}