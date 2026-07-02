import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tags, Ticket, Megaphone, Mail, Truck, Package, Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin — Settings" }] }),
  component: AdminSettings,
});

const HUBS = [
  { to: "/admin/categories", icon: Tags, title: "Categories", desc: "Manage catalog categories and visibility." },
  { to: "/admin/coupons", icon: Ticket, title: "Coupons", desc: "Create and manage discount coupons." },
  { to: "/admin/banners", icon: Megaphone, title: "Promo banners", desc: "Edit homepage and storefront banners." },
  { to: "/admin/newsletter", icon: Mail, title: "Newsletter", desc: "Subscribers and broadcast emails." },
  { to: "/admin/shipping", icon: Truck, title: "Shipping zones", desc: "Configure shipping zones and rates." },
  { to: "/admin/shipments", icon: Package, title: "Shipments", desc: "Track all CornerMex shipments." },
] as const;

function AdminSettings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commerce settings"
        description="Configure how CornerMex first-party e-commerce runs. Marketplace / seller onboarding activates in Phase 2."
        icon={SettingsIcon}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Settings" }]}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((h) => (
          <Link
            key={h.to}
            to={h.to}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2"><h.icon className="h-5 w-5" /></div>
                  <CardTitle className="text-base">{h.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{h.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}