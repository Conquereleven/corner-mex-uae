import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { getOrderForConfirmation } from "@/lib/payments.functions";
import { claimGuestOrder, getGuestOrder } from "@/lib/guest-order.functions";
import { forgetGuestOrderToken, guestOrderToken } from "@/lib/guest-order-token";
import { deliveryEstimateText } from "@/lib/delivery-sla";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  component: Confirmation,
});

function Confirmation() {
  const { order } = Route.useSearch();
  const { user } = useSession();
  const load = useServerFn(getOrderForConfirmation);
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

  useEffect(() => {
    const completed = authed.data?.completedOperationId;
    if (!user || !completed || !navigator.locks) return;
    void navigator.locks.request(`intermex-checkout:${user.id}`, () => {
      const key = `intermex-card-operation:${user.id}`;
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        if (stored?.id === completed) localStorage.removeItem(key);
      } catch {
        /* Storage unavailable: keep the operation closed. */
      }
    });
  }, [user, authed.data?.completedOperationId]);

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
          ? "This order was placed with a different email address."
          : message.includes("EMAIL_NOT_VERIFIED")
            ? "Confirm your email address first, then try again."
            : "We could not add this order to your account.",
      );
      setClaimState("error");
    }
  }

  const loading = authed.isPending || guest.isPending;
  const orderNumber = value?.order_number;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-20">
        <h1 className="font-display text-3xl">Your order</h1>
        <p className="mt-4">
          {value
            ? value.payment_method === "cod"
              ? `Order #${orderNumber} received. Payment is due on delivery. ${deliveryEstimateText()}`
              : value.payment_status === "paid"
                ? `Payment received for order #${orderNumber}.`
                : `Order #${orderNumber}: payment ${value.payment_status.replaceAll("_", " ")}.`
            : !order
              ? "We could not find that order."
              : loading
                ? "Checking your order…"
                : user
                  ? "We could not find that order on your account."
                  : "This order is tracked from the browser that placed it. Open the confirmation link on that device, or contact us with your order number."}
        </p>

        {isGuestOrder && (
          <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6">
            <p className="text-sm leading-6">
              You ordered as a guest. This device can follow the order status here — no account
              needed.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Want it on every device? Create a CornerMex account with{" "}
              <span className="font-medium text-foreground">the same email</span> you used at
              checkout, then reopen this page to add the order to your account.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-4 rounded-full">
                Create an account
              </Button>
            </Link>
          </div>
        )}

        {claimable && claimState !== "done" && (
          <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6">
            <p className="text-sm leading-6">
              Add this guest order to your account so it appears in your order history.
            </p>
            <Button
              className="mt-4 rounded-full"
              disabled={claimState === "working"}
              onClick={onClaim}
            >
              {claimState === "working" ? "Adding…" : "Add to my account"}
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
            Added to your account. You can find it in your order history.
          </p>
        )}

        {user && (
          <Link to="/account/orders" className="mt-6 inline-block underline">
            View your orders
          </Link>
        )}
      </section>
    </SiteLayout>
  );
}
