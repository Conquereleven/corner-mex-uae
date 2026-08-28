import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  Package,
  Plus,
  RotateCcw,
  Scale,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  Ticket,
  Truck,
  Upload,
  Users,
  Globe2,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { DashboardShell } from "@/components/site/DashboardShell";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminDashboardCountsCanonical } from "@/lib/admin-dashboard-counts.functions";
import { getRouteAdminState } from "@/lib/route-auth.functions";
import { resolveRouteAccess } from "@/lib/route-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    const auth = await getRouteAdminState();
    const access = resolveRouteAccess(location.pathname, auth);
    if (access === "login") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (access === "account") {
      throw redirect({ to: "/account" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  const countsFn = useServerFn(adminDashboardCountsCanonical);
  const counts = useQuery({
    queryKey: ["admin-dash-counts-canonical"],
    queryFn: () => countsFn({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const c = counts.data;

  return (
    <DashboardShell
      title="CornerMex Admin"
      subtitle="Commerce cockpit"
      nav={[
        {
          label: t("dash.groups.overview"),
          items: [{ to: "/admin", label: t("dash.nav.overview"), icon: LayoutDashboard }],
        },
        {
          label: t("dash.groups.catalog"),
          items: [
            {
              to: "/admin/orders",
              label: t("dash.nav.orders"),
              icon: ShoppingCart,
              badge: c?.orders_pending,
            },
            {
              to: "/admin/leads",
              label: "B2B leads",
              icon: Inbox,
              badge: c?.leads_new,
              badgeTone: "primary",
            },
            { to: "/admin/products", label: "Products", icon: Package },
            { to: "/admin/products/new", label: "New product", icon: Plus },
            { to: "/admin/products/import", label: t("dash.import.nav"), icon: Upload },
          ],
        },
        {
          label: t("dash.groups.ops"),
          items: [
            { to: "/admin/categories", label: t("dash.nav.categories"), icon: Tags },
            { to: "/admin/customers", label: t("dash.nav.customers"), icon: Users },
            { to: "/admin/live-view", label: "Live view", icon: Globe2 },
            { to: "/admin/performance", label: t("dash.nav.performance"), icon: Activity },
            { to: "/admin/catalog-analytics", label: "Catalog analytics", icon: Activity },
            { to: "/admin/inventory", label: "Inventory control tower", icon: Warehouse },
            { to: "/admin/integrations", label: "Integration control center", icon: RefreshCw },
            { to: "/admin/shipping", label: "Shipping", icon: Truck, soon: true },
            { to: "/admin/shipments", label: "Shipments", icon: Package, soon: true },
            { to: "/admin/reviews", label: "Reviews", icon: Star, badge: c?.reviews_pending },
            { to: "/admin/returns", label: "Returns", icon: RotateCcw, soon: true },
            { to: "/admin/coupons", label: "Coupons", icon: Ticket },
            { to: "/admin/banners", label: "Banners", icon: Megaphone, soon: true },
            { to: "/admin/newsletter", label: "Newsletter", icon: Mail, soon: true },
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
