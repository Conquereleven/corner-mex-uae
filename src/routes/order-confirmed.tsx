import { useEffect } from "react";
import { useSession } from "@/lib/use-session";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { getOrderForConfirmation } from "@/lib/payments.functions";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  component: Confirmation,
});
function Confirmation() {
  const { order } = Route.useSearch();
  const load = useServerFn(getOrderForConfirmation);
  const result = useQuery({
    queryKey: ["order-confirmation", order],
    queryFn: () => load({ data: { orderId: order } }),
    enabled: Boolean(order),
    refetchInterval: (query) => (query.state.data?.payment_status === "pending" ? 5000 : false),
    retry: false,
  });
  const value = result.data;
  const { user } = useSession();
  useEffect(() => {
    if (!user || !value?.completedOperationId || !navigator.locks) return;
    void navigator.locks.request(`intermex-checkout:${user.id}`, () => {
      const key = `intermex-card-operation:${user.id}`;
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        if (stored?.id === value.completedOperationId) localStorage.removeItem(key);
      } catch {
        /* Storage unavailable: keep the operation closed. */
      }
    });
  }, [user, value?.completedOperationId]);
  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-20">
        <h1 className="font-display text-3xl">Your order</h1>
        <p className="mt-4">
          {value
            ? value.payment_method === "cod"
              ? `Order #${value.order_number} received. Payment is due on delivery.`
              : value.payment_status === "paid"
                ? `Payment received for order #${value.order_number}.`
                : `Order #${value.order_number}: payment ${value.payment_status.replaceAll("_", " ")}.`
            : result.isError || !order
              ? "Sign in to view your order, or check your account for its latest status."
              : "Checking your order…"}
        </p>
        <Link to="/account/orders" className="mt-6 inline-block underline">
          View your orders
        </Link>
      </section>
    </SiteLayout>
  );
}
