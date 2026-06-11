import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/site/PageHeader";
import { Activity, MousePointerClick, Eye, ShoppingCart, Mail, Heart } from "lucide-react";
import { getCatalogAnalytics, type CatalogAnalytics } from "@/lib/catalog-events.functions";

export const Route = createFileRoute("/_authenticated/admin/catalog-analytics")({
  head: () => ({ meta: [{ title: "Admin — Catalog analytics" }] }),
  component: AdminCatalogAnalytics,
});

const PCT = (n: number) => `${(n * 100).toFixed(1)}%`;
const N = (n: number) => (n ?? 0).toLocaleString("en-US");

const STAGE_LABEL: Record<string, string> = {
  card_impression: "Impressions",
  card_click: "Clicks",
  product_view: "Product views",
  add_to_cart: "Add to cart",
  wishlist_add: "Wishlist",
  b2b_lead_submit: "B2B leads",
};

const STAGE_ICON: Record<string, any> = {
  card_impression: Eye,
  card_click: MousePointerClick,
  product_view: Activity,
  add_to_cart: ShoppingCart,
  wishlist_add: Heart,
  b2b_lead_submit: Mail,
};

function heatColor(rate: number) {
  // 0..1 → green intensity
  const v = Math.max(0, Math.min(1, rate));
  const alpha = 0.08 + v * 0.55;
  return { backgroundColor: `rgba(16, 185, 129, ${alpha.toFixed(3)})` };
}

function AdminCatalogAnalytics() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const fn = useServerFn(getCatalogAnalytics);
  const q = useQuery<CatalogAnalytics>({
    queryKey: ["admin-catalog-analytics", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 120_000,
  });
  const d = q.data;

  const funnelStages = ["card_impression", "card_click", "product_view", "add_to_cart"] as const;
  const baseImpressions = d?.funnel.find((f) => f.eventType === "card_impression")?.sessions ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Catalog analytics"
        description="Impressions, clicks and conversions from your storefront."
        actions={
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
            <TabsList>
              <TabsTrigger value="7">7d</TabsTrigger>
              <TabsTrigger value="30">30d</TabsTrigger>
              <TabsTrigger value="90">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {!d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          {/* Funnel */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {d.funnel.map((stage) => {
              const Icon = STAGE_ICON[stage.eventType] ?? Activity;
              return (
                <Card key={stage.eventType}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {STAGE_LABEL[stage.eventType] ?? stage.eventType}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tracking-tight">{N(stage.events)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {N(stage.sessions)} sessions
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Funnel chart */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion funnel — last {d.days} days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelStages.map((t) => {
                const stage = d.funnel.find((f) => f.eventType === t);
                const sessions = stage?.sessions ?? 0;
                const rate = baseImpressions ? sessions / baseImpressions : 0;
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{STAGE_LABEL[t]}</span>
                      <span>{N(sessions)} sessions · {PCT(rate)}</span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/85 transition-all"
                        style={{ width: `${Math.max(2, rate * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Cohorts */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly cohorts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sessions grouped by the week of their first card impression.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort week</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">→ Clicked</TableHead>
                    <TableHead className="text-right">→ Viewed</TableHead>
                    <TableHead className="text-right">→ Cart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.cohorts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No catalog activity yet in this window.
                      </TableCell>
                    </TableRow>
                  )}
                  {d.cohorts.map((c) => (
                    <TableRow key={c.cohort}>
                      <TableCell className="font-medium">{c.cohort}</TableCell>
                      <TableCell className="text-right">{N(c.impressions)}</TableCell>
                      <TableCell className="text-right" style={heatColor(c.ctr)}>
                        {N(c.clicks)} <span className="text-muted-foreground">({PCT(c.ctr)})</span>
                      </TableCell>
                      <TableCell className="text-right" style={heatColor(c.viewRate)}>
                        {N(c.views)} <span className="text-muted-foreground">({PCT(c.viewRate)})</span>
                      </TableCell>
                      <TableCell className="text-right" style={heatColor(c.cartRate)}>
                        {N(c.addToCart)} <span className="text-muted-foreground">({PCT(c.cartRate)})</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}