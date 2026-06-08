import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRef } from "react";
import { getSellerSettings, updateSellerSettings, getKycStatus, uploadKycDocument, removeKycDocument, submitKycForReview } from "@/lib/seller.functions";
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Upload as UploadIcon, Trash2, FileText, Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/_authenticated/seller/settings")({
  head: () => ({ meta: [{ title: "Settings — Seller Studio" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: SellerSettings,
});

function SellerSettings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const get = useServerFn(getSellerSettings);
  const save = useServerFn(updateSellerSettings);
  const q = useQuery({ queryKey: ["seller-settings"], queryFn: () => get({}) });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (q.data && !f) setF({ ...q.data }); }, [q.data]);

  const m = useMutation({
    mutationFn: () => save({ data: {
      legal_name: f.legal_name || null, trn: f.trn || null, vat_number: f.vat_number || null,
      support_email: f.support_email || "", support_phone: f.support_phone || null,
      contact_address: f.contact_address || null,
      processing_days: Number(f.processing_days) || 2,
      auto_accept_orders: !!f.auto_accept_orders,
      vacation_mode: !!f.vacation_mode, vacation_message: f.vacation_message || null,
      payout_method: f.payout_method ?? "bank",
      bank_name: f.bank_name || null, bank_iban: f.bank_iban || null,
      bank_swift: f.bank_swift || null, bank_account_holder: f.bank_account_holder || null,
      notify_new_order: !!f.notify_new_order, notify_low_stock: !!f.notify_low_stock, notify_payout: !!f.notify_payout,
      address_line1: f.address_line1 || null, address_line2: f.address_line2 || null,
      city: f.city || null, country: f.country || null, postal_code: f.postal_code || null,
      currency: (f.currency || "AED") as any,
      tax_inclusive_pricing: !!f.tax_inclusive_pricing,
      tax_rate: Number(f.tax_rate) || 0,
      accepted_payment_methods: (f.accepted_payment_methods?.length ? f.accepted_payment_methods : ["card"]) as any,
      notify_review: !!f.notify_review, notify_return: !!f.notify_return,
      payout_schedule: (f.payout_schedule ?? "manual") as any,
      min_payout_aed: Number(f.min_payout_aed) || 0,
    }}),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["seller-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (!f) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const allowedTabs = new Set(["business", "address", "contact", "ops", "tax", "payout", "verification", "notif"]);
  const activeTab = search.tab && allowedTabs.has(search.tab) ? search.tab : "business";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Business, operations, payout, and notification preferences."
        icon={SettingsIcon}
        breadcrumbs={[{ label: "Seller Studio", to: "/seller" }, { label: "Settings" }]}
        actions={
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      {f.vacation_mode && (
        <Alert>
          <AlertDescription>Vacation mode is on — buyers will see a notice and orders may be paused.</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => navigate({
          to: "/seller/settings",
          search: tab === "business" ? {} : { tab },
        })}
      >
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="ops">Operations</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="notif">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card><CardHeader><CardTitle>Legal & tax</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Legal name</Label><Input value={f.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} /></div>
              <div><Label>Trade license / TRN</Label><Input value={f.trn ?? ""} onChange={(e) => set("trn", e.target.value)} /></div>
              <div><Label>VAT number</Label><Input value={f.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} /></div>
              <div>
                <Label>Default currency</Label>
                <Select value={f.currency ?? "AED"} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["AED", "USD", "EUR", "MXN", "SAR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="address">
          <Card><CardHeader><CardTitle>Business address</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label>Address line 1</Label><Input value={f.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Address line 2</Label><Input value={f.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} /></div>
              <div><Label>City</Label><Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
              <div><Label>Postal code</Label><Input value={f.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} /></div>
              <div>
                <Label>Country</Label>
                <Select value={f.country ?? ""} onValueChange={(v) => set("country", v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {["United Arab Emirates", "Saudi Arabia", "Mexico", "United States", "Spain", "United Kingdom", "Other"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card><CardHeader><CardTitle>Support contact</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Support email</Label><Input type="email" value={f.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} /></div>
              <div><Label>Support phone</Label><Input value={f.support_phone ?? ""} onChange={(e) => set("support_phone", e.target.value)} /></div>
            </div>
            <div><Label>Business address</Label><Textarea rows={3} value={f.contact_address ?? ""} onChange={(e) => set("contact_address", e.target.value)} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ops">
          <Card><CardHeader><CardTitle>Operations</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Processing days</Label>
                <Input type="number" min={1} max={14} value={f.processing_days ?? 2} onChange={(e) => set("processing_days", Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">How many business days you need to ship a confirmed order.</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Auto-accept orders</Label><p className="text-xs text-muted-foreground">Confirm new orders automatically instead of manual approval.</p></div>
              <Switch checked={!!f.auto_accept_orders} onCheckedChange={(v) => set("auto_accept_orders", v)} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Vacation mode</Label><p className="text-xs text-muted-foreground">Show a notice on your storefront and pause new orders.</p></div>
              <Switch checked={!!f.vacation_mode} onCheckedChange={(v) => set("vacation_mode", v)} />
            </div>
            {f.vacation_mode && (
              <div><Label>Vacation message</Label><Textarea rows={3} maxLength={280} value={f.vacation_message ?? ""} onChange={(e) => set("vacation_message", e.target.value)} /></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card><CardHeader><CardTitle>Tax</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Tax-inclusive pricing</Label><p className="text-xs text-muted-foreground">Show prices with tax already included.</p></div>
              <Switch checked={!!f.tax_inclusive_pricing} onCheckedChange={(v) => set("tax_inclusive_pricing", v)} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Tax rate (%)</Label><Input type="number" min={0} max={100} step="0.01" value={f.tax_rate ?? 0} onChange={(e) => set("tax_rate", Number(e.target.value))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Configure VAT or sales tax if your jurisdiction requires it. The marketplace uses the platform tax setting; this is informational and used in invoices.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payout">
          <Card><CardHeader><CardTitle>Payout details</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Payout schedule</Label>
                <Select value={f.payout_schedule ?? "manual"} onValueChange={(v) => set("payout_schedule", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (request anytime)</SelectItem>
                    <SelectItem value="weekly">Weekly (auto)</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks (auto)</SelectItem>
                    <SelectItem value="monthly">Monthly (auto)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Automatic payouts run nightly and require KYC verification.</p>
              </div>
              <div>
                <Label>Minimum payout (AED)</Label>
                <Input type="number" min={0} step="1" value={f.min_payout_aed ?? 0} onChange={(e) => set("min_payout_aed", Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">Auto payouts are skipped if available balance is below this threshold.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Payout method</Label>
                <Select value={f.payout_method ?? "bank"} onValueChange={(v) => set("payout_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                    <SelectItem value="wallet">Digital wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Account holder</Label><Input value={f.bank_account_holder ?? ""} onChange={(e) => set("bank_account_holder", e.target.value)} /></div>
              <div><Label>Bank name</Label><Input value={f.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></div>
              <div><Label>IBAN / account #</Label><Input value={f.bank_iban ?? ""} onChange={(e) => set("bank_iban", e.target.value)} /></div>
              <div><Label>SWIFT / BIC</Label><Input value={f.bank_swift ?? ""} onChange={(e) => set("bank_swift", e.target.value)} /></div>
            </div>
            <div className="pt-4 border-t">
              <Label className="text-sm">Accepted payment methods from buyers</Label>
              <p className="text-xs text-muted-foreground mb-2">Methods you accept for your sales.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { k: "card", label: "Credit / debit card" },
                  { k: "apple_pay", label: "Apple Pay" },
                  { k: "google_pay", label: "Google Pay" },
                  { k: "cod", label: "Cash on delivery" },
                  { k: "bank_transfer", label: "Bank transfer" },
                ].map((opt) => {
                  const arr: string[] = f.accepted_payment_methods ?? [];
                  const on = arr.includes(opt.k);
                  return (
                    <label key={opt.k} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                      <Checkbox checked={on} onCheckedChange={(v) => {
                        const next = v ? [...arr, opt.k] : arr.filter((x) => x !== opt.k);
                        set("accepted_payment_methods", next.length ? next : ["card"]);
                      }} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="verification">
          <KycSection />
        </TabsContent>

        <TabsContent value="notif">
          <Card><CardHeader><CardTitle>Email notifications</CardTitle></CardHeader><CardContent className="space-y-4">
            {[
              { k: "notify_new_order", label: "New order", desc: "When a buyer places a new order with your store." },
              { k: "notify_low_stock", label: "Low stock", desc: "When a variant drops to 5 units or fewer." },
              { k: "notify_payout", label: "Payout updates", desc: "When a payout is scheduled or paid." },
              { k: "notify_review", label: "New review", desc: "When a buyer leaves a review on your product." },
              { k: "notify_return", label: "Return requests", desc: "When a buyer requests a return or refund." },
            ].map((row) => (
              <div className="flex items-center justify-between" key={row.k}>
                <div><Label>{row.label}</Label><p className="text-xs text-muted-foreground">{row.desc}</p></div>
                <Switch checked={!!f[row.k]} onCheckedChange={(v) => set(row.k, v)} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KycSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(getKycStatus);
  const upFn = useServerFn(uploadKycDocument);
  const rmFn = useServerFn(removeKycDocument);
  const submitFn = useServerFn(submitKycForReview);
  const q = useQuery({ queryKey: ["seller-kyc"], queryFn: () => getFn({}) });
  const KINDS: { k: "trade_license" | "emirates_id" | "passport" | "other"; label: string; required?: boolean }[] = [
    { k: "trade_license", label: "Trade License", required: true },
    { k: "emirates_id", label: "Emirates ID" },
    { k: "passport", label: "Passport" },
    { k: "other", label: "Other supporting doc" },
  ];
  const status = q.data?.status ?? "unverified";
  const docs = q.data?.documents ?? [];
  const hasTL = docs.some((d: any) => d.kind === "trade_license");

  const submitMut = useMutation({
    mutationFn: () => submitFn({}),
    onSuccess: () => { toast.success("Submitted for review"); qc.invalidateQueries({ queryKey: ["seller-kyc"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const rmMut = useMutation({
    mutationFn: (kind: string) => rmFn({ data: { kind: kind as any } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller-kyc"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const handleFile = async (kind: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = String(reader.result).split(",")[1];
        await upFn({ data: { kind: kind as any, filename: file.name, contentType: file.type || "application/octet-stream", dataBase64: b64 } });
        toast.success("Uploaded");
        qc.invalidateQueries({ queryKey: ["seller-kyc"] });
      } catch (e: any) { toast.error(e.message); }
    };
    reader.readAsDataURL(file);
  };

  const tone: Record<string, { icon: any; label: string; cls: string }> = {
    unverified: { icon: ShieldAlert, label: "Not verified", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
    pending: { icon: Clock, label: "Under review", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700" },
    verified: { icon: ShieldCheck, label: "Verified", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
    rejected: { icon: ShieldX, label: "Rejected", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  };
  const T = tone[status] ?? tone.unverified;

  return (
    <Card>
      <CardHeader>
        <CardTitle>KYC Verification</CardTitle>
        <p className="text-sm text-muted-foreground">Verify your business to enable payouts. Documents are private and only visible to our admin team.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={`flex items-center gap-3 rounded-lg border p-3 ${T.cls}`}>
          <T.icon className="h-5 w-5" />
          <div className="flex-1">
            <div className="text-sm font-medium">{T.label}</div>
            {status === "rejected" && q.data?.rejection_reason && (
              <div className="text-xs">{q.data.rejection_reason}</div>
            )}
            {status === "pending" && q.data?.submitted_at && (
              <div className="text-xs">Submitted {new Date(q.data.submitted_at).toLocaleString()}</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {KINDS.map((k) => {
            const doc = docs.find((d: any) => d.kind === k.k);
            return <KycDocRow key={k.k} doc={doc} kind={k.k} label={k.label} required={k.required} onFile={handleFile} onRemove={(kk: string) => rmMut.mutate(kk)} />;
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => submitMut.mutate()} disabled={!hasTL || status === "pending" || submitMut.isPending}>
            {status === "pending" ? "Under review" : status === "verified" ? "Re-submit" : "Submit for review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KycDocRow({ doc, kind, label, required, onFile, onRemove }: any) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium flex items-center gap-2">{label}{required && <Badge variant="outline" className="text-[10px]">Required</Badge>}</div>
        {doc ? (
          <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View uploaded ({new Date(doc.uploaded_at).toLocaleDateString()})</a>
        ) : (
          <div className="text-xs text-muted-foreground">No file uploaded</div>
        )}
      </div>
      <input ref={ref} type="file" hidden accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(kind, f); e.target.value = ""; }} />
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()}><UploadIcon className="h-3 w-3 mr-1" />{doc ? "Replace" : "Upload"}</Button>
      {doc && <Button size="icon" variant="ghost" onClick={() => onRemove(kind)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
    </div>
  );
}