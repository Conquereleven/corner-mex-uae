import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerOrderHistorySurface } from "@/routes/_authenticated/account";
import { CustomerOrderDetailSurface } from "@/routes/_authenticated/account.orders.$id";
import { AdminOrderLifecycleView } from "@/components/site/AdminOrderLifecycleView";
import {
  getCustomerOrderDetailView,
  getCustomerOrderHistoryView,
} from "@/lib/order-experience-contract";

export const Route = createFileRoute("/founder-acceptance")({
  head: () => ({ meta: [{ title: "Founder Acceptance — Corner Mex" }] }),
  component: FounderAcceptanceFixture,
});

const fixtureEnabled = import.meta.env.VITE_CM_FOUNDER_ACCEPTANCE_FIXTURE === "true";

const order = {
  id: "founder-acceptance-cm-com-4a",
  order_number: "CM-20260812-A0057874",
  created_at: "2026-08-12T17:19:28.235831Z",
  status: "pending",
  payment_status: "pending",
  payment_method: "cod",
  subtotal_aed: 6,
  shipping_aed: 20,
  tax_aed: 0.3,
  total_aed: 26.3,
  shipping_address: {
    recipient_name: "Founder acceptance fixture",
    area: "JVC",
    emirate: "Dubai",
    street: "Fixture street",
    building: "Preview only",
    floor_apartment: "QA",
  },
  items: [
    {
      id: "fixture-item-1",
      product_name: "Founder acceptance product",
      variant_label: "Visual QA fixture",
      qty: 1,
      fulfillment_status: "pending",
      line_total_aed: 6,
    },
  ],
};

const events = [
  {
    id: "fixture-event-1",
    transition_type: "order_status",
    previous_value: "pending",
    new_value: "confirmed",
    actor_id: "fixture-admin",
    created_at: "2026-08-12T17:25:00Z",
  },
  {
    id: "fixture-event-2",
    transition_type: "payment_status",
    previous_value: "pending",
    new_value: "under_review",
    actor_id: "fixture-admin",
    created_at: "2026-08-12T17:26:00Z",
  },
];

function FounderAcceptanceFixture() {
  if (!fixtureEnabled) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Founder acceptance fixture disabled</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              This staging-only visual fixture is not enabled in this environment.
            </CardContent>
          </Card>
        </section>
      </SiteLayout>
    );
  }

  const historyView = getCustomerOrderHistoryView({
    isLoading: false,
    isError: false,
    data: [order],
  });
  const detailView = getCustomerOrderDetailView({
    isLoading: false,
    error: null,
    data: order,
  });

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">FOUNDER ACCEPTANCE FIXTURE</Badge>
            <Badge variant="secondary">STAGING ONLY</Badge>
            <Badge variant="outline">NO PRODUCTION DATA</Badge>
          </div>
          <h1 className="mt-4 font-display text-4xl tracking-tight">CM-COM-4A visual acceptance</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            This page reuses the real CM-COM-4A presentation surfaces with isolated mock data. It does not create orders, mutate lifecycle state, apply migrations, or write to Supabase.
          </p>
        </div>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Customer</p>
            <h2 className="font-display text-3xl tracking-tight">My Orders</h2>
          </div>
          <Card>
            <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
            <CardContent>
              <CustomerOrderHistorySurface
                view={historyView}
                onRetry={() => undefined}
                renderShopLink={() => <span className="underline">Start shopping →</span>}
                renderOrderLink={() => <span className="rounded-md border px-3 py-1.5 text-sm">View order</span>}
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Customer</p>
            <h2 className="font-display text-3xl tracking-tight">Order detail</h2>
          </div>
          <CustomerOrderDetailSurface view={detailView} onRetry={() => undefined} />
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Master Dashboard</p>
            <h2 className="font-display text-3xl tracking-tight">Controlled lifecycle + audit</h2>
            <p className="text-sm text-muted-foreground">
              Controls are intentionally fail-closed in this visual fixture because the CM-COM-4A migration is not applied in staging.
            </p>
          </div>
          <AdminOrderLifecycleView
            data={{ order, items: order.items, events, lifecycleCapability: false }}
            invalidateKey={["founder-acceptance-fixture"]}
            backHref="/admin/orders"
          />
        </section>
      </section>
    </SiteLayout>
  );
}
