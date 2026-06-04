import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tags, Ticket, Megaphone, Mail, Truck, Package, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin — Settings" }] }),
  component: AdminSettings,
});

const HUBS = [
  { to: "/admin/categories", icon: Tags, title: "Categories", desc: "Manage marketplace categories and visibility." },
  { to: "/admin/coupons", icon: Ticket, title: "Coupons", desc: "Create and manage discount coupons." },
  { to: "/admin/banners", icon: Megaphone, title: "Promo banners", desc: "Edit homepage and storefront banners." },
  { to: "/admin/newsletter", icon: Mail, title: "Newsletter", desc: "Subscribers and broadcast emails." },
  { to: "/admin/shipping", icon: Truck, title: "Shipping zones", desc: "Configure shipping zones and rates." },
  { to: "/admin/shipments", icon: Package, title: "Shipments", desc: "Track all marketplace shipments." },
] as const;

function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-7 w-7" /> Marketplace settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how the marketplace runs. More options (taxes, payments, locales) are coming soon.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((h) => (
          <Link key={h.to} to={h.to}>
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