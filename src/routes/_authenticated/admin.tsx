import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAdmin } from "@/lib/admin.functions";
import { DashboardShell } from "@/components/site/DashboardShell";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const r = await isAdmin({});
    if (!r.admin) throw redirect({ to: "/account" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <DashboardShell
      title="Admin"
      nav={[
        { to: "/admin", label: "Overview" },
        { to: "/admin/sellers", label: "Sellers" },
        { to: "/admin/orders", label: "Orders" },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}