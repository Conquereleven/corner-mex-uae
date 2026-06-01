import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight, DollarSign, ShoppingCart, Package,
  CheckCircle2, XCircle, Repeat, AlertTriangle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { getPerformance } from "@/lib/performance.functions";

export const Route = createFileRoute("/_authenticated/seller/performance")({
  head: () => ({ meta: [{ title: "Seller — Performance" }] }),
  component: SellerPerformance,
});

const AED = (n: number) => `${(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AED`;
const N = (n: number) => (n ?? 0).toLocaleString("en-US");
const PCT = (n: number) => `${(n * 100).toFixed(1)}%`;

function trendColor(t: number, inverted = false) {
  if (t === 0) return "text-muted-foreground";
  const positive = inverted ? t < 0 : t > 0;
  return positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

function rateBadge(rate: number, inverted = false) {
  const good = inverted ? rate < 0.05 : rate > 0.95;
  const mid = inverted ? rate < 0.15 : rate > 0.8;
  if (good) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (mid) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
}

function BenchmarkBadge({ mine, avg, inverted, t }: { mine: number; avg: number; inverted?: boolean; t: any }) {
  const diff = mine - avg;
  const better = inverted ? diff < 0 : diff > 0;
  const same = Math.abs(diff) < 0.005;
  if (same) return <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" />{t("dash.performance.bench.onPar")}</Badge>;
  return (
    <Badge variant="outline" className={`gap-1 ${better ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 text-red-700 dark:text-red-300"}`}>
      {better ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {better ? t("dash.performance.bench.above") : t("dash.performance.bench.below")} · {PCT(avg)}
    </Badge>
  );
}

function KpiCard({ title, value, trend, inverted, icon: Icon }: {
  title: string; value: string; trend?: number; inverted?: boolean; icon: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {typeof trend === "number" && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-0.5 ${trendColor(trend, inverted)}`}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {PCT(Math.abs(trend))}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SellerPerformance() {
  const { t } = useTranslation();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const fn = useServerFn(getPerformance);
  const q = useQuery({
    queryKey: ["seller-performance", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 90_000,
  });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("dash.performance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dash.performance.sellerSub")}</p>
        </div>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
          <TabsList>
            <TabsTrigger value="7">{t("dash.performance.range.d7")}</TabsTrigger>
            <TabsTrigger value="30">{t("dash.performance.range.d30")}</TabsTrigger>
            <TabsTrigger value="90">{t("dash.performance.range.d90")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {q.isLoading || !d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title={t("dash.performance.kpi.gmv")} value={AED(d.current.gmv)} trend={d.trend.gmv} icon={DollarSign} />
            <KpiCard title={t("dash.performance.kpi.orders")} value={N(d.current.orderCount)} trend={d.trend.orders} icon={ShoppingCart} />
            <KpiCard title={t("dash.performance.kpi.aov")} value={AED(d.current.aov)} trend={d.trend.aov} icon={DollarSign} />
            <KpiCard title={t("dash.performance.kpi.units")} value={N(d.current.units)} trend={d.trend.units} icon={Package} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.performance.kpi.fulfillment")}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight">{PCT(d.current.fulfillmentRate)}</div>
                {d.benchmark && <BenchmarkBadge mine={d.current.fulfillmentRate} avg={d.benchmark.fulfillmentRate} t={t} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.performance.kpi.cancellation")}</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight">{PCT(d.current.cancellationRate)}</div>
                {d.benchmark && <BenchmarkBadge mine={d.current.cancellationRate} avg={d.benchmark.cancellationRate} inverted t={t} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.performance.kpi.repeat")}</CardTitle>
                <Repeat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold tracking-tight">{PCT(d.current.repeatRate)}</div>
                {d.benchmark && <BenchmarkBadge mine={d.current.repeatRate} avg={d.benchmark.repeatRate} t={t} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("dash.performance.kpi.stockHealth")}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">{d.stock.outOfStock + d.stock.lowStock}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.stock.outOfStock} {t("dash.performance.stock.out")} · {d.stock.lowStock} {t("dash.performance.stock.low")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("dash.performance.chart.title")}</CardTitle>
              <CardDescription>{t("dash.performance.chart.sub", { days })}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={d.series}>
                  <defs>
                    <linearGradient id="srev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any, name: string) => name === "revenue" ? AED(Number(v)) : N(Number(v))}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#srev)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {d.current.topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("dash.performance.topProducts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t("dash.performance.ranking.col.product")}</TableHead>
                      <TableHead className="text-right">{t("dash.performance.ranking.col.units")}</TableHead>
                      <TableHead className="text-right">{t("dash.performance.ranking.col.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.current.topProducts.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">#{i + 1}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{N(p.qty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{AED(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
