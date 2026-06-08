import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Package, Plus, ShoppingCart, Wallet, Percent, Store, Settings, Activity, Upload, Truck, Bell, RotateCcw, ShieldCheck,
} from "lucide-react";
import { getMyAccount } from "@/lib/account.functions";
import { DashboardShell } from "@/components/site/DashboardShell";

export const Route = createFileRoute("/_authenticated/seller")({
  beforeLoad: async () => {
    const acc = await getMyAccount({});
    if (!acc.seller) throw redirect({ to: "/account" });
  },
  component: SellerLayout,
});

function SellerLayout() {
  const { t } = useTranslation();
  return (
    <DashboardShell
      title="Seller Studio"
      subtitle="Manage your store"
      nav={[
        {
          label: t("dash.groups.overview"),
          items: [
            { to: "/seller", label: t("dash.nav.overview"), icon: LayoutDashboard },
            { to: "/seller/performance", label: t("dash.nav.performance"), icon: Activity },
            { to: "/seller/notifications", label: "Notifications", icon: Bell },
          ],
        },
        {
          label: t("dash.groups.catalog"),
          items: [
            { to: "/seller/products", label: t("dash.nav.products"), icon: Package },
            { to: "/seller/products/new", label: t("dash.nav.newProduct"), icon: Plus },
            { to: "/seller/products/import", label: t("dash.import.nav"), icon: Upload },
          ],
        },
        {
          label: t("dash.groups.sales"),
          items: [
            { to: "/seller/orders", label: t("dash.nav.orders"), icon: ShoppingCart },
            { to: "/seller/shipping", label: "Shipping", icon: Truck },
            { to: "/seller/returns", label: "Returns", icon: RotateCcw },
          ],
        },
        {
          label: t("dash.groups.finance"),
          items: [
            { to: "/seller/payouts", label: t("dash.nav.payouts"), icon: Wallet },
            { to: "/seller/coupons", label: "Coupons", icon: Percent },
            { to: "/seller/commissions", label: t("dash.nav.commissions"), icon: Percent },
          ],
        },
        {
          label: t("dash.groups.store"),
          items: [
            { to: "/seller/storefront", label: t("dash.nav.storefront"), icon: Store },
            { to: "/seller/settings", search: { tab: "verification" }, label: "KYC Verification", icon: ShieldCheck },
            { to: "/seller/settings", label: t("dash.nav.settings"), icon: Settings },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}