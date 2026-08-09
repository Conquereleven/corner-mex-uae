import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
import {
  getCommercialCheckoutConfig,
  placeCodOrder,
  previewCodOrderTotals,
} from "@/lib/cod-order.functions";
import { getAvailablePaymentMethods, type EmirateCode } from "@/lib/payment-methods";
import { useSession } from "@/lib/use-session";
import { toast } from "sonner";

const CHECKOUT_ENABLED = import.meta.env.VITE_CORNERMEX_CHECKOUT_ENABLED === "true";
// Fallback list used only until the server configuration resolves; the
// authoritative supported set comes from getCommercialCheckoutConfig.
const FALLBACK_EMIRATES: Array<{ code: EmirateCode; name: string }> = [
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
  // CM-COM-3A: the only executable order path. The legacy marketplace
  // placeOrder and every payment-provider session are deliberately unused.
  const placeCod = useServerFn(placeCodOrder);
  const loadConfig = useServerFn(getCommercialCheckoutConfig);
  const loadPreview = useServerFn(previewCodOrderTotals);
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const totals = cartTotals(items);
  const { user, loading: sessionLoading } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof loadConfig>> | null>(null);
  const [preview, setPreview] = useState<{
    shippingAed: number;
    taxAed: number;
    totalAed: number;
  } | null>(null);
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

  // COD is the only method offered in the Commercial Active MVP.
  const paymentMethods = useMemo(
    () =>
      getAvailablePaymentMethods({
        subtotal: totals.subtotal,
        emirate: form.emirate,
        codOnly: true,
      }),
    [form.emirate, totals.subtotal],
  );

  useEffect(() => {
    let cancelled = false;
    loadConfig({}).then(
      (value) => !cancelled && setConfig(value),
      () => !cancelled && setConfig(null),
    );
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  // Trusted preview: shipping and VAT always come from the server, recalculated
  // whenever the emirate or basket changes. Display only — the final RPC
  // recomputes everything and its result wins.
  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) return undefined;
    loadPreview({ data: { subtotal_aed: totals.subtotal, emirate: form.emirate } }).then(
      (result) => {
        if (cancelled) return;
        setPreview(
          result.available
            ? {
                shippingAed: result.shippingAed,
                taxAed: result.taxAed,
                totalAed: result.totalAed,
              }
            : null,
        );
      },
      () => !cancelled && setPreview(null),
    );
    return () => {
      cancelled = true;
    };
  }, [form.emirate, items.length, loadPreview, totals.subtotal]);

  const emirateOptions = useMemo(() => {
    const supported = config?.supportedEmirates ?? [];
    if (supported.length === 0) return FALLBACK_EMIRATES;
    return supported.map((code) => ({ code, name: config?.emirateNames?.[code] ?? code }));
  }, [config]);

  const requiredFilled =
    form.recipient_name.trim().length >= 2 &&
    form.phone.trim().length >= 7 &&
    form.area.trim().length >= 2;
  const canExecute =
    CHECKOUT_ENABLED && Boolean(user) && items.length > 0 && requiredFilled && accepted;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Guard against double submission and against executing while disabled.
    if (submitting || !canExecute) return;
    setError(null);
    setSubmitting(true);
    try {
      const order = await placeCod({
        data: {
          // Only identity and quantity are sent. No price, shipping, tax or
          // total: money is derived entirely on the server.
          items: items.map((item) => ({ variant_id: item.variantId, qty: item.qty })),
          payment_method: "cod",
          address: {
            recipient_name: form.recipient_name.trim(),
            phone: form.phone.trim(),
            emirate: form.emirate,
            area: form.area.trim(),
            street: form.street || null,
            building: form.building || null,
            floor_apartment: form.floor_apt || null,
            landmark: form.landmark || null,
            notes: form.notes || null,
          },
          legal_acceptance: { terms: accepted, privacy: accepted, returns: accepted },
        },
      });
      // Only clear the cart after the order genuinely exists.
      clear();
      await navigate({ to: "/order-confirmed", search: { order: order.order_id } });
    } catch (caught) {
      // Failure keeps the cart and the customer's entered details intact.
      const message = caught instanceof Error ? caught.message : "Checkout failed.";
      const safe = message.includes("COD_ORDER_INSUFFICIENT_STOCK")
        ? "One of your items is no longer available in the requested quantity."
        : message.includes("COD_ORDER_EMIRATE_UNSUPPORTED")
          ? "We cannot deliver to the selected emirate yet."
          : message.includes("COD_ORDER_EXECUTION_DISABLED")
            ? "Ordering is not currently enabled."
            : "We could not place your order. Nothing has been charged and your cart is unchanged.";
      setError(safe);
      toast.error(safe);
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
                      {emirateOptions.map((emirate) => (
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
              <h2 className="font-display text-xl">Payment method</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Cash on delivery is the only payment method available. You pay the courier in AED
                when your order arrives. No card details are collected.
              </p>
              <div className="mt-5 grid gap-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`rounded-2xl border p-4 ${method.enabled ? "border-foreground" : "border-border opacity-50"}`}
                  >
                    <span className="text-sm font-medium">{method.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {method.enabled ? method.subtitle : method.unavailableReason}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Terms of sale</h2>
              <label
                className="mt-4 flex items-start gap-3 text-sm"
                htmlFor="checkout-legal-accept"
              >
                <input
                  id="checkout-legal-accept"
                  name="legal_acceptance"
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className="leading-6 text-muted-foreground">
                  I accept the{" "}
                  <Link to="/terms" className="underline">
                    Terms of Service
                  </Link>
                  , the{" "}
                  <Link to="/privacy" className="underline">
                    Privacy Policy
                  </Link>{" "}
                  and the{" "}
                  <Link to="/returns" className="underline">
                    Returns Policy
                  </Link>
                  .
                </span>
              </label>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                Acceptance is required before an order can be placed and is recorded with the order.
              </p>
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
                <dt className="text-muted-foreground">{config?.taxLabel ?? "VAT"}</dt>
                <dd>{preview ? `AED ${preview.taxAed.toFixed(2)}` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Delivery ({config?.emirateNames?.[form.emirate] ?? form.emirate})
                </dt>
                <dd>{preview ? `AED ${preview.shippingAed.toFixed(2)}` : "—"}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <dt>Total</dt>
                {/* Amounts are always the server's, never computed in the browser. */}
                <dd>
                  {preview ? `AED ${preview.totalAed.toFixed(2)}` : "Calculated by CornerMex"}
                </dd>
              </div>
            </dl>
            {config?.vatTrn && (
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                RodMor TradeCo LLC — VAT TRN {config.vatTrn}
              </p>
            )}
            {!sessionLoading && !user && (
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Sign in before an authorized checkout can proceed.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={!canExecute || submitting}
              className="mt-6 w-full rounded-full"
            >
              {submitting
                ? "Placing order…"
                : CHECKOUT_ENABLED
                  ? "Place order — cash on delivery"
                  : "Order execution disabled"}
            </Button>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              No order, inventory change or notification occurs while checkout execution is
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
