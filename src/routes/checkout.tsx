import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Smartphone, Truck, Wallet, Building2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart, cartTotals, groupBySeller } from "@/lib/cart";
import { placeOrder } from "@/lib/orders.functions";
import { createStripeSession } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Corner Mex" }] }),
  component: Checkout,
});

const EMIRATES = [
  { code: "DU", name: "Dubai" },
  { code: "AD", name: "Abu Dhabi" },
  { code: "SH", name: "Sharjah" },
  { code: "AJ", name: "Ajman" },
  { code: "UQ", name: "Umm Al Quwain" },
  { code: "RK", name: "Ras Al Khaimah" },
  { code: "FU", name: "Fujairah" },
];

const PAYMENT_OPTIONS = [
  { id: "card", label: "Credit / Debit card", icon: CreditCard, hint: "Visa, Mastercard, Amex" },
  { id: "apple_pay", label: "Apple Pay", icon: Smartphone, hint: "One-tap checkout" },
  { id: "google_pay", label: "Google Pay", icon: Smartphone, hint: "Fast & secure" },
  { id: "tabby", label: "Tabby", icon: Wallet, hint: "Pay in 4 · 0% interest" },
  { id: "tamara", label: "Tamara", icon: Wallet, hint: "Split into 3 payments" },
  { id: "bank_transfer", label: "Bank transfer", icon: Building2, hint: "AED IBAN" },
  { id: "cod", label: "Cash on delivery", icon: Truck, hint: "Pay the courier" },
] as const;

function Checkout() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const totals = cartTotals(items);
  const groups = groupBySeller(items);
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const createStripe = useServerFn(createStripeSession);

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    emirate: "DU" as (typeof EMIRATES)[number]["code"],
    area: "",
    street: "",
    building: "",
    floor_apt: "",
    landmark: "",
    notes: "",
  });
  const [payment, setPayment] = useState<(typeof PAYMENT_OPTIONS)[number]["id"]>("card");
  const [submitting, setSubmitting] = useState(false);

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl">Your cart is empty</h1>
          <Link to="/shop"><Button className="mt-6 rounded-full bg-foreground text-background hover:bg-foreground/90">Browse shop</Button></Link>
        </section>
      </SiteLayout>
    );
  }

  if (authed === false) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-3xl">Sign in to continue</h1>
          <p className="mt-3 text-sm text-muted-foreground">You need an account to place an order. Your cart will be waiting.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login"><Button variant="outline" className="rounded-full">Sign in</Button></Link>
            <Link to="/signup"><Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">Create account</Button></Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipient_name || !form.phone || !form.area) {
      toast.error("Please complete required fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await place({
        data: {
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          payment_method: payment,
          shipping_address: {
            recipient_name: form.recipient_name,
            phone: form.phone,
            emirate: form.emirate as "AD" | "DU" | "SH" | "AJ" | "UQ" | "RK" | "FU",
            area: form.area,
            street: form.street || null,
            building: form.building || null,
            floor_apt: form.floor_apt || null,
            landmark: form.landmark || null,
          },
          notes: form.notes || null,
        },
      });

      // Route based on payment method
      if (["card", "apple_pay", "google_pay"].includes(payment)) {
        try {
          const stripeRes = await createStripe({ data: { orderId: res.orderId } });
          if (stripeRes.url) {
            clear();
            window.location.href = stripeRes.url;
            return;
          }
        } catch (stripeErr: any) {
          toast.error(stripeErr?.message ?? "Payment gateway error");
          setSubmitting(false);
          return;
        }
      } else if (["tabby", "tamara"].includes(payment)) {
        clear();
        navigate({ to: "/checkout/bnpl/$provider/$orderId", params: { provider: payment, orderId: res.orderId } });
        return;
      } else {
        // COD / bank_transfer
        clear();
        toast.success(`Order ${res.orderNumber} placed`);
        navigate({ to: "/order-confirmed", search: { order: res.orderId } });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl tracking-tight">Checkout</h1>

        <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
          <div className="space-y-10">
            {/* Shipping */}
            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl">Shipping address</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Recipient name *"><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></Field>
                <Field label="Phone *"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 …" /></Field>
                <Field label="Emirate *">
                  <Select value={form.emirate} onValueChange={(v) => setForm({ ...form, emirate: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EMIRATES.map((e) => <SelectItem key={e.code} value={e.code}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Area / Neighborhood *"><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
                <Field label="Street"><Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></Field>
                <Field label="Building"><Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} /></Field>
                <Field label="Floor / Apartment"><Input value={form.floor_apt} onChange={(e) => setForm({ ...form, floor_apt: e.target.value })} /></Field>
                <Field label="Landmark"><Input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} /></Field>
              </div>
              <div className="mt-4">
                <Field label="Order notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></Field>
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-xl">Payment method</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setPayment(opt.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition-all ${active ? "border-foreground bg-foreground/[0.03]" : "border-border hover:border-foreground/30"}`}
                    >
                      <Icon className="h-5 w-5 text-foreground" />
                      <div>
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.hint}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground">
                Card / Apple Pay / Google Pay redirect to Stripe. Tabby / Tamara are in demo mode.
              </p>
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">Order summary</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {groups.map((g) => (
                <li key={g.sellerId}>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{g.sellerName}</div>
                  <ul className="mt-1 space-y-1">
                    {g.items.map((i) => (
                      <li key={i.variantId} className="flex justify-between text-sm">
                        <span className="truncate pe-3">{i.qty} × {i.name}</span>
                        <span>AED {(i.unitPrice * i.qty).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>AED {totals.subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{totals.shipping === 0 ? "Free" : `AED ${totals.shipping.toFixed(2)}`}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">VAT (5%)</dt><dd>AED {totals.tax.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Total</dt><dd>AED {totals.total.toFixed(2)}</dd></div>
            </dl>
            <Button type="submit" size="lg" disabled={submitting} className="mt-6 w-full rounded-full bg-foreground text-background hover:bg-foreground/90">
              {submitting ? "Placing order…" : `Place order · AED ${totals.total.toFixed(2)}`}
            </Button>
          </aside>
        </form>
      </section>
    </SiteLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}