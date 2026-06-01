import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ShoppingCart, Store, Wallet, Tags, Users, Settings,
} from "lucide-react";
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
  const { t } = useTranslation();
  return (
    <DashboardShell
      title="Corner Mex Admin"
      subtitle="Marketplace control"
      nav={[
        {
          label: t("dash.groups.overview"),
          items: [{ to: "/admin", label: t("dash.nav.overview"), icon: LayoutDashboard }],
        },
        {
          label: t("dash.groups.catalog"),
          items: [
            { to: "/admin/sellers", label: t("dash.nav.sellers"), icon: Store },
            { to: "/admin/orders", label: t("dash.nav.orders"), icon: ShoppingCart },
          ],
        },
        {
          label: t("dash.groups.ops"),
          items: [
            { to: "/admin/payouts", label: t("dash.nav.payouts"), icon: Wallet },
            { to: "/admin/categories", label: t("dash.nav.categories"), icon: Tags },
            { to: "/admin/customers", label: t("dash.nav.customers"), icon: Users },
          ],
        },
        {
          label: t("dash.groups.config"),
          items: [{ label: t("dash.nav.settings"), icon: Settings, soon: true }],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}