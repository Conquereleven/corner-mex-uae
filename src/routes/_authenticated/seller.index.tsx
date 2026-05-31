import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Box, Clock, DollarSign,
  Package, ShoppingCart, TrendingUp, Users, Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSellerOverview } from "@/lib/seller.functions";
import { statusColor } from "@/lib/dashboard-tokens";

export const Route = createFileRoute("/_authenticated/seller/")({
  head: () => ({ meta: [{ title: "Seller — Overview" }] }),
  component: SellerOverview,
});

const AED = (n: number) => `${(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
const N = (n: number) => (n ?? 0).toLocaleString("en-US");

function SellerOverview() {
  const fn = useServerFn(getSellerOverview);
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["seller-overview"], queryFn: () => fn({}), refetchInterval: 60_000 });
  const d = q.data;
  const seller = d?.seller as any;
  const s = d?.stats;

  if (q.isLoading || !d || !s) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{seller?.store_name}</h1>
          <p className="text-sm text-muted-foreground">
            Commission: {Number(seller?.commission_rate ?? 0)}% · {t("dash.kpi.gmvToday")} {AED(s.gmvToday)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={seller?.status === "active" ? "default" : "secondary"} className="capitalize">{seller?.status}</Badge>
          {seller?.status === "active" && (
            <Link to="/sellers/$slug" params={{ slug: seller.slug }}>
              <Button variant="outline" size="sm" className="rounded-full">View public page</Button>
            </Link>
          )}
        </div>
      </div>

      {seller?.status !== "active" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            Your store is <strong className="capitalize">{seller?.status}</strong>. Products won't be visible publicly until an admin activates it.
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label={t("dash.kpi.gmv30")} value={AED(s.gmv30)} delta={s.gmvDelta} hint={`${t("dash.kpi.gmv7")} ${AED(s.gmv7)}`} />
        <Kpi icon={ShoppingCart} label={t("dash.kpi.orders30")} value={N(s.orders30)} hint={`${t("dash.kpi.gmvToday")} ${N(s.ordersToday)} · 7d ${N(s.orders7)}`} />
        <Kpi icon={TrendingUp} label={t("dash.kpi.aov")} value={AED(s.aov)} hint={`${N(s.units30)} ${t("dash.kpi.units").toLowerCase()}`} />
        <Kpi icon={Users} label={t("dash.kpi.buyers")} value={N(s.buyers30)} hint={`${t("dash.kpi.commission")} ${AED(s.commissionLifetime)}`} />
        <Kpi icon={Package} label={t("dash.kpi.activeProducts")} value={`${N(s.activeProducts)} / ${N(s.productCount)}`} hint={`${N(s.draftProducts)} drafts`} />
        <Kpi icon={Clock} label={t("dash.kpi.pending")} value={N(s.pendingItems)} hint={`${N(s.confirmedItems)} confirmed`} tone={s.pendingItems > 0 ? "warn" : "default"} />
        <Kpi icon={AlertTriangle} label={t("dash.kpi.lowStock")} value={N(s.lowStockCount)} hint="≤ 5 units" tone={s.lowStockCount > 0 ? "warn" : "default"} />
        <Kpi icon={DollarSign} label={t("dash.kpi.net")} value={AED(s.netLifetime)} hint={`${t("dash.kpi.gross")} ${AED(s.grossLifetime)}`} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{t("dash.sections.revenue30")}</CardTitle>
              <CardDescription>{t("dash.sections.dailyGmv")}</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono">{AED(s.gmv30)}</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="sellerGmvFill" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="gmv" stroke="var(--primary)" strokeWidth={2} fill="url(#sellerGmvFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dash.sections.ordersByStatus")}</CardTitle>
            <CardDescription>{t("dash.sections.last60")}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.statusBreakdown.filter((x) => x.count > 0)} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {d.statusBreakdown.map((x) => <Cell key={x.status} fill={statusColor(x.status)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="-mt-4 flex flex-wrap gap-2 text-xs">
              {d.statusBreakdown.filter((x) => x.count > 0).map((x) => (
                <span key={x.status} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: statusColor(x.status) }} />
                  <span className="capitalize text-muted-foreground">{x.status}</span>
                  <span className="font-medium tabular-nums">{x.count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dash.sections.dailyOrders")}</CardTitle>
            <CardDescription>{t("dash.sections.volume30")}</CardDescription>
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
            <CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4" /> {t("dash.sections.topProducts")}</CardTitle>
            <CardDescription>{t("dash.sections.byRevenue")}</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("dash.sections.noProductsSold")}</p>
            ) : (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> {t("dash.sections.recentOrders")}</CardTitle>
            <CardDescription>{t("dash.sections.recentOrdersSub")}</CardDescription>
          </div>
          <Link to="/seller/orders"><Button variant="outline" size="sm">{t("dash.nav.orders")} →</Button></Link>
        </CardHeader>
        <CardContent className="p-0">
          {d.recentItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("dash.sections.noOrders")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentItems.map((i: any) => (
                <li key={i.id} className="grid grid-cols-1 gap-2 px-6 py-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                  <div>
                    <p className="font-medium text-sm truncate">{i.product_name}{i.variant_label && <span className="text-muted-foreground"> — {i.variant_label}</span>}</p>
                    <p className="text-xs text-muted-foreground">{i.order?.order_number} · {new Date(i.order?.created_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(i.fulfillment_status), color: statusColor(i.fulfillment_status) }}>{i.fulfillment_status}</Badge>
                  <Badge variant="secondary" className="capitalize">{i.order?.payment_status}</Badge>
                  <span className="font-mono text-sm tabular-nums md:text-right">{AED(Number(i.line_total_aed))} · ×{i.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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