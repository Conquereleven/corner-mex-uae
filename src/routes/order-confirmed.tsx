import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { getMxOrderForConfirmation, refreshMxOrderPayment } from "@/lib/mx-checkout.functions";
import { claimGuestOrder, getGuestOrder } from "@/lib/guest-order.functions";
import { forgetGuestOrderToken, guestOrderToken } from "@/lib/guest-order-token";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  component: Confirmation,
});

function Confirmation() {
  const { order } = Route.useSearch();
  const { user } = useSession();
  const load = useServerFn(getMxOrderForConfirmation);
  const refreshPayment = useServerFn(refreshMxOrderPayment);
  const loadGuest = useServerFn(getGuestOrder);
  const claim = useServerFn(claimGuestOrder);

  // The capability token lives in this browser only; it is never in the URL.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(order ? guestOrderToken(order) : null);
  }, [order]);

  const authed = useQuery({
    queryKey: ["order-confirmation", order],
    queryFn: () => load({ data: { orderId: order } }),
    enabled: Boolean(order) && Boolean(user),
    refetchInterval: (query) => (query.state.data?.payment_status === "pending" ? 5000 : false),
    retry: false,
  });

  const guest = useQuery({
    queryKey: ["guest-order", order, token],
    queryFn: () => loadGuest({ data: { orderId: order, token: token as string } }),
    enabled: Boolean(order) && Boolean(token) && !user,
    retry: false,
  });

  const value = authed.data ?? guest.data ?? null;
  const isGuestOrder = !user && Boolean(guest.data);

  // Arriving here — even on a provider's "success" URL — proves nothing. The
  // server re-reads the payment from the provider and records what it says;
  // only then is the order shown as paid.
  const refetchAuthed = authed.refetch;
  const refetchGuest = guest.refetch;
  useEffect(() => {
    if (!order) return undefined;
    let cancelled = false;
    refreshPayment({ data: { orderId: order } }).then(
      () => {
        if (cancelled) return;
        void refetchAuthed();
        void refetchGuest();
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [order, refreshPayment, refetchAuthed, refetchGuest]);

  // A signed-in customer who still holds a guest token for this order can link
  // it. The server requires a verified email match as well, so a token alone
  // never moves an order onto the wrong account.
  const [claimState, setClaimState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimable = Boolean(user && token && order && !authed.data);

  async function onClaim() {
    if (!order || !token) return;
    setClaimState("working");
    setClaimError(null);
    try {
      await claim({ data: { orderId: order, token } });
      forgetGuestOrderToken(order);
      setToken(null);
      setClaimState("done");
      await authed.refetch();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setClaimError(
        message.includes("EMAIL_MISMATCH")
          ? "Este pedido se hizo con otro correo electrónico."
          : message.includes("EMAIL_NOT_VERIFIED")
            ? "Primero confirma tu correo electrónico e inténtalo de nuevo."
            : "No pudimos agregar este pedido a tu cuenta.",
      );
      setClaimState("error");
    }
  }

  const loading = authed.isPending || guest.isPending;
  const orderNumber = value?.order_number;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-20">
        <h1 className="font-display text-3xl">Tu pedido</h1>
        <p className="mt-4">
          {value
            ? value.payment_method === "cod"
              ? `Recibimos tu pedido #${orderNumber}. Pagas al recibirlo. El tiempo de entrega es el de la opción de envío que elegiste.`
              : value.payment_status === "paid"
                ? `Recibimos el pago de tu pedido #${orderNumber}. Ya lo estamos preparando.`
                : value.payment_status === "pending"
                  ? `Tu pedido #${orderNumber} está registrado y en espera de pago. En cuanto se confirme el pago lo preparamos.`
                  : value.payment_status === "under_review"
                    ? `Estamos revisando el pago de tu pedido #${orderNumber}. Te contactaremos si necesitamos algo.`
                    : value.payment_status === "refunded"
                      ? `El pago de tu pedido #${orderNumber} fue reembolsado.`
                      : `El pago de tu pedido #${orderNumber} no se completó, así que el pedido fue cancelado. No se realizó ningún cargo.`
            : !order
              ? "No encontramos ese pedido."
              : loading
                ? "Consultando tu pedido…"
                : user
                  ? "No encontramos ese pedido en tu cuenta."
                  : "Este pedido se consulta desde el navegador donde se hizo. Abre la confirmación en ese dispositivo, o escríbenos con tu número de pedido."}
        </p>

        {isGuestOrder && (
          <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6">
            <p className="text-sm leading-6">
              Compraste como invitado. Desde este dispositivo puedes consultar aquí el estado de tu
              pedido, sin necesidad de una cuenta.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              ¿Quieres verlo en todos tus dispositivos? Crea una cuenta CornerMex con{" "}
              <span className="font-medium text-foreground">el mismo correo</span> que usaste al
              comprar y vuelve a abrir esta página para agregar el pedido a tu cuenta.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4 rounded-full">
                Crear una cuenta
              </Button>
            </Link>
          </div>
        )}

        {claimable && claimState !== "done" && (
          <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6">
            <p className="text-sm leading-6">
              Agrega este pedido a tu cuenta para que aparezca en tu historial.
            </p>
            <Button
              className="mt-4 rounded-full"
              disabled={claimState === "working"}
              onClick={onClaim}
            >
              {claimState === "working" ? "Agregando…" : "Agregar a mi cuenta"}
            </Button>
            {claimError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {claimError}
              </p>
            )}
          </div>
        )}

        {claimState === "done" && (
          <p className="mt-8 text-sm text-muted-foreground">
            Listo: el pedido ya está en tu cuenta y aparece en tu historial.
          </p>
        )}

        {user && (
          <Link to="/account/orders" className="mt-6 inline-block underline">
            Ver mis pedidos
          </Link>
        )}
      </section>
    </SiteLayout>
  );
}
