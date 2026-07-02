import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ShoppingCart, Store, Wallet, Tags, Users, Settings, Activity, Upload, Truck, Globe2,
  Package, Star, RotateCcw, Ticket, Megaphone, Mail, Plus, ShieldCheck, Inbox, Scale,
} from "lucide-react";
import { isAdmin } from "@/lib/admin.functions";
import { DashboardShell } from "@/components/site/DashboardShell";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminDashboardCounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const r = await isAdmin({});
    if (!r.admin) throw redirect({ to: "/account" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  const countsFn = useServerFn(adminDashboardCounts);
  const counts = useQuery({
    queryKey: ["admin-dash-counts"],
    queryFn: () => countsFn({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const c = counts.data;
  return (
    <DashboardShell
      title="Corner Mex Admin"
      subtitle="Commerce cockpit"
      nav={[
        {
          label: t("dash.groups.overview"),
          items: [{ to: "/admin", label: t("dash.nav.overview"), icon: LayoutDashboard }],
        },
        {
          label: t("dash.groups.catalog"),
          items: [
            { to: "/admin/sellers", label: t("dash.nav.sellers"), icon: Store },
            { to: "/admin/sellers/kyc", label: "KYC Verification", icon: ShieldCheck, badge: c?.kyc_pending },
            { to: "/admin/orders", label: t("dash.nav.orders"), icon: ShoppingCart, badge: c?.orders_pending },
            { to: "/admin/leads", label: "B2B leads", icon: Inbox, badge: c?.leads_new, badgeTone: "primary" },
            { to: "/admin/products/new", label: "New product", icon: Plus },
            { to: "/admin/products/import", label: t("dash.import.nav"), icon: Upload },
          ],
        },
        {
          label: t("dash.groups.ops"),
          items: [
            { to: "/admin/payouts", label: t("dash.nav.payouts"), icon: Wallet, badge: c?.payouts_pending },
            { to: "/admin/categories", label: t("dash.nav.categories"), icon: Tags },
            { to: "/admin/customers", label: t("dash.nav.customers"), icon: Users },
            { to: "/admin/live-view", label: "Live view", icon: Globe2 },
            { to: "/admin/performance", label: t("dash.nav.performance"), icon: Activity },
            { to: "/admin/catalog-analytics", label: "Catalog analytics", icon: Activity },
            { to: "/admin/shipping", label: "Shipping", icon: Truck },
            { to: "/admin/shipments", label: "Shipments", icon: Package, badge: c?.shipments_pending },
            { to: "/admin/reviews", label: "Reviews", icon: Star, badge: c?.reviews_pending },
            { to: "/admin/returns", label: "Returns", icon: RotateCcw, badge: c?.returns_pending },
            { to: "/admin/coupons", label: "Coupons", icon: Ticket },
            { to: "/admin/banners", label: "Banners", icon: Megaphone },
            { to: "/admin/newsletter", label: "Newsletter", icon: Mail },
          ],
        },
        {
          label: t("dash.groups.config"),
          items: [
            { to: "/admin/legal", label: "Legal & Compliance", icon: Scale },
            { to: "/admin/settings", label: t("dash.nav.settings"), icon: Settings },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}