import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/seller")({
  beforeLoad: () => {
    throw redirect({ to: "/account" });
  },
});
