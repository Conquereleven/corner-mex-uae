import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminListCustomers } from "@/lib/admin.functions";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/customers/")({
  head: () => ({ meta: [{ title: "Admin — Customers" }] }),
  component: AdminCustomers,
});

const AED = (n: number) =>
  `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  order_count: number;
  gmv: number;
  created_at: string;
  last_order_at: string | null;
  preferred_lang: string;
};

function AdminCustomers() {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListCustomers);
  const q = useQuery({ queryKey: ["admin-customers"], queryFn: () => listFn({}) });
  const [search, setSearch] = useState("");

  const all = useMemo(() => (q.data ?? []) as CustomerRow[], [q.data]);
  const rows = useMemo(() => {
    if (!search) return all;
    const s = search.toLowerCase();
    return all.filter((c) =>
      [c.full_name, c.email, c.phone, c.company_name].some((x) =>
        (x ?? "").toLowerCase().includes(s),
      ),
    );
  }, [all, search]);

  const kpis = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const withOrders = all.filter((c) => c.order_count > 0);
    const totalGmv = withOrders.reduce((a, c) => a + Number(c.gmv ?? 0), 0);
    return {
      total: all.length,
      new30: all.filter((c) => new Date(c.created_at).getTime() >= cutoff).length,
      withOrders: withOrders.length,
      avgGmv: withOrders.length ? +(totalGmv / withOrders.length).toFixed(2) : 0,
    };
  }, [all]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dash.customers.title")}
        description={t("dash.customers.sub")}
        icon={Users}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: t("dash.customers.title") }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("dash.customers.kpi.total")} value={String(kpis.total)} />
        <Kpi label={t("dash.customers.kpi.new30")} value={String(kpis.new30)} />
        <Kpi label={t("dash.customers.kpi.withOrders")} value={String(kpis.withOrders)} />
        <Kpi label={t("dash.customers.kpi.avgGmv")} value={AED(kpis.avgGmv)} />
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("dash.customers.searchPh")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} title={t("dash.customers.empty")} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dash.customers.col.name")}</TableHead>
                    <TableHead>{t("dash.customers.col.email")}</TableHead>
                    <TableHead>{t("dash.customers.col.phone")}</TableHead>
                    <TableHead className="text-right">{t("dash.customers.col.orders")}</TableHead>
                    <TableHead className="text-right">{t("dash.customers.col.gmv")}</TableHead>
                    <TableHead className="text-right">{t("dash.customers.col.last")}</TableHead>
                    <TableHead>{t("dash.customers.col.lang")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell>
                        <Link
                          to="/admin/customers/$id"
                          params={{ id: c.id }}
                          className="font-medium hover:underline"
                        >
                          {c.full_name ?? "—"}
                        </Link>
                        {c.company_name && (
                          <div className="text-xs text-muted-foreground">{c.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.order_count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {AED(c.gmv)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {c.preferred_lang}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="icon" variant="ghost">
                          <Link
                            to="/admin/customers/$id"
                            params={{ id: c.id }}
                            aria-label={`View ${c.full_name ?? "customer"} details`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
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
