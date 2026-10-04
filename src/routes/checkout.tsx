import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatMoney, formatMoneyWithCode } from "@/config/market";
import { useCart } from "@/lib/cart";
import { clearCodCheckoutOperation, codCheckoutOperation } from "@/lib/checkout-operation";
import { rememberGuestOrderToken } from "@/lib/guest-order-token";
import {
  MX_STATE_OPTIONS,
  MxAddress,
  mxAddressErrorMessage,
  normalizeMxPhone,
  stateForPostalCode,
  type MxStateCode,
} from "@/lib/mx-address";
import {
  getMxCheckoutConfig,
  placeMxOrder,
  quoteMxShipping,
  type MxQuoteResult,
} from "@/lib/mx-checkout.functions";
import { useSession } from "@/lib/use-session";
import { toast } from "sonner";

const CHECKOUT_ENABLED = import.meta.env.VITE_CORNERMEX_CHECKOUT_ENABLED === "true";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Finalizar compra — CornerMex" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});

type Quote = Extract<MxQuoteResult, { available: true }>;

type QuoteState =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; quote: Quote }
  | { status: "error"; key: string; reasons: string[] };

const PAYMENT_LABELS: Record<string, { title: string; subtitle: string; action: string }> = {
  mercado_pago: {
    title: "Mercado Pago · Efectivo en OXXO",
    subtitle: "Te damos una referencia para pagar en cualquier tienda OXXO.",
    action: "Continuar al pago",
  },
  clip: {
    title: "Tarjeta de crédito o débito · Clip",
    subtitle: "Pagas con tu tarjeta en la página segura de Clip.",
    action: "Continuar al pago",
  },
  cod: {
    title: "Pago contra entrega",
    subtitle: "Solo en entregas locales. Pagas al recibir tu pedido.",
    action: "Realizar pedido",
  },
};

const FULFILLMENT_LABELS: Record<string, string> = {
  LOCAL_DELIVERY: "Entrega local",
  PARCEL_SHIPPING: "Paquetería",
  PICKUP: "Recoger en punto",
};

function Checkout() {
  const navigate = useNavigate();
  const loadConfig = useServerFn(getMxCheckoutConfig);
  const loadQuote = useServerFn(quoteMxShipping);
  const placeMx = useServerFn(placeMxOrder);
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const { user, loading: sessionLoading } = useSession();

  const submission = useRef(false);
  const quoteRequest = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof loadConfig>> | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    recipient_name: "",
    phone: "",
    street: "",
    exterior_number: "",
    interior_number: "",
    colonia: "",
    municipality: "",
    state: "" as MxStateCode | "",
    postal_code: "",
    references: "",
    notes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

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

  const cartLines = useMemo(
    () => items.map((item) => ({ variant_id: item.variantId, qty: item.qty })),
    [items],
  );

  // Shipping can be priced as soon as the destination is known.
  const postalCodeState = stateForPostalCode(form.postal_code);
  const destinationReady =
    /^\d{5}$/.test(form.postal_code) &&
    form.state !== "" &&
    postalCodeState === form.state &&
    form.municipality.trim().length >= 2 &&
    form.colonia.trim().length >= 2;
  const quoteKey = useMemo(
    () =>
      destinationReady
        ? JSON.stringify({
            items: [...cartLines].sort((a, b) => a.variant_id.localeCompare(b.variant_id)),
            postal_code: form.postal_code,
            state: form.state,
            municipality: form.municipality.trim(),
            colonia: form.colonia.trim(),
          })
        : null,
    [cartLines, destinationReady, form.colonia, form.municipality, form.postal_code, form.state],
  );

  // Trusted quote: item prices come from the database and every shipping option
  // is priced and signed by the server. The browser recomputes nothing.
  useEffect(() => {
    const requestId = ++quoteRequest.current;
    setSelectedToken(null);
    if (!quoteKey || cartLines.length === 0) {
      setQuoteState({ status: "idle" });
      return undefined;
    }
    setQuoteState({ status: "loading", key: quoteKey });
    // Wait for the customer to stop typing before asking the carriers.
    const timer = setTimeout(() => {
      loadQuote({
        data: {
          items: cartLines,
          destination: {
            postal_code: form.postal_code,
            state: form.state as MxStateCode,
            municipality: form.municipality.trim(),
            colonia: form.colonia.trim(),
          },
        },
      }).then(
        (result) => {
          if (quoteRequest.current !== requestId) return;
          if (result.available) {
            setQuoteState({ status: "ready", key: quoteKey, quote: result });
            setSelectedToken(result.options[0]?.token ?? null);
          } else {
            setQuoteState({ status: "error", key: quoteKey, reasons: result.reasons });
          }
        },
        () => {
          if (quoteRequest.current !== requestId) return;
          setQuoteState({ status: "error", key: quoteKey, reasons: ["MX_ORDER_PREVIEW_FAILED"] });
        },
      );
    }, 500);
    return () => clearTimeout(timer);
    // form fields are captured through quoteKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, cartLines, loadQuote]);

  const quote =
    quoteState.status === "ready" && quoteState.key === quoteKey ? quoteState.quote : null;
  const selected = quote?.options.find((option) => option.token === selectedToken) ?? null;
  const tax = quote ? Math.round(quote.subtotal * quote.taxRate * 100) / 100 : 0;
  // Display only. The order total is recomputed by the database at placement.
  const total = quote && selected ? quote.subtotal + selected.price + tax : null;

  // Methods come from the server configuration; none is hardcoded as available.
  // Cash on delivery is offered only with a local delivery option.
  const paymentMethods = useMemo(
    () =>
      (config?.paymentOptions ?? [])
        .filter(
          (option) => !option.localDeliveryOnly || selected?.fulfillmentMode === "LOCAL_DELIVERY",
        )
        .map((option) => option.id),
    [config?.paymentOptions, selected?.fulfillmentMode],
  );
  // The only available method is preselected; with several, the customer chooses.
  useEffect(() => {
    if (paymentMethods.length === 1) setMethod(paymentMethods[0]);
    else if (method && !paymentMethods.includes(method as never)) setMethod(null);
  }, [method, paymentMethods]);

  const addressValid =
    form.recipient_name.trim().length >= 2 &&
    normalizeMxPhone(form.phone) !== null &&
    form.street.trim().length >= 2 &&
    form.exterior_number.trim().length >= 1 &&
    destinationReady;
  // Guest checkout: buying never requires an account. A signed-in customer needs
  // no email field; a guest supplies one so the order has a contact.
  const guestEmailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const identityReady = Boolean(user) || guestEmailValid;
  const readyToOrder =
    identityReady &&
    items.length > 0 &&
    addressValid &&
    accepted &&
    selected !== null &&
    method !== null;
  const canExecute = CHECKOUT_ENABLED && Boolean(config?.active) && readyToOrder;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Guard against double submission and against executing while disabled.
    if (submission.current || submitting || !canExecute || !selected || !method) return;
    const address = MxAddress.safeParse({
      recipient_name: form.recipient_name,
      phone: form.phone,
      street: form.street,
      exterior_number: form.exterior_number,
      interior_number: form.interior_number,
      colonia: form.colonia,
      municipality: form.municipality,
      state: form.state,
      postal_code: form.postal_code,
      references: form.references,
      notes: form.notes,
    });
    if (!address.success) {
      const message = mxAddressErrorMessage(address.error.issues[0]?.message ?? "");
      setError(message);
      toast.error(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    submission.current = true;
    try {
      const input = {
        // Identity and quantity only. No price, shipping, tax or total: money is
        // derived on the server, and the shipping option is an opaque signed token.
        items: cartLines,
        payment_method: method as "mercado_pago" | "clip" | "cod",
        address: {
          recipient_name: form.recipient_name.trim(),
          phone: form.phone.trim(),
          street: form.street.trim(),
          exterior_number: form.exterior_number.trim(),
          interior_number: form.interior_number.trim() || null,
          colonia: form.colonia.trim(),
          municipality: form.municipality.trim(),
          state: form.state as MxStateCode,
          postal_code: form.postal_code,
          references: form.references.trim() || null,
          notes: form.notes.trim() || null,
        },
        shipping_token: selected.token,
        legal_acceptance: { terms: accepted, privacy: accepted, returns: accepted },
      };
      const guestEmail = user ? null : form.email.trim().toLowerCase();
      const orderInput = guestEmail
        ? { ...input, guest: { email: guestEmail } }
        : { ...input, ...(user?.email ? { payer_email: user.email } : {}) };
      // Idempotency is per identity: a signed-in buyer keys on the user id, a
      // guest on their email, so a retry or a second tab replays the same order.
      const operationKey = user ? user.id : `guest:${guestEmail}`;
      const operationId = await codCheckoutOperation(operationKey, orderInput);
      const order = await placeMx({ data: { ...orderInput, operationId } });
      // Keep the one-time tracking token so the confirmation and tracking views
      // work without an account. It is never put in the URL.
      if (order.guest_token) rememberGuestOrderToken(order.order_id, order.guest_token);
      if (order.payment?.kind === "retry") {
        // The payment provider did not answer. The order exists; keeping the
        // operation and the cart means pressing the button again replays this
        // exact checkout instead of creating a second order or a second charge.
        const message =
          "No pudimos conectar con el servicio de pago. Tu pedido quedó registrado: vuelve a presionar el botón para continuar al pago.";
        setError(message);
        toast.error(message);
        return;
      }
      // The order exists (created now, or replayed), so the next checkout starts
      // a fresh operation.
      clearCodCheckoutOperation(operationKey);
      // Only clear the cart after the order genuinely exists.
      clear();
      const nextUrl =
        order.payment?.kind === "redirect"
          ? order.payment.url
          : order.payment?.kind === "instructions"
            ? order.payment.url
            : null;
      if (nextUrl) {
        // Paying happens on the provider's own page. Coming back proves nothing:
        // the confirmation page re-reads the payment from the provider.
        window.location.assign(nextUrl);
        return;
      }
      await navigate({ to: "/order-confirmed", search: { order: order.order_id } });
    } catch (caught) {
      // Failure keeps the cart and the customer's entered details intact.
      const message = caught instanceof Error ? caught.message : "";
      const safe = message.includes("COD_ORDER_INSUFFICIENT_STOCK")
        ? "Uno de tus productos ya no está disponible en la cantidad solicitada."
        : message.includes("SHIPPING_QUOTE_EXPIRED")
          ? "La opción de envío venció. Elige una opción de envío de nuevo."
          : message.includes("SHIPPING_QUOTE_")
            ? "Tu pedido o dirección cambió. Elige una opción de envío de nuevo."
            : message.includes("MX_CHECKOUT_DISABLED")
              ? "Por el momento no estamos recibiendo pedidos."
              : message.includes("MX_ORDER_VARIANT_NOT_ACTIVE")
                ? "Uno de los productos de tu carrito ya no está a la venta."
                : message.includes("MX_PAYMENT_PROVIDER_REJECTED")
                  ? "El servicio de pago no aceptó la operación. No se realizó ningún cargo; elige otra forma de pago o inténtalo de nuevo."
                  : "No pudimos registrar tu pedido. No se realizó ningún cargo y tu carrito sigue intacto.";
      setError(safe);
      toast.error(safe);
      if (message.includes("SHIPPING_QUOTE_")) {
        setSelectedToken(null);
        setQuoteState({ status: "idle" });
      }
    } finally {
      setSubmitting(false);
      submission.current = false;
    }
  }

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="font-display text-4xl tracking-tight">Finalizar compra</h1>
          <p className="mt-4 text-muted-foreground">Tu carrito está vacío.</p>
          <Link to="/shop">
            <Button className="mt-6 rounded-full">Ver productos</Button>
          </Link>
        </section>
      </SiteLayout>
    );
  }

  const postalMismatch =
    /^\d{5}$/.test(form.postal_code) && form.state !== "" && postalCodeState !== form.state;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eyebrow">
          Finalizar compra
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Envío y pago</h1>
        {(!CHECKOUT_ENABLED || (config && !config.active)) && (
          <div className="mt-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950">
            Por el momento no estamos recibiendo pedidos en línea. Puedes revisar tu carrito, pero
            no se creará ningún pedido ni se realizará ningún cargo.
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-8 grid min-w-0 max-w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        >
          <div className="min-w-0 space-y-8">
            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Datos de contacto</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {!user && (
                  <Field id="checkout-email" label="Correo electrónico *">
                    <Input
                      id="checkout-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="tu@correo.com"
                      value={form.email}
                      onChange={(event) => set({ email: event.target.value })}
                    />
                  </Field>
                )}
                <Field id="checkout-recipient-name" label="Nombre de quien recibe *">
                  <Input
                    id="checkout-recipient-name"
                    name="recipient_name"
                    autoComplete="name"
                    value={form.recipient_name}
                    onChange={(event) => set({ recipient_name: event.target.value })}
                  />
                </Field>
                <Field id="checkout-phone" label="Teléfono (10 dígitos) *">
                  <Input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => set({ phone: event.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Dirección de envío</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field id="checkout-postal-code" label="Código postal *">
                  <Input
                    id="checkout-postal-code"
                    name="postal_code"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={5}
                    value={form.postal_code}
                    onChange={(event) => {
                      const postal_code = event.target.value.replace(/\D/g, "").slice(0, 5);
                      // The postal code identifies the state; fill it in.
                      const detected = stateForPostalCode(postal_code);
                      set(detected ? { postal_code, state: detected } : { postal_code });
                    }}
                  />
                </Field>
                <Field id="checkout-state" label="Estado *">
                  <Select
                    name="state"
                    value={form.state}
                    onValueChange={(value) => set({ state: value as MxStateCode })}
                  >
                    <SelectTrigger id="checkout-state" aria-labelledby="checkout-state-label">
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {MX_STATE_OPTIONS.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="checkout-municipality" label="Municipio o alcaldía *">
                  <Input
                    id="checkout-municipality"
                    name="municipality"
                    autoComplete="address-level2"
                    value={form.municipality}
                    onChange={(event) => set({ municipality: event.target.value })}
                  />
                </Field>
                <Field id="checkout-colonia" label="Colonia *">
                  <Input
                    id="checkout-colonia"
                    name="colonia"
                    autoComplete="address-level3"
                    value={form.colonia}
                    onChange={(event) => set({ colonia: event.target.value })}
                  />
                </Field>
                <Field id="checkout-street" label="Calle *">
                  <Input
                    id="checkout-street"
                    name="street"
                    autoComplete="address-line1"
                    value={form.street}
                    onChange={(event) => set({ street: event.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field id="checkout-exterior-number" label="Núm. exterior *">
                    <Input
                      id="checkout-exterior-number"
                      name="exterior_number"
                      value={form.exterior_number}
                      onChange={(event) => set({ exterior_number: event.target.value })}
                    />
                  </Field>
                  <Field id="checkout-interior-number" label="Núm. interior">
                    <Input
                      id="checkout-interior-number"
                      name="interior_number"
                      value={form.interior_number}
                      onChange={(event) => set({ interior_number: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
              {postalMismatch && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {mxAddressErrorMessage("MX_ADDRESS_POSTAL_CODE_STATE_MISMATCH")}
                </p>
              )}
              <div className="mt-4 grid gap-4">
                <Field id="checkout-references" label="Referencias para encontrar el domicilio">
                  <Input
                    id="checkout-references"
                    name="references"
                    placeholder="Entre calles, color de la fachada…"
                    value={form.references}
                    onChange={(event) => set({ references: event.target.value })}
                  />
                </Field>
                <Field id="checkout-notes" label="Notas del pedido">
                  <Textarea
                    id="checkout-notes"
                    name="notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) => set({ notes: event.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Opciones de envío</h2>
              {quoteState.status === "idle" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Completa tu código postal, estado, municipio y colonia para ver las opciones de
                  envío.
                </p>
              )}
              {quoteState.status === "loading" && (
                <p className="mt-3 text-sm text-muted-foreground">Cotizando tu envío…</p>
              )}
              {quoteState.status === "error" && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {quoteState.reasons.includes("MX_SHIPPING_UNAVAILABLE")
                    ? "Por ahora no tenemos envíos a ese código postal."
                    : quoteState.reasons.includes("MX_ORDER_VARIANT_UNAVAILABLE")
                      ? "Uno de los productos de tu carrito ya no está disponible."
                      : "No pudimos cotizar el envío. Inténtalo de nuevo en unos minutos."}
                </p>
              )}
              {quote && (
                <div className="mt-5 grid gap-3" role="radiogroup" aria-label="Opciones de envío">
                  {quote.options.map((option) => (
                    <label
                      key={option.token}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                        option.token === selectedToken ? "border-foreground" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping-option"
                        className="mt-1"
                        checked={option.token === selectedToken}
                        onChange={() => setSelectedToken(option.token)}
                        disabled={submitting}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-4 text-sm font-medium">
                          <span className="min-w-0">
                            {option.carrierName} · {option.service}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {option.price === 0 ? "Gratis" : formatMoney(option.price)}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {FULFILLMENT_LABELS[option.fulfillmentMode] ?? ""}
                          {option.deliveryEstimate
                            ? ` · Entrega estimada: ${option.deliveryEstimate}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Forma de pago</h2>
              {paymentMethods.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {selected
                    ? "Aún no hay formas de pago disponibles."
                    : "Elige una opción de envío para ver las formas de pago."}
                </p>
              ) : (
                <div className="mt-5 grid gap-3" role="radiogroup" aria-label="Forma de pago">
                  {paymentMethods.map((id) => (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                        method === id ? "border-foreground" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        className="mt-1"
                        checked={method === id}
                        onChange={() => setMethod(id)}
                        disabled={submitting}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {PAYMENT_LABELS[id]?.title ?? id}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {PAYMENT_LABELS[id]?.subtitle ?? ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
              <h2 className="font-display text-xl">Términos de la compra</h2>
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
                  Acepto los{" "}
                  <Link to="/terms" className="underline">
                    Términos y condiciones
                  </Link>
                  , el{" "}
                  <Link to="/privacy" className="underline">
                    Aviso de privacidad
                  </Link>{" "}
                  y la{" "}
                  <Link to="/returns" className="underline">
                    Política de devoluciones
                  </Link>
                  .
                </span>
              </label>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                La aceptación es necesaria para realizar el pedido y queda registrada con él.
              </p>
            </section>
          </div>

          <aside className="h-fit min-w-0 max-w-full rounded-3xl border border-border bg-card p-4 sm:p-6">
            <h2 className="font-display text-xl">Resumen del pedido</h2>
            {/* Lines come from the server quote, never from cart-local price
                state, so a stale or tampered cart price is never shown as the
                checkout price. */}
            <ul className="mt-4 space-y-2 text-sm">
              {quote ? (
                quote.lines.map((line) => (
                  <li key={line.variant_id} className="flex min-w-0 justify-between gap-4">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {line.qty} × {line.product_name}
                      {line.variant_label ? ` (${line.variant_label})` : ""}
                    </span>
                    <span className="tabular-nums">{formatMoney(line.line_total_aed)}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">
                  Los precios se confirman al capturar tu dirección.
                </li>
              )}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{quote ? formatMoney(quote.subtotal) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Envío</dt>
                <dd className="tabular-nums">
                  {selected ? (selected.price === 0 ? "Gratis" : formatMoney(selected.price)) : "—"}
                </dd>
              </div>
              {config?.taxLabel && quote && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{config.taxLabel}</dt>
                  <dd className="tabular-nums">{formatMoney(tax)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  {total !== null ? formatMoneyWithCode(total) : "—"}
                </dd>
              </div>
            </dl>
            {!sessionLoading && !user && (
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Estás comprando como invitado: no necesitas una cuenta. ¿Ya tienes una?{" "}
                <Link to="/login" className="underline underline-offset-4">
                  Inicia sesión para comprar más rápido
                </Link>
                .
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
                ? "Registrando tu pedido…"
                : (PAYMENT_LABELS[method ?? ""]?.action ?? "Realizar pedido")}
            </Button>
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
