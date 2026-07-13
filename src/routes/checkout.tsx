import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart, cartTotals, groupBySeller } from "@/lib/cart";
import { placeOrder } from "@/lib/orders.functions";
import { createStripeSession } from "@/lib/payments.functions";
import { getShippingQuote, EMIRATE_FORM_TO_DB } from "@/lib/shipping.functions";
import { validateCoupon } from "@/lib/coupons.functions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "@/lib/track";
import { buildCheckoutLegalAcceptancePayload } from "@/lib/legal-acceptance";
import { getAvailablePaymentMethods, type PaymentMethodId } from "@/lib/payment-methods";

export const Route = createFileRoute("/checkout")({
  beforeLoad: () => {
    if (import.meta.env.VITE_CORNERMEX_CHECKOUT_ENABLED !== "true") {
      throw redirect({ to: "/cart" });
    }
  },
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

function Checkout() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const totals = cartTotals(items);
  const groups = groupBySeller(items);
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const createStripe = useServerFn(createStripeSession);
  const quoteFn = useServerFn(getShippingQuote);
  const validate = useServerFn(validateCoupon);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<null | { code: string; discount_aed: number; description: string | null }>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    trackEvent("checkout_started", {
      source: "checkout",
      metadata: { itemCount: items.length, subtotal: totals.subtotal },
    });
    // only on first mount when cart has items
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [payment, setPayment] = useState<PaymentMethodId | null>("card");
  const [submitting, setSubmitting] = useState(false);

  // Device availability for wallet payments (Apple Pay / Google Pay).
  const [wallet, setWallet] = useState({ applePay: false, googlePay: false });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apple = !!(window as any).ApplePaySession && typeof (window as any).ApplePaySession.canMakePayments === "function"
      ? !!(window as any).ApplePaySession.canMakePayments()
      : false;
    const google = typeof (window as any).PaymentRequest !== "undefined";
    setWallet({ applePay: apple, googlePay: google });
  }, []);

  const paymentMethods = useMemo(
    () =>
      getAvailablePaymentMethods({
        subtotal: totals.subtotal,
        emirate: form.emirate as import("@/lib/payment-methods").EmirateCode,
        applePayAvailable: wallet.applePay,
        googlePayAvailable: wallet.googlePay,
      }),
    [totals.subtotal, form.emirate, wallet.applePay, wallet.googlePay],
  );

  // Auto-clear selection if it becomes unavailable after cart/address changes.
  useEffect(() => {
    if (!payment) return;
    const found = paymentMethods.find((m) => m.id === payment);
    if (!found || !found.enabled) setPayment(null);
  }, [paymentMethods, payment]);

  const dbEmirate = EMIRATE_FORM_TO_DB[form.emirate];
  const quoteEnabled = items.length > 0 && !!dbEmirate;
  const shippingQuery = useQuery({
    queryKey: ["shipping-quote", dbEmirate, items.map((i) => `${i.variantId}:${i.qty}`).join(",")],
    queryFn: () => quoteFn({
      data: {
        emirate: dbEmirate as any,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      },
    }),
    enabled: quoteEnabled,
    staleTime: 30_000,
  });

  const liveShipping = shippingQuery.data?.error ? null : (shippingQuery.data?.total ?? null);
  const effectiveShipping = liveShipping ?? totals.shipping;
  const discount = coupon?.discount_aed ?? 0;
  const effectiveTotal = +(totals.subtotal - discount + effectiveShipping + totals.tax).toFixed(2);

  async function applyCoupon() {
    setCouponMsg(null);
    if (!couponInput.trim()) return;
    const r = await validate({ data: { code: couponInput, subtotal: totals.subtotal } });
    if (r.ok) {
      setCoupon({ code: r.coupon.code, discount_aed: r.coupon.discount_aed, description: r.coupon.description });
      setCouponMsg(`Applied: ${r.coupon.code} (−AED ${r.coupon.discount_aed.toFixed(2)})`);
    } else {
      setCoupon(null);
      setCouponMsg(r.error);
    }
  }

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
    if (!payment) {
      toast.error("Please select an available payment method for your order.");
      return;
    }
    setSubmitting(true);
    // Per-order legal acceptance evidence — persisted on
    // public.orders.legal_acceptance (jsonb) via placeOrder().
    const legalAcceptance = buildCheckoutLegalAcceptancePayload();
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
          coupon_code: coupon?.code ?? null,
          legal_acceptance: legalAcceptance,
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
                {paymentMethods.map((opt) => {
                  const Icon = opt.icon;
                  const active = payment === opt.id;
                  const disabled = !opt.enabled;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => !disabled && setPayment(opt.id)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition-all ${active ? "border-foreground bg-foreground/[0.03]" : "border-border hover:border-foreground/30"} ${disabled ? "cursor-not-allowed opacity-50 hover:border-border" : ""}`}
                    >
                      <Icon className="h-5 w-5 text-foreground" />
                      <div>
                        <div className="text-sm font-medium">{opt.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {disabled && opt.unavailableReason ? opt.unavailableReason : opt.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!payment && (
                <p className="mt-3 text-xs text-destructive">
                  Please select an available payment method for your order.
                </p>
              )}
              <p className="mt-4 text-[11px] text-muted-foreground">
                Secure payment options available at checkout. Some methods may depend on order value and delivery location.
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
              {discount > 0 && (
                <div className="flex justify-between text-primary"><dt>Discount ({coupon?.code})</dt><dd>− AED {discount.toFixed(2)}</dd></div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Shipping
                  {shippingQuery.isLoading && <span className="ms-1 text-xs">…</span>}
                </dt>
                <dd>{effectiveShipping === 0 ? "Free" : `AED ${effectiveShipping.toFixed(2)}`}</dd>
              </div>
              {shippingQuery.data?.perSeller && shippingQuery.data.perSeller.length > 1 && (
                <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                  {shippingQuery.data.perSeller.map((s) => (
                    <div key={s.sellerId} className="flex justify-between">
                      <span className="truncate pe-2">↳ {s.sellerName}{s.freeShippingApplied ? " (free)" : ""}</span>
                      <span>AED {s.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {shippingQuery.data?.slaMin != null && shippingQuery.data.slaMax != null && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <dt>Estimated delivery</dt>
                  <dd>{shippingQuery.data.slaMin}–{shippingQuery.data.slaMax} business days</dd>
                </div>
              )}
              {shippingQuery.data?.error && (
                <div className="text-xs text-destructive">{shippingQuery.data.error}</div>
              )}
              <div className="flex justify-between"><dt className="text-muted-foreground">VAT (5%)</dt><dd>AED {totals.tax.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Total</dt><dd>AED {effectiveTotal.toFixed(2)}</dd></div>
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <Label className="text-xs text-muted-foreground">Promo code</Label>
              <div className="mt-1.5 flex gap-2">
                <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="WELCOME10" />
                <Button type="button" variant="outline" onClick={applyCoupon}>Apply</Button>
              </div>
              {couponMsg && <p className={`mt-2 text-xs ${coupon ? "text-primary" : "text-destructive"}`}>{couponMsg}</p>}
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="mt-6 w-full rounded-full bg-foreground text-background hover:bg-foreground/90">
              {submitting ? "Placing order…" : `Place order · AED ${effectiveTotal.toFixed(2)}`}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              By placing your order, you are buying directly from CornerMex under our{" "}
              <Link to="/legal/$slug" params={{ slug: "terms-and-conditions" }} className="underline">Terms &amp; Conditions</Link>,{" "}
              <Link to="/legal/$slug" params={{ slug: "privacy-policy" }} className="underline">Privacy Policy</Link>,{" "}
              <Link to="/legal/$slug" params={{ slug: "returns-refunds" }} className="underline">Returns &amp; Refunds Policy</Link>,{" "}
              <Link to="/legal/$slug" params={{ slug: "cookie-policy" }} className="underline">Cookie Policy</Link>{" "}
              and{" "}
              <Link to="/legal/$slug" params={{ slug: "ai-transparency" }} className="underline">AI Transparency Notice</Link>{" "}
              where applicable.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Delivery and refund timelines are governed by our{" "}
              <Link to="/legal/$slug" params={{ slug: "returns-refunds" }} className="underline">Returns &amp; Refunds</Link>{" "}
              and{" "}
              <Link to="/legal/$slug" params={{ slug: "product-sourcing-compliance" }} className="underline">Product Sourcing &amp; Service Levels</Link>{" "}
              policies.
            </p>
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
