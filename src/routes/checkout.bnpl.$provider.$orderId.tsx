import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/bnpl/$provider/$orderId")({
  beforeLoad: () => {
    throw redirect({ to: "/cart" });
  },
});
