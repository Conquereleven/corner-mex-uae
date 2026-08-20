import { createFileRoute } from "@tanstack/react-router";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  head: () => ({ meta: [{ title: "Admin — Shipping" }] }),
  component: AdminShipping,
});

function AdminShipping() {
  return (
    <AdminCapabilityUnavailable
      title="Shipping configuration is not operational yet"
      description="Checkout currently uses the reviewed first-party commercial shipping rule. Canonical shipping-zone, rate and seller tables are not active in production."
    />
  );
}
