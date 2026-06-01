import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Truck, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  adminListZones, adminUpsertZone, adminDeleteZone,
  adminListRates, adminUpsertRate, adminDeleteRate,
} from "@/lib/shipping.functions";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  head: () => ({ meta: [{ title: "Admin — Shipping" }] }),
  component: AdminShipping,
});

const EMIRATES = [
  { code: "abu_dhabi", label: "Abu Dhabi" },
  { code: "dubai", label: "Dubai" },
  { code: "sharjah", label: "Sharjah" },
  { code: "ajman", label: "Ajman" },
  { code: "umm_al_quwain", label: "Umm Al Quwain" },
  { code: "ras_al_khaimah", label: "Ras Al Khaimah" },
  { code: "fujairah", label: "Fujairah" },
] as const;

type Zone = {
  id: string; name: string; slug: string; emirates: string[];
  is_active: boolean; sort_order: number;
};
type Rate = {
  id: string; seller_id: string | null; zone_id: string;
  base_aed: number; per_kg_aed: number; free_above_aed: number | null;
  sla_min_days: number; sla_max_days: number; is_active: boolean;
  seller?: { id: string; store_name: string } | null;
  zone?: { id: string; name: string } | null;
};

function AdminShipping() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Shipping</h1>
        <p className="text-sm text-muted-foreground">Zones cover one or more emirates. Rates define cost & SLA per zone, with optional per-seller overrides.</p>
      </div>
      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones"><MapPin className="me-2 h-4 w-4" />Zones</TabsTrigger>
          <TabsTrigger value="rates"><Truck className="me-2 h-4 w-4" />Rates</TabsTrigger>
        </TabsList>
        <TabsContent value="zones" className="pt-6"><ZonesPanel /></TabsContent>
        <TabsContent value="rates" className="pt-6"><RatesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function ZonesPanel() {
  const listFn = useServerFn(adminListZones);
  const delFn = useServerFn(adminDeleteZone);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-zones"], queryFn: () => listFn({}) });
  const [editing, setEditing] = useState<Zone | null>(null);
  const [creating, setCreating] = useState(false);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Zone deleted"); qc.invalidateQueries({ queryKey: ["admin-zones"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as Zone[];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="text-sm text-muted-foreground">{rows.length} zones</div>
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New zone</Button>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No zones yet. Create one to start charging shipping.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Emirates</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="font-medium">{z.name}</TableCell>
                    <TableCell className="font-mono text-xs">{z.slug}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {z.emirates.map((e) => (
                          <Badge key={e} variant="outline" className="text-[10px]">
                            {EMIRATES.find((x) => x.code === e)?.label ?? e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{z.sort_order}</TableCell>
                    <TableCell>
                      <Badge variant={z.is_active ? "default" : "outline"} className="text-[10px]">
                        {z.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(z)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete zone?</AlertDialogTitle>
                            <AlertDialogDescription>All rates attached to this zone will also be removed.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(z.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ZoneDialog open={creating} onOpenChange={setCreating} />
      <ZoneDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} editing={editing} />
    </>
  );
}

function ZoneDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: Zone | null }) {
  const upsert = useServerFn(adminUpsertZone);
  const qc = useQueryClient();
  const init = editing ?? { id: "", name: "", slug: "", emirates: [] as string[], is_active: true, sort_order: 0 };
  const [form, setForm] = useState<any>(init);
  useMemo(() => setForm(init), [editing, open]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleEmirate = (code: string) =>
    set("emirates", form.emirates.includes(code) ? form.emirates.filter((c: string) => c !== code) : [...form.emirates, code]);

  const save = async () => {
    try {
      await upsert({ data: {
        id: editing?.id || undefined,
        name: form.name.trim(),
        slug: form.slug.trim(),
        emirates: form.emirates,
        is_active: !!form.is_active,
        sort_order: Number(form.sort_order) || 0,
      } });
      toast.success(editing ? "Zone updated" : "Zone created");
      qc.invalidateQueries({ queryKey: ["admin-zones"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit zone" : "New zone"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Mainland" /></div>
            <div className="space-y-1.5"><Label>Slug</Label><Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="mainland" /></div>
          </div>
          <div>
            <Label>Emirates covered</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EMIRATES.map((e) => (
                <label key={e.code} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${form.emirates.includes(e.code) ? "border-foreground bg-foreground/5" : "border-border"}`}>
                  <input type="checkbox" checked={form.emirates.includes(e.code)} onChange={() => toggleEmirate(e.code)} />
                  {e.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></div>
            <div className="flex items-end gap-2"><Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} /><Label>Active</Label></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatesPanel() {
  const listRatesFn = useServerFn(adminListRates);
  const listZonesFn = useServerFn(adminListZones);
  const delFn = useServerFn(adminDeleteRate);
  const qc = useQueryClient();
  const rq = useQuery({ queryKey: ["admin-rates"], queryFn: () => listRatesFn({}) });
  const zq = useQuery({ queryKey: ["admin-zones"], queryFn: () => listZonesFn({}) });
  const [editing, setEditing] = useState<Rate | null>(null);
  const [creating, setCreating] = useState(false);

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Rate deleted"); qc.invalidateQueries({ queryKey: ["admin-rates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (rq.data ?? []) as Rate[];
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="text-sm text-muted-foreground">{rows.length} rates</div>
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New rate</Button>
        </CardHeader>
        <CardContent className="p-0">
          {rq.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No rates yet. Create defaults per zone, plus per-seller overrides as needed.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Base (AED)</TableHead>
                  <TableHead className="text-right">/kg</TableHead>
                  <TableHead className="text-right">Free above</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.zone?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.seller_id
                        ? <Badge variant="outline" className="text-[10px]">Seller · {r.seller?.store_name}</Badge>
                        : <Badge className="text-[10px]">Default</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.base_aed).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.per_kg_aed).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.free_above_aed != null ? Number(r.free_above_aed).toFixed(0) : "—"}</TableCell>
                    <TableCell className="text-xs">{r.sla_min_days}–{r.sla_max_days} days</TableCell>
                    <TableCell><Badge variant={r.is_active ? "default" : "outline"} className="text-[10px]">{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete rate?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RateDialog open={creating} onOpenChange={setCreating} zones={(zq.data ?? []) as Zone[]} />
      <RateDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} editing={editing} zones={(zq.data ?? []) as Zone[]} />
    </>
  );
}

function RateDialog({ open, onOpenChange, editing, zones }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: Rate | null; zones: Zone[] }) {
  const upsert = useServerFn(adminUpsertRate);
  const qc = useQueryClient();
  const init = editing ?? {
    id: "", seller_id: null, zone_id: zones[0]?.id ?? "",
    base_aed: 25, per_kg_aed: 0, free_above_aed: 200,
    sla_min_days: 1, sla_max_days: 3, is_active: true,
  };
  const [form, setForm] = useState<any>(init);
  useMemo(() => setForm(init), [editing, open]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await upsert({ data: {
        id: editing?.id || undefined,
        seller_id: form.seller_id || null,
        zone_id: form.zone_id,
        base_aed: Number(form.base_aed) || 0,
        per_kg_aed: Number(form.per_kg_aed) || 0,
        free_above_aed: form.free_above_aed === "" || form.free_above_aed == null ? null : Number(form.free_above_aed),
        sla_min_days: Number(form.sla_min_days) || 0,
        sla_max_days: Number(form.sla_max_days) || 0,
        is_active: !!form.is_active,
      } });
      toast.success(editing ? "Rate updated" : "Rate created");
      qc.invalidateQueries({ queryKey: ["admin-rates"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit rate" : "New rate"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Zone</Label>
            <Select value={form.zone_id} onValueChange={(v) => set("zone_id", v)}>
              <SelectTrigger><SelectValue placeholder="Pick a zone" /></SelectTrigger>
              <SelectContent>{zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">This rate applies to all sellers (default) unless a seller has an override.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Base (AED)</Label><Input type="number" min={0} step="0.01" value={form.base_aed} onChange={(e) => set("base_aed", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Per kg (AED)</Label><Input type="number" min={0} step="0.01" value={form.per_kg_aed} onChange={(e) => set("per_kg_aed", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Free above (AED)</Label><Input type="number" min={0} value={form.free_above_aed ?? ""} onChange={(e) => set("free_above_aed", e.target.value)} placeholder="Leave empty for none" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>SLA min</Label><Input type="number" min={0} value={form.sla_min_days} onChange={(e) => set("sla_min_days", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>SLA max</Label><Input type="number" min={0} value={form.sla_max_days} onChange={(e) => set("sla_max_days", e.target.value)} /></div>
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} /><Label>Active</Label></div>
        </div>
        <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}