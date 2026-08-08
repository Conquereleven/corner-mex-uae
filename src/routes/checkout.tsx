import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { TrustBar } from "@/components/site/Trust";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cartTotals, useCart } from "@/lib/cart";
import { placeOrder } from "@/lib/orders.functions";
import { createStripeSession } from "@/lib/payments.functions";
import {
  getAvailablePaymentMethods,
  type EmirateCode,
  type PaymentMethodId,
} from "@/lib/payment-methods";
import { useSession } from "@/lib/use-session";
import { toast } from "sonner";

const CHECKOUT_ENABLED = import.meta.env.VITE_CORNERMEX_CHECKOUT_ENABLED === "true";
const EMIRATES: Array<{ code: EmirateCode; name: string }> = [
  { code: "DU", name: "Dubai" },
  { code: "AD", name: "Abu Dhabi" },
  { code: "SH", name: "Sharjah" },
  { code: "AJ", name: "Ajman" },
  { code: "UQ", name: "Umm Al Quwain" },
  { code: "RK", name: "Ras Al Khaimah" },
  { code: "FU", name: "Fujairah" },
];

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Corner Mex" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const createStripe = useServerFn(createStripeSession);
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const totals = cartTotals(items);
  const { user, loading: sessionLoading } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState<PaymentMethodId | null>(null);
  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    emirate: "DU" as EmirateCode,
    area: "",
    street: "",
    building: "",
    floor_apt: "",
    landmark: "",
    notes: "",
  });

  const paymentMethods = useMemo(
    () => getAvailablePaymentMethods({ subtotal: totals.subtotal, emirate: form.emirate }),
    [form.emirate, totals.subtotal],
  );
  const canExecute = CHECKOUT_ENABLED && Boolean(user) && Boolean(payment) && items.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canExecute || !payment) return;
    if (!form.recipient_name || !form.phone || !form.area) {
      toast.error("Complete all required delivery fields.");
      return;
    }
    setSubmitting(true);
    try {
      const order = await place({
        data: {
          items: items.map((item) => ({ variantId: item.variantId, qty: item.qty })),
          payment_method: payment,
          shipping_address: {
            recipient_name: form.recipient_name,
            phone: form.phone,
            emirate: form.emirate,
            area: form.area,
            street: form.street || null,
            building: form.building || null,
            floor_apt: form.floor_apt || null,
            landmark: form.landmark || null,
          },
          notes: form.notes || null,
        },
      });
      if (["card", "apple_pay", "google_pay"].includes(payment)) {
        const session = await createStripe({ data: { orderId: order.orderId } });
        if (!session.url) throw new Error("Payment session unavailable");
        clear();
        window.location.assign(session.url);
        return;
      }
      clear();
      await navigate({ to: "/order-confirmed", search: { order: order.orderId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout execution failed closed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-display text-4xl tracking-tight">Checkout</h1>
          <p className="mt-4 text-muted-foreground">Your B2C cart is empty.</p>
          <Link to="/shop">
            <Button className="mt-6 rounded-full">Browse shop</Button>
          </Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          B2C checkout
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Delivery and payment details</h1>
        {!CHECKOUT_ENABLED && (
          <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950">
            Checkout execution is currently disabled. You can review the interface, but no order or
            payment will be created.
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-8 grid min-w-0 max-w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        >
          <div className="min-w-0 space-y-8">
            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Delivery address</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field id="checkout-recipient-name" label="Recipient name *">
                  <Input
                    id="checkout-recipient-name"
                    name="recipient_name"
                    value={form.recipient_name}
                    onChange={(event) => setForm({ ...form, recipient_name: event.target.value })}
                  />
                </Field>
                <Field id="checkout-phone" label="Phone *">
                  <Input
                    id="checkout-phone"
                    name="phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
                <Field id="checkout-emirate" label="Emirate *">
                  <Select
                    name="emirate"
                    value={form.emirate}
                    onValueChange={(value) => setForm({ ...form, emirate: value as EmirateCode })}
                  >
                    <SelectTrigger id="checkout-emirate" aria-labelledby="checkout-emirate-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMIRATES.map((emirate) => (
                        <SelectItem key={emirate.code} value={emirate.code}>
                          {emirate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="checkout-area" label="Area / neighbourhood *">
                  <Input
                    id="checkout-area"
                    name="area"
                    value={form.area}
                    onChange={(event) => setForm({ ...form, area: event.target.value })}
                  />
                </Field>
                <Field id="checkout-street" label="Street">
                  <Input
                    id="checkout-street"
                    name="street"
                    value={form.street}
                    onChange={(event) => setForm({ ...form, street: event.target.value })}
                  />
                </Field>
                <Field id="checkout-building" label="Building">
                  <Input
                    id="checkout-building"
                    name="building"
                    value={form.building}
                    onChange={(event) => setForm({ ...form, building: event.target.value })}
                  />
                </Field>
                <Field id="checkout-floor-apartment" label="Floor / apartment">
                  <Input
                    id="checkout-floor-apartment"
                    name="floor_apt"
                    value={form.floor_apt}
                    onChange={(event) => setForm({ ...form, floor_apt: event.target.value })}
                  />
                </Field>
                <Field id="checkout-landmark" label="Landmark">
                  <Input
                    id="checkout-landmark"
                    name="landmark"
                    value={form.landmark}
                    onChange={(event) => setForm({ ...form, landmark: event.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field id="checkout-notes" label="Notes">
                  <Textarea
                    id="checkout-notes"
                    name="notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Payment option</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Options are displayed for interface review. Availability is rechecked by the server
                before any authorized execution.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <button
                    type="button"
                    key={method.id}
                    disabled={!method.enabled}
                    onClick={() => setPayment(method.id)}
                    className={`rounded-2xl border p-4 text-start ${payment === method.id ? "border-foreground" : "border-border"} ${method.enabled ? "hover:border-foreground/40" : "cursor-not-allowed opacity-50"}`}
                  >
                    <span className="text-sm font-medium">{method.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {method.enabled ? method.subtitle : method.unavailableReason}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit min-w-0 max-w-full rounded-3xl border border-border bg-card p-4 sm:p-6">
            <h2 className="font-display text-xl">Order summary</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.variantId} className="flex min-w-0 justify-between gap-4">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.qty} × {item.name}
                  </span>
                  <span>AED {(item.qty * item.unitPrice).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>AED {totals.subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT (5%)</dt>
                <dd>AED {totals.tax.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>Pending verified rate</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <dt>Total before shipping</dt>
                <dd>AED {totals.totalBeforeShipping.toFixed(2)}</dd>
              </div>
            </dl>
            {!sessionLoading && !user && (
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Sign in before an authorized checkout can proceed.
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={!canExecute || submitting}
              className="mt-6 w-full rounded-full"
            >
              {submitting
                ? "Processing…"
                : CHECKOUT_ENABLED
                  ? "Place order"
                  : "Order execution disabled"}
            </Button>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              No order, payment, inventory change or notification occurs while checkout execution is
              disabled.
            </p>
            <TrustBar context="b2c" className="mt-5" />
          </aside>
        </form>
      </section>
    </SiteLayout>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label id={`${id}-label`} htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
