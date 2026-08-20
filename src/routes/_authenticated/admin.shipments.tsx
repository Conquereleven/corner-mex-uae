import { createFileRoute } from "@tanstack/react-router";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";

export const Route = createFileRoute("/_authenticated/admin/shipments")({
  head: () => ({ meta: [{ title: "Admin — Shipments" }] }),
  component: AdminShipments,
});

function AdminShipments() {
  return (
    <AdminCapabilityUnavailable
      title="Shipments are not operational yet"
      description="The canonical production schema does not currently include shipment and seller authorities. Fulfillment remains governed by the canonical order lifecycle."
    />
  );
}
