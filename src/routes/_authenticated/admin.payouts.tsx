import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Trash2, Wallet, Check, X, Upload as UploadIcon, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  adminListPayouts, adminListSellers, adminPayoutPreview,
  adminGeneratePayout, adminUpdatePayoutStatus, adminDeletePayout,
  adminApprovePayout, adminRejectPayout, adminUploadPayoutReceipt,
} from "@/lib/admin.functions";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Admin — Payouts" }] }),
  component: AdminPayouts,
});

const AED = (n: number) => `${Number(n ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
const STATUSES = ["pending", "processing", "paid", "cancelled"] as const;
const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function AdminPayouts() {
  const { t } = useTranslation();
  const listFn = useServerFn(adminListPayouts);
  const sellersFn = useServerFn(adminListSellers);
  const updFn = useServerFn(adminUpdatePayoutStatus);
  const delFn = useServerFn(adminDeletePayout);
  const qc = useQueryClient();

  const payoutsQ = useQuery({ queryKey: ["admin-payouts"], queryFn: () => listFn({}) });
  const sellersQ = useQuery({ queryKey: ["admin-sellers"], queryFn: () => sellersFn({}) });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = useMemo(() => {
    const list = (payoutsQ.data ?? []) as any[];
    return list.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (p.seller?.store_name ?? "").toLowerCase().includes(s)
        || (p.seller?.contact_email ?? "").toLowerCase().includes(s);
    });
  }, [payoutsQ.data, search, statusFilter]);

  const totals = useMemo(() => {
    const list = (payoutsQ.data ?? []) as any[];
    const sum = (xs: any[], k: string) => +xs.reduce((a, x) => a + Number(x[k] ?? 0), 0).toFixed(2);
    const paid = list.filter((p) => p.status === "paid");
    const pending = list.filter((p) => p.status === "pending" || p.status === "processing");
    return {
      lifetimeNet: sum(list, "net_aed"),
      paidNet: sum(paid, "net_aed"),
      pendingNet: sum(pending, "net_aed"),
      commission: sum(list, "commission_aed"),
    };
  }, [payoutsQ.data]);

  const updateMut = useMutation({
    mutationFn: (input: { payoutId: string; status: string }) => updFn({ data: input }),
    onSuccess: () => { toast.success(t("dash.payouts.updated")); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (payoutId: string) => delFn({ data: { payoutId } }),
    onSuccess: () => { toast.success(t("dash.payouts.deleted")); qc.invalidateQueries({ queryKey: ["admin-payouts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{t("dash.payouts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dash.payouts.adminSub")}</p>
        </div>
        <GeneratePayoutDialog sellers={(sellersQ.data ?? []) as any[]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("dash.payouts.kpi.lifetimeNet")} value={AED(totals.lifetimeNet)} />
        <KpiCard label={t("dash.payouts.kpi.paid")} value={AED(totals.paidNet)} />
        <KpiCard label={t("dash.payouts.kpi.pending")} value={AED(totals.pendingNet)} tone="warn" />
        <KpiCard label={t("dash.payouts.kpi.commissionTotal")} value={AED(totals.commission)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("dash.payouts.searchSeller")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dash.payouts.allStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{t(`dash.payouts.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {payoutsQ.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("dash.payouts.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dash.payouts.col.seller")}</TableHead>
                    <TableHead>{t("dash.payouts.col.period")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.gross")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.commission")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.net")}</TableHead>
                    <TableHead>{t("dash.payouts.col.status")}</TableHead>
                    <TableHead className="text-right">{t("dash.payouts.col.paidAt")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.seller?.store_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.seller?.contact_email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.period_start} → {p.period_end}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{AED(p.gross_aed)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">−{AED(p.commission_aed)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">{AED(p.net_aed)}</TableCell>
                      <TableCell>
                        <Select
                          value={p.status}
                          onValueChange={(v) => updateMut.mutate({ payoutId: p.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <Badge variant="outline" className={`mr-1 px-1.5 py-0 text-[10px] ${STATUS_TONE[p.status] ?? ""}`}>
                              {t(`dash.payouts.status.${p.status}`)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{t(`dash.payouts.status.${s}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(p.status === "pending" || p.status === "processing") && (
                            <ReviewPayoutDialog payout={p} />
                          )}
                          {p.review_note && (
                            <span title={p.review_note}><FileText className="h-3.5 w-3.5 text-muted-foreground" /></span>
                          )}
                          {p.receipt_url && (
                            <a href={p.receipt_url} target="_blank" rel="noreferrer" title="Receipt"><FileText className="h-3.5 w-3.5 text-primary" /></a>
                          )}
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("dash.payouts.delete.title")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("dash.payouts.delete.desc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("dash.payouts.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(p.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("dash.payouts.delete.confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
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

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card className={tone === "warn" ? "border-amber-500/40" : ""}>
      <CardContent className="py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function GeneratePayoutDialog({ sellers }: { sellers: any[] }) {
  const { t } = useTranslation();
  const previewFn = useServerFn(adminPayoutPreview);
  const generateFn = useServerFn(adminGeneratePayout);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [sellerId, setSellerId] = useState<string>("");
  const [start, setStart] = useState<string>(monthAgo);
  const [end, setEnd] = useState<string>(today);
  const [preview, setPreview] = useState<{ gross: number; commission: number; net: number; orderCount: number; itemCount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setSellerId(""); setStart(monthAgo); setEnd(today); setPreview(null); };

  const onPreview = async () => {
    if (!sellerId) { toast.error(t("dash.payouts.dialog.selectSeller")); return; }
    setLoading(true);
    try {
      const r = await previewFn({ data: { sellerId, periodStart: start, periodEnd: end } });
      setPreview(r);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const onGenerate = async () => {
    setLoading(true);
    try {
      await generateFn({ data: { sellerId, periodStart: start, periodEnd: end } });
      toast.success(t("dash.payouts.dialog.generated"));
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setOpen(false);
      reset();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> {t("dash.payouts.dialog.trigger")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dash.payouts.dialog.title")}</DialogTitle>
          <DialogDescription>{t("dash.payouts.dialog.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dash.payouts.dialog.seller")}</Label>
            <Select value={sellerId} onValueChange={(v) => { setSellerId(v); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder={t("dash.payouts.dialog.selectSeller")} /></SelectTrigger>
              <SelectContent>
                {sellers.filter((s) => s.status === "active").map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.store_name} <span className="text-xs text-muted-foreground">· {s.commission_rate}%</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("dash.payouts.dialog.start")}</Label>
              <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPreview(null); }} />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.payouts.dialog.end")}</Label>
              <Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPreview(null); }} />
            </div>
          </div>

          {preview && (
            <Card className="bg-muted/40">
              <CardContent className="space-y-2 py-4 text-sm">
                <Row label={t("dash.payouts.dialog.orders")} value={`${preview.orderCount} (${preview.itemCount} items)`} />
                <Row label={t("dash.payouts.col.gross")} value={AED(preview.gross)} />
                <Row label={t("dash.payouts.col.commission")} value={`−${AED(preview.commission)}`} muted />
                <div className="border-t pt-2">
                  <Row label={t("dash.payouts.col.net")} value={AED(preview.net)} strong />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {!preview ? (
            <Button onClick={onPreview} disabled={loading || !sellerId} className="w-full sm:w-auto">
              {loading ? t("dash.payouts.dialog.loading") : t("dash.payouts.dialog.preview")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreview(null)}>{t("dash.payouts.dialog.back")}</Button>
              <Button onClick={onGenerate} disabled={loading || preview.gross <= 0}>
                {loading ? t("dash.payouts.dialog.loading") : t("dash.payouts.dialog.confirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`font-mono tabular-nums ${strong ? "font-semibold text-base" : ""} ${muted ? "text-muted-foreground" : ""}`}>{value}</span>
    </div>
  );
}

function ReviewPayoutDialog({ payout }: { payout: any }) {
  const qc = useQueryClient();
  const approveFn = useServerFn(adminApprovePayout);
  const rejectFn = useServerFn(adminRejectPayout);
  const uploadFn = useServerFn(adminUploadPayoutReceipt);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setMode("approve"); setNote(""); setReceiptPath(null); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const b64: string = await new Promise((res) => { reader.onload = () => res(String(reader.result).split(",")[1]); reader.readAsDataURL(file); });
      const r = await uploadFn({ data: { payoutId: payout.id, filename: file.name, contentType: file.type || "application/pdf", dataBase64: b64 } });
      setReceiptPath(r.path);
      toast.success("Receipt uploaded");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (mode === "reject" && !note.trim()) { toast.error("A reason is required for rejection."); return; }
    try {
      if (mode === "approve") {
        await approveFn({ data: { payoutId: payout.id, note: note || undefined, receipt_path: receiptPath || undefined } });
        toast.success("Payout approved and marked as paid");
      } else {
        await rejectFn({ data: { payoutId: payout.id, note, receipt_path: receiptPath || undefined } });
        toast.success("Payout rejected");
      }
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      setOpen(false); reset();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">Review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review payout</DialogTitle>
          <DialogDescription>
            {payout.seller?.store_name} · {AED(payout.net_aed)} net ({payout.period_start} → {payout.period_end})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant={mode === "approve" ? "default" : "outline"} size="sm" onClick={() => setMode("approve")} className="gap-1"><Check className="h-3 w-3" />Approve & pay</Button>
            <Button type="button" variant={mode === "reject" ? "default" : "outline"} size="sm" onClick={() => setMode("reject")} className="gap-1"><X className="h-3 w-3" />Reject</Button>
          </div>
          <div>
            <Label>{mode === "reject" ? "Reason (required)" : "Note (optional)"}</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "reject" ? "Why is this being rejected?" : "Internal note (sent to seller)"} />
          </div>
          <div>
            <Label>Receipt (optional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <input ref={fileRef} type="file" hidden accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <UploadIcon className="h-3 w-3 mr-1" />{uploading ? "Uploading…" : receiptPath ? "Replace" : "Upload"}
              </Button>
              {receiptPath && <span className="text-xs text-muted-foreground">Uploaded ✓</span>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>{mode === "approve" ? "Approve & mark paid" : "Reject"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}