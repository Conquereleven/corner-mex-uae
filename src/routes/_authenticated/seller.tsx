import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  return (
    <DashboardShell
      title="Seller"
      nav={[
        { to: "/seller", label: "Overview" },
        { to: "/seller/products", label: "Products" },
        { to: "/seller/orders", label: "Orders" },
      ]}
    >
      <Outlet />
    </DashboardShell>
  );
}