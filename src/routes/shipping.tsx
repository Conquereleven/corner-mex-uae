import { createFileRoute, redirect } from "@tanstack/react-router";

// /shipping is superseded by /delivery (CM-COM-2A trust architecture).
export const Route = createFileRoute("/shipping")({
  beforeLoad: () => {
    throw redirect({ to: "/delivery" });
  },
});
