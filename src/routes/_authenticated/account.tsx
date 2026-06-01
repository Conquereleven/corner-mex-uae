import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getMyAccount, getMyOrders, becomeSeller } from "@/lib/account.functions";
import { adminBootstrap, isAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Corner Mex" }] }),
  component: Account,
});

function Account() {
  const fetchAccount = useServerFn(getMyAccount);
  const fetchOrders = useServerFn(getMyOrders);
  const fetchIsAdmin = useServerFn(isAdmin);
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders({}) });
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => fetchIsAdmin({}) });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-tight">My account</h1>
            <p className="mt-1 text-sm text-muted-foreground">{account.data?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.data?.seller && (
              <Link to="/seller"><Button variant="outline" className="rounded-full">Seller dashboard</Button></Link>
            )}
            {admin.data?.admin && (
              <Link to="/admin"><Button variant="outline" className="rounded-full">Admin</Button></Link>
            )}
            <Link to="/account/quotes"><Button variant="outline" className="rounded-full">My quotes</Button></Link>
            <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Sign out</Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
            <CardContent>
              {orders.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (orders.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">You have no orders yet. <Link to="/shop" className="underline">Start shopping →</Link></p>
              ) : (
                <ul className="divide-y divide-border">
                  {(orders.data ?? []).map((o: any) => (
                    <li key={o.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{o.order_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.items?.length ?? 0} items</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{o.status}</Badge>
                          <Badge variant="outline">{o.payment_status}</Badge>
                          <span className="font-medium tabular-nums">{Number(o.total_aed).toFixed(2)} AED</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {!account.data?.seller && <BecomeSellerCard />}
            {!admin.data?.admin && <AdminBootstrapCard />}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function BecomeSellerCard() {
  const qc = useQueryClient();
  const fn = useServerFn(becomeSeller);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ store_name: "", tagline: "", bio: "", contact_email: "", contact_phone: "", trn: "" });
  const m = useMutation({
    mutationFn: (input: typeof form) => fn({ data: input }),
    onSuccess: () => { toast.success("Seller application submitted"); qc.invalidateQueries({ queryKey: ["account"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Become a seller</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Sell your Mexican products across the UAE. Pending approval by our team.</p>
        {!open ? (
          <Button className="w-full rounded-full" onClick={() => setOpen(true)}>Apply now</Button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); m.mutate(form); }} className="space-y-3">
            <div><Label>Store name</Label><Input required value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></div>
            <div><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            <div><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>
            <div><Label>TRN (optional)</Label><Input value={form.trn} onChange={(e) => setForm({ ...form, trn: e.target.value })} /></div>
            <Button type="submit" disabled={m.isPending} className="w-full rounded-full">{m.isPending ? "..." : "Submit"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function AdminBootstrapCard() {
  const qc = useQueryClient();
  const fn = useServerFn(adminBootstrap);
  const m = useMutation({
    mutationFn: () => fn({}),
    onSuccess: () => { toast.success("You are now admin"); qc.invalidateQueries({ queryKey: ["is-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Claim admin</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">If no admin exists yet, you can claim it for this workspace.</p>
        <Button variant="outline" className="w-full rounded-full" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? "..." : "Claim admin role"}
        </Button>
      </CardContent>
    </Card>
  );
}