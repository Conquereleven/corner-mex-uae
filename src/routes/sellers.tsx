import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sellers")({
  beforeLoad: () => {
    throw redirect({ to: "/shop" });
  },
});
