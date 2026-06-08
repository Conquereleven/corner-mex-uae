import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Trash2, Pencil, Tags } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  adminListCategories, adminCreateCategory, adminUpdateCategory,
  adminToggleCategoryActive, adminDeleteCategory,
} from "@/lib/admin.functions";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Admin — Categories" }] }),
  component: AdminCategories,
});

type Cat = {
  id: string; slug: string;
  name_en: string; name_es: string; name_ar: string;
  description_en: string | null; description_es: string | null; description_ar: string | null;
  image_url: string | null; parent_id: string | null;
  sort_order: number; is_active: boolean; product_count: number;
};

function AdminCategories() {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListCategories);
  const toggleFn = useServerFn(adminToggleCategoryActive);
  const delFn = useServerFn(adminDeleteCategory);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-categories"], queryFn: () => listFn({}) });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [parentFilter, setParentFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Cat | null>(null);
  const [creating, setCreating] = useState(false);

  const all = (q.data ?? []) as Cat[];
  const parentName = (id: string | null) => all.find((c) => c.id === id)?.name_en ?? "—";

  const rows = useMemo(() => {
    return all.filter((c) => {
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (parentFilter === "top" && c.parent_id) return false;
      if (parentFilter !== "all" && parentFilter !== "top" && c.parent_id !== parentFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return [c.name_en, c.name_es, c.name_ar, c.slug].some((x) => (x ?? "").toLowerCase().includes(s));
    });
  }, [all, search, statusFilter, parentFilter]);

  const kpis = useMemo(() => ({
    total: all.length,
    active: all.filter((c) => c.is_active).length,
    inactive: all.filter((c) => !c.is_active).length,
    withProducts: all.filter((c) => c.product_count > 0).length,
  }), [all]);

  const toggleMut = useMutation({
    mutationFn: (input: { id: string; is_active: boolean }) => toggleFn({ data: input }),
    onSuccess: () => { toast.success(t("dash.categories.toggled")); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success(t("dash.categories.deleted")); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dash.categories.title")}
        description={t("dash.categories.sub")}
        icon={Tags}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: t("dash.categories.title") }]}
        actions={
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {t("dash.categories.new")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("dash.categories.kpi.total")} value={kpis.total} />
        <Kpi label={t("dash.categories.kpi.active")} value={kpis.active} />
        <Kpi label={t("dash.categories.kpi.inactive")} value={kpis.inactive} tone="muted" />
        <Kpi label={t("dash.categories.kpi.withProducts")} value={kpis.withProducts} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("dash.categories.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dash.payouts.allStatuses")}</SelectItem>
              <SelectItem value="active">{t("dash.categories.active")}</SelectItem>
              <SelectItem value="inactive">{t("dash.categories.inactive")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={parentFilter} onValueChange={setParentFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dash.categories.allParents")}</SelectItem>
              <SelectItem value="top">{t("dash.categories.topLevel")}</SelectItem>
              {all.filter((c) => !c.parent_id).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Tags} title={t("dash.categories.empty")} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("dash.categories.col.image")}</TableHead>
                    <TableHead>{t("dash.categories.col.name")}</TableHead>
                    <TableHead>{t("dash.categories.col.slug")}</TableHead>
                    <TableHead>{t("dash.categories.col.parent")}</TableHead>
                    <TableHead className="text-right">{t("dash.categories.col.products")}</TableHead>
                    <TableHead className="text-right">{t("dash.categories.col.order")}</TableHead>
                    <TableHead>{t("dash.categories.col.status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        {c.image_url ? (
                          <img src={c.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.name_en}</div>
                        <div className="text-xs text-muted-foreground">{c.name_es}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.parent_id ? parentName(c.parent_id) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.product_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={c.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: c.id, is_active: v })} />
                          <Badge variant={c.is_active ? "default" : "outline"} className="text-[10px]">
                            {c.is_active ? t("dash.categories.active") : t("dash.categories.inactive")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("dash.categories.delete.title")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("dash.categories.delete.desc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("dash.categories.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(c.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("dash.categories.delete.confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={creating}
        onOpenChange={setCreating}
        categories={all}
      />
      <CategoryFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        categories={all}
        editing={editing}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "muted" }) {
  return (
    <Card className={tone === "muted" ? "bg-muted/40" : ""}>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function CategoryFormDialog({
  open, onOpenChange, categories, editing,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  categories: Cat[]; editing?: Cat | null;
}) {
  const { t } = useTranslation();
  const createFn = useServerFn(adminCreateCategory);
  const updateFn = useServerFn(adminUpdateCategory);
  const qc = useQueryClient();
  const isEdit = !!editing;

  const initial = useMemo(() => editing ?? {
    id: "", slug: "", name_en: "", name_es: "", name_ar: "",
    description_en: "", description_es: "", description_ar: "",
    image_url: "", parent_id: null,
    sort_order: 0, is_active: true, product_count: 0,
  } as unknown as Cat, [editing]);

  const [form, setForm] = useState<any>(initial);
  // re-sync when dialog opens
  useMemo(() => { setForm(initial); }, [initial, open]);

  const [loading, setLoading] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setLoading(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        name_en: form.name_en.trim(),
        name_es: form.name_es.trim(),
        name_ar: form.name_ar.trim(),
        description_en: form.description_en || null,
        description_es: form.description_es || null,
        description_ar: form.description_ar || null,
        image_url: form.image_url || null,
        parent_id: form.parent_id || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: !!form.is_active,
      };
      if (isEdit) {
        await updateFn({ data: { id: editing!.id, ...payload } });
        toast.success(t("dash.categories.updated"));
      } else {
        await createFn({ data: payload });
        toast.success(t("dash.categories.created"));
      }
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const parentOptions = categories.filter((c) => !isEdit || c.id !== editing!.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("dash.categories.edit") : t("dash.categories.new")}</DialogTitle>
          <DialogDescription>{t("dash.categories.sub")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("dash.categories.form.slug")}</Label>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="dried-chiles" />
              <p className="text-[10px] text-muted-foreground">{t("dash.categories.form.slugHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("dash.categories.form.parent")}</Label>
              <Select
                value={form.parent_id ?? "__none__"}
                onValueChange={(v) => set("parent_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("dash.categories.form.none")}</SelectItem>
                  {parentOptions.filter((c) => !c.parent_id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="en">
            <TabsList>
              <TabsTrigger value="en">EN</TabsTrigger>
              <TabsTrigger value="es">ES</TabsTrigger>
              <TabsTrigger value="ar">AR</TabsTrigger>
            </TabsList>
            <TabsContent value="en" className="space-y-3 pt-3">
              <Field label={t("dash.categories.form.nameEn")} value={form.name_en} onChange={(v) => set("name_en", v)} />
              <TextareaField label={t("dash.categories.form.descEn")} value={form.description_en ?? ""} onChange={(v) => set("description_en", v)} />
            </TabsContent>
            <TabsContent value="es" className="space-y-3 pt-3">
              <Field label={t("dash.categories.form.nameEs")} value={form.name_es} onChange={(v) => set("name_es", v)} />
              <TextareaField label={t("dash.categories.form.descEs")} value={form.description_es ?? ""} onChange={(v) => set("description_es", v)} />
            </TabsContent>
            <TabsContent value="ar" className="space-y-3 pt-3" dir="rtl">
              <Field label={t("dash.categories.form.nameAr")} value={form.name_ar} onChange={(v) => set("name_ar", v)} />
              <TextareaField label={t("dash.categories.form.descAr")} value={form.description_ar ?? ""} onChange={(v) => set("description_ar", v)} />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("dash.categories.form.sortOrder")}</Label>
              <Input type="number" min={0} value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("dash.categories.form.imageUrl")}</Label>
              <Input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
            </div>
          </div>

          {form.image_url ? (
            <img src={form.image_url} alt="" className="h-24 w-24 rounded border object-cover" />
          ) : null}

          <div className="flex items-center gap-2">
            <Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label>{t("dash.categories.form.active")}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("dash.categories.cancel")}</Button>
          <Button onClick={onSave} disabled={loading}>
            {isEdit ? t("dash.categories.save") : t("dash.categories.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}