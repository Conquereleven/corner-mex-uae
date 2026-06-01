import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminGetCustomer } from "@/lib/admin.functions";
import { statusColor } from "@/lib/dashboard-tokens";

export const Route = createFileRoute("/_authenticated/admin/customers/$id")({
  head: () => ({ meta: [{ title: "Admin — Customer" }] }),
  component: CustomerDetail,
});

const AED = (n: number) => `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

function CustomerDetail() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const fn = useServerFn(adminGetCustomer);
  const q = useQuery({ queryKey: ["admin-customer", id], queryFn: () => fn({ data: { id } }) });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{(q.error as any)?.message ?? "Not found"}</p>;

  const { profile, addresses, orders, roles, stats } = q.data as any;

  return (
    <div className="space-y-6">
      <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("dash.customers.detail.back")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{profile.full_name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <div className="flex gap-1">
          {roles.map((r: string) => <Badge key={r} variant="outline" className="capitalize">{r}</Badge>)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("dash.customers.col.orders")} value={String(stats.orders)} />
        <Kpi label={t("dash.customers.col.gmv")} value={AED(stats.gmv)} />
        <Kpi label={t("dash.customers.detail.aov")} value={AED(stats.aov)} />
        <Kpi label={t("dash.customers.detail.lastOrder")} value={stats.last_order ? new Date(stats.last_order).toLocaleDateString() : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("dash.customers.detail.profile")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("dash.customers.detail.company")} value={profile.company_name ?? "—"} />
            <Row label={t("dash.customers.detail.phone")} value={profile.phone ?? "—"} />
            <Row label="TRN" value={profile.trn ?? "—"} />
            <Row label={t("dash.customers.detail.lang")} value={(profile.preferred_lang ?? "").toUpperCase()} />
            <Row label={t("dash.customers.detail.joined")} value={new Date(profile.created_at).toLocaleDateString()} />
            <Row label={t("dash.customers.detail.firstOrder")} value={stats.first_order ? new Date(stats.first_order).toLocaleDateString() : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("dash.customers.detail.addresses")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {addresses.length === 0 ? (
              <p className="text-muted-foreground">{t("dash.customers.detail.noAddresses")}</p>
            ) : addresses.map((a: any) => (
              <div key={a.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.recipient_name} {a.label && <span className="text-xs text-muted-foreground">· {a.label}</span>}</div>
                  {a.is_default && <Badge variant="outline" className="text-[10px]">Default</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[a.building, a.street, a.area, a.emirate].filter(Boolean).join(", ")}
                </div>
                <div className="text-xs text-muted-foreground">{a.phone}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("dash.customers.detail.orders")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("dash.customers.detail.noOrders")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(o.payment_status), color: statusColor(o.payment_status) }}>
                        {o.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize" style={{ borderColor: statusColor(o.status), color: statusColor(o.status) }}>
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{AED(o.total_aed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}