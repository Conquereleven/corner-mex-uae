import { createFileRoute } from "@tanstack/react-router";
import { AdminCapabilityUnavailable } from "@/components/site/AdminCapabilityUnavailable";

export const Route = createFileRoute("/_authenticated/admin/newsletter")({
  head: () => ({ meta: [{ title: "Admin — Newsletter" }] }),
  component: NewsletterAdmin,
});

function NewsletterAdmin() {
  return (
    <AdminCapabilityUnavailable
      title="Newsletter administration is not operational yet"
      description="The canonical production schema does not currently include newsletter subscriber authority or broadcast delivery infrastructure."
    />
  );
}
