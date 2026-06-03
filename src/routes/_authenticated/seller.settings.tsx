import { createFileRoute } from "@tanstack/react-router";
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
import { toast } from "sonner";
import { getSellerSettings, updateSellerSettings } from "@/lib/seller.functions";

export const Route = createFileRoute("/_authenticated/seller/settings")({
  head: () => ({ meta: [{ title: "Settings — Seller Studio" }] }),
  component: SellerSettings,
});

function SellerSettings() {
  const qc = useQueryClient();
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
    }}),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["seller-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  if (!f) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Business, operations, payout, and notification preferences.</p>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Saving…" : "Save changes"}</Button>
      </div>

      {f.vacation_mode && (
        <Alert>
          <AlertDescription>Vacation mode is on — buyers will see a notice and orders may be paused.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="ops">Operations</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
          <TabsTrigger value="notif">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card><CardHeader><CardTitle>Legal & tax</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Legal name</Label><Input value={f.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} /></div>
              <div><Label>Trade license / TRN</Label><Input value={f.trn ?? ""} onChange={(e) => set("trn", e.target.value)} /></div>
              <div><Label>VAT number</Label><Input value={f.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} /></div>
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

        <TabsContent value="payout">
          <Card><CardHeader><CardTitle>Payout details</CardTitle></CardHeader><CardContent className="space-y-4">
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
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="notif">
          <Card><CardHeader><CardTitle>Email notifications</CardTitle></CardHeader><CardContent className="space-y-4">
            {[
              { k: "notify_new_order", label: "New order", desc: "When a buyer places a new order with your store." },
              { k: "notify_low_stock", label: "Low stock", desc: "When a variant drops to 5 units or fewer." },
              { k: "notify_payout", label: "Payout updates", desc: "When a payout is scheduled or paid." },
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