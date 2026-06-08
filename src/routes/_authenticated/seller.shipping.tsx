import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Truck, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  sellerListMyRates, sellerUpsertMyRate, sellerDeleteMyOverride,
} from "@/lib/shipping.functions";

export const Route = createFileRoute("/_authenticated/seller/shipping")({
  head: () => ({ meta: [{ title: "Seller — Shipping" }] }),
  component: SellerShipping,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

type Zone = { id: string; name: string; slug: string; emirates: string[]; is_active: boolean };
type Rate = {
  id: string; seller_id: string | null; zone_id: string;
  base_aed: number; per_kg_aed: number; free_above_aed: number | null;
  sla_min_days: number; sla_max_days: number; is_active: boolean;
};

function SellerShipping() {
  const list = useServerFn(sellerListMyRates);
  const upsert = useServerFn(sellerUpsertMyRate);
  const remove = useServerFn(sellerDeleteMyOverride);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["seller-shipping"],
    queryFn: () => list({}),
  });

  const [editZone, setEditZone] = useState<Zone | null>(null);

  const upsertM = useMutation({
    mutationFn: (input: any) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Shipping rate saved");
      setEditZone(null);
      qc.invalidateQueries({ queryKey: ["seller-shipping"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Override removed — using default");
      qc.invalidateQueries({ queryKey: ["seller-shipping"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove"),
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;

  const zones: Zone[] = data?.zones ?? [];
  const rates: Rate[] = data?.rates ?? [];
  const sellerId: string = data?.sellerId ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping rates"
        description="Override the marketplace default per zone. If you don't set an override, the platform default applies."
        icon={Truck}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Shipping" }]}
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Truck className="h-5 w-5" />
          <div className="font-semibold">Zones &amp; rates</div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Base (AED)</TableHead>
                <TableHead>Per kg</TableHead>
                <TableHead>Free above</TableHead>
                <TableHead>SLA (days)</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => {
                const own = rates.find((r) => r.zone_id === z.id && r.seller_id === sellerId);
                const def = rates.find((r) => r.zone_id === z.id && r.seller_id === null);
                const r = own ?? def;
                return (
                  <TableRow key={z.id}>
                    <TableCell>
                      <div className="font-medium">{z.name}</div>
                      <div className="text-xs text-muted-foreground">{z.emirates.join(", ")}</div>
                    </TableCell>
                    <TableCell>
                      {own ? <Badge>Override</Badge> : def ? <Badge variant="secondary">Default</Badge> : <Badge variant="outline">No rate</Badge>}
                    </TableCell>
                    <TableCell>{r ? Number(r.base_aed).toFixed(2) : "—"}</TableCell>
                    <TableCell>{r ? Number(r.per_kg_aed).toFixed(2) : "—"}</TableCell>
                    <TableCell>{r?.free_above_aed != null ? `≥ ${Number(r.free_above_aed).toFixed(0)}` : "—"}</TableCell>
                    <TableCell>{r ? `${r.sla_min_days}–${r.sla_max_days}` : "—"}</TableCell>
                    <TableCell>{r ? (r.is_active ? "Yes" : "No") : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setEditZone(z)}>
                        <Pencil className="h-3 w-3 mr-1" />
                        {own ? "Edit" : "Override"}
                      </Button>
                      {own && (
                        <Button size="sm" variant="ghost" onClick={() => deleteM.mutate(own.id)}>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {zones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      icon={Truck}
                      title="No shipping zones yet"
                      description="The marketplace hasn't configured any shipping zones. Once available, you can override rates per zone."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editZone && (
        <RateDialog
          zone={editZone}
          existing={rates.find((r) => r.zone_id === editZone.id && r.seller_id === sellerId) ?? null}
          fallback={rates.find((r) => r.zone_id === editZone.id && r.seller_id === null) ?? null}
          onClose={() => setEditZone(null)}
          onSave={(p) => upsertM.mutate(p)}
          saving={upsertM.isPending}
        />
      )}
    </div>
  );
}

function RateDialog({
  zone, existing, fallback, onClose, onSave, saving,
}: {
  zone: Zone; existing: Rate | null; fallback: Rate | null;
  onClose: () => void; onSave: (p: any) => void; saving: boolean;
}) {
  const seed = existing ?? fallback;
  const [form, setForm] = useState({
    zone_id: zone.id,
    base_aed: Number(seed?.base_aed ?? 25),
    per_kg_aed: Number(seed?.per_kg_aed ?? 0),
    free_above_aed: seed?.free_above_aed != null ? Number(seed.free_above_aed) : null as number | null,
    sla_min_days: seed?.sla_min_days ?? 1,
    sla_max_days: seed?.sla_max_days ?? 3,
    is_active: seed?.is_active ?? true,
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rate for {zone.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Base (AED)</Label>
              <Input type="number" min={0} step="0.01" value={form.base_aed}
                onChange={(e) => setForm({ ...form, base_aed: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Per kg (AED)</Label>
              <Input type="number" min={0} step="0.01" value={form.per_kg_aed}
                onChange={(e) => setForm({ ...form, per_kg_aed: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Free shipping above (AED) — leave empty to disable</Label>
            <Input type="number" min={0} step="1" value={form.free_above_aed ?? ""}
              onChange={(e) => setForm({ ...form, free_above_aed: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SLA min (days)</Label>
              <Input type="number" min={0} max={60} value={form.sla_min_days}
                onChange={(e) => setForm({ ...form, sla_min_days: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>SLA max (days)</Label>
              <Input type="number" min={0} max={60} value={form.sla_max_days}
                onChange={(e) => setForm({ ...form, sla_max_days: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving ? "Saving…" : "Save override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}