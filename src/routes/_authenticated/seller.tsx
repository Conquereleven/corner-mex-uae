import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Package, Plus, ShoppingCart, Wallet, Percent, Store, Settings,
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
          items: [{ to: "/seller", label: t("dash.nav.overview"), icon: LayoutDashboard }],
        },
        {
          label: t("dash.groups.catalog"),
          items: [
            { to: "/seller/products", label: t("dash.nav.products"), icon: Package },
            { to: "/seller/products/new", label: t("dash.nav.newProduct"), icon: Plus },
          ],
        },
        {
          label: t("dash.groups.sales"),
          items: [{ to: "/seller/orders", label: t("dash.nav.orders"), icon: ShoppingCart }],
        },
        {
          label: t("dash.groups.finance"),
          items: [
            { label: t("dash.nav.payouts"), icon: Wallet, soon: true },
            { label: t("dash.nav.commissions"), icon: Percent, soon: true },
          ],
        },
        {
          label: t("dash.groups.store"),
          items: [
            { label: t("dash.nav.storefront"), icon: Store, soon: true },
            { label: t("dash.nav.settings"), icon: Settings, soon: true },
          ],
        },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}