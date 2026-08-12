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
import { getReviewableItems } from "@/lib/reviews.functions";
import { isAdmin } from "@/lib/admin.functions";
import { getMyLoyalty } from "@/lib/loyalty.functions";
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
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders({}) });
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => fetchIsAdmin({}) });
  const loyalty = useQuery({ queryKey: ["my-loyalty"], queryFn: () => fetchLoyalty({}) });
  const fetchReviewable = useServerFn(getReviewableItems);
  const reviewable = useQuery({ queryKey: ["my-reviewable"], queryFn: () => fetchReviewable({}) });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-tight">My account</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{account.data?.email}</span>
              {loyalty.data && (
                <Badge variant="outline" className="uppercase tracking-wider">
                  {loyalty.data.account.tier} · {loyalty.data.account.points_balance} pts
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.data?.seller && (
              <Link to="/seller">
                <Button variant="outline" className="rounded-full">
                  Seller dashboard
                </Button>
              </Link>
            )}
            {admin.data?.admin && (
              <Link to="/admin">
                <Button variant="outline" className="rounded-full">
                  Admin
                </Button>
              </Link>
            )}
            <Link to="/account/notifications">
              <Button variant="outline" className="rounded-full">
                Notifications
              </Button>
            </Link>
            <Link to="/account/wishlist">
              <Button variant="outline" className="rounded-full">
                Wishlist
              </Button>
            </Link>
            <Link to="/account/loyalty">
              <Button variant="outline" className="rounded-full">
                Loyalty
              </Button>
            </Link>
            <Link to="/account/returns">
              <Button variant="outline" className="rounded-full">
                Returns
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : orders.isError ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm font-medium text-destructive">
                    We couldn't load your orders.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => orders.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : (orders.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have no orders yet.{" "}
                  <Link to="/shop" className="underline">
                    Start shopping →
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {(orders.data ?? []).map((o: any) => (
                    <OrderRow key={o.id} order={o} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {(reviewable.data ?? []).length > 0 && (
              <PendingReviewsCard items={reviewable.data as any[]} />
            )}
            {!account.data?.seller && <BecomeSellerCard />}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function PendingReviewsCard({ items }: { items: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Share your experience on items you received.
        </p>
        <ul className="space-y-2">
          {items.slice(0, 5).map((it) => (
            <li
              key={it.order_item_id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{it.product_name}</p>
                {it.variant_label && (
                  <p className="truncate text-xs text-muted-foreground">{it.variant_label}</p>
                )}
              </div>
              {it.product_slug && (
                <Link to="/product/$slug" params={{ slug: it.product_slug }}>
                  <Button size="sm" variant="outline" className="rounded-full">
                    Review
                  </Button>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function OrderRow({ order }: { order: any }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleString()} · {order.items?.length ?? 0} items
            {order.sla_min_days ? (
              <>
                {" "}
                · ETA {order.sla_min_days}-{order.sla_max_days} days
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{order.status}</Badge>
          <Badge variant="outline">{order.payment_status}</Badge>
          <span className="font-medium tabular-nums">{Number(order.total_aed).toFixed(2)} AED</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/account/orders/$id" params={{ id: order.id }}>
              View order
            </Link>
          </Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt>Subtotal</dt>
          <dd>{Number(order.subtotal_aed).toFixed(2)} AED</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{Number(order.shipping_aed).toFixed(2)} AED</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{Number(order.tax_aed).toFixed(2)} AED</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd className="uppercase">{order.payment_method ?? "—"}</dd>
        </div>
      </dl>
    </li>
  );
}

function BecomeSellerCard() {
  const qc = useQueryClient();
  const fn = useServerFn(becomeSeller);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    store_name: "",
    tagline: "",
    bio: "",
    contact_email: "",
    contact_phone: "",
    trn: "",
  });
  const m = useMutation({
    mutationFn: (input: typeof form) => fn({ data: input }),
    onSuccess: () => {
      toast.success("Seller application submitted");
      qc.invalidateQueries({ queryKey: ["account"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Become a seller</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sell your Mexican products across the UAE. Pending approval by our team.
        </p>
        {!open ? (
          <Button className="w-full rounded-full" onClick={() => setOpen(true)}>
            Apply now
          </Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate(form);
            }}
            className="space-y-3"
          >
            <div>
              <Label>Store name</Label>
              <Input
                required
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>TRN (optional)</Label>
              <Input value={form.trn} onChange={(e) => setForm({ ...form, trn: e.target.value })} />
            </div>
            <Button type="submit" disabled={m.isPending} className="w-full rounded-full">
              {m.isPending ? "..." : "Submit"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
