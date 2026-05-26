import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { adminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Overview" }] }),
  component: AdminHome,
});

function AdminHome() {
  const fn = useServerFn(adminOverview);
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn({}) });
  const d = q.data;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tight">Marketplace overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="GMV (AED)" value={(d?.gmv ?? 0).toFixed(2)} />
        <Stat label="Total orders" value={d?.orders ?? 0} />
        <Stat label="Products" value={d?.products ?? 0} />
        <Stat label="Active sellers" value={d?.activeSellers ?? 0} />
        <Stat label="Pending applications" value={d?.pendingSellers ?? 0} />
        <Stat label="All sellers" value={d?.sellers ?? 0} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}