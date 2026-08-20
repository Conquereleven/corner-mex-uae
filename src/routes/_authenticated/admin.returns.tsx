import { createFileRoute } from "@tanstack/react-router";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  head: () => ({ meta: [{ title: "Admin — Returns" }] }),
  component: AdminReturns,
});

function AdminReturns() {
  return (
    <AdminCapabilityUnavailable
      title="Returns are not operational yet"
      description="The canonical production schema does not currently include the returns authority required for return requests, approvals or refunds."
    />
  );
}
