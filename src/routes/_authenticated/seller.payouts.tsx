import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Wallet, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMyPayouts } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/payouts")({
  head: () => ({ meta: [{ title: "Seller — Payouts" }] }),
  component: SellerPayouts,
});

const AED = (n: number) => `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function SellerPayouts() {
  const { t } = useTranslation();
  const fn = useServerFn(getMyPayouts);
  const q = useQuery({ queryKey: ["seller-payouts"], queryFn: () => fn({}) });

  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { payouts, totals } = q.data as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">{t("dash.payouts.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dash.payouts.sellerSub")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SellerKpi icon={CheckCircle2} label={t("dash.payouts.kpi.paid")} value={AED(totals.paid.net)} hint={`${totals.paid.count} ${t("dash.payouts.kpi.payouts")}`} tone="ok" />
        <SellerKpi icon={Clock} label={t("dash.payouts.kpi.pending")} value={AED(totals.pending.net)} hint={`${totals.pending.count} ${t("dash.payouts.kpi.payouts")}`} tone="warn" />
        <SellerKpi icon={TrendingUp} label={t("dash.payouts.kpi.lifetimeNet")} value={AED(totals.all.net)} hint={`${t("dash.kpi.gross")} ${AED(totals.all.gross)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dash.payouts.history")}</CardTitle>
          <CardDescription>{t("dash.payouts.historySub")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payouts.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("dash.payouts.emptySeller")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dash.payouts.col.period")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.gross")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.commission")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.net")}</TableHead>
                    <TableHead>{t("dash.payouts.col.status")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.paidAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">{p.period_start} → {p.period_end}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{AED(p.gross_aed)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">−{AED(p.commission_aed)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">{AED(p.net_aed)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_TONE[p.status] ?? ""}>
                          {t(`dash.payouts.status.${p.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SellerKpi({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-500/40" : tone === "ok" ? "border-emerald-500/40" : ""}>
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-emerald-500" : "text-muted-foreground"}`} />
        </div>
        <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}