import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/order-confirmed")({
  beforeLoad: () => {
    throw redirect({ to: "/cart" });
  },
});
