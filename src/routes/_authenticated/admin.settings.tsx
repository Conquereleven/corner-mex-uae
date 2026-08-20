import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Tags, Ticket } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin — Settings" }] }),
  component: AdminSettings,
});

const HUBS = [
  {
    to: "/admin/categories",
    icon: Tags,
    title: "Categories",
    desc: "Manage canonical catalog categories and visibility.",
  },
  {
    to: "/admin/coupons",
    icon: Ticket,
    title: "Coupons",
    desc: "Create and manage canonical discount coupons.",
  },
] as const;

function AdminSettings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commerce settings"
        description="Only canonical production-backed configuration is actionable here. Future capabilities stay fail-closed until their authority is activated."
        icon={SettingsIcon}
        breadcrumbs={[{ label: "Admin", to: "/admin" }, { label: "Settings" }]}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((hub) => (
          <Link
            key={hub.to}
            to={hub.to}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <hub.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{hub.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{hub.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
