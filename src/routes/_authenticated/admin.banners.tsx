import { createFileRoute } from "@tanstack/react-router";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({ meta: [{ title: "Admin — Banners" }] }),
  component: BannersAdmin,
});

function BannersAdmin() {
  return (
    <AdminCapabilityUnavailable
      title="Promo banners are not operational yet"
      description="The canonical production schema does not currently include the promo banner authority required to create, edit or publish banners."
    />
  );
}
