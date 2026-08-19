import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CreditCard, History, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminTransitionOrderLifecycle } from "@/lib/admin.functions";
import {
  allowedCompatibleOrderTransitions,
  allowedCompatiblePaymentTransitions,
  type LifecycleTransitionType,
} from "@/lib/order-lifecycle";

const aed = (value: number | string) => `${Number(value ?? 0).toFixed(2)} AED`;

export function AdminOrderLifecycleView({
  data,
  invalidateKey,
  backHref,
}: {
  data: any;
  invalidateKey: any[];
  backHref: string;
  customerHref?: string;
}) {
  const order = data.order;
  const items: any[] = data.items ?? [];
  const events: any[] = data.events ?? [];
  const capabilityAvailable = data.lifecycleCapability === true;
  const transition = useServerFn(adminTransitionOrderLifecycle);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (request: {
      transitionType: LifecycleTransitionType;
      expectedCurrent: string;
      next: string;
    }) => transition({ data: { orderId: order.id, ...request } as any }),
    onSuccess: async () => {
      toast.success("Lifecycle transition recorded");
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orderTransitions = allowedCompatibleOrderTransitions(
    order.status,
    order.payment_status,
    order.payment_method,
  );
  const paymentTransitions = allowedCompatiblePaymentTransitions(
    order.status,
    order.payment_status,
    order.payment_method,
  );
  const address = order.shipping_address ?? {};

  const applyTransition = (
    transitionType: LifecycleTransitionType,
    expectedCurrent: string,
    next: string,
  ) => mutation.mutate({ transitionType, expectedCurrent, next });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost">
        <Link to={backHref as any}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to orders
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Order</p>
          <h1 className="font-display text-4xl tracking-tight">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">Order: {order.status}</Badge>
          <Badge variant="outline">Payment: {order.payment_status}</Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[item.variant_label, `Qty ${item.qty}`, item.fulfillment_status]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className="tabular-nums">{aed(item.line_total_aed)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" /> Lifecycle audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lifecycle transitions recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {event.transition_type.replace(/_/g, " ")}: {event.previous_value} →{" "}
                        {event.new_value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()} · actor{" "}
                        {String(event.actor_id).slice(0, 8)}…
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Row label="Subtotal" value={aed(order.subtotal_aed)} />
                <Row label="Shipping" value={aed(order.shipping_aed)} />
                <Row label="Tax" value={aed(order.tax_aed)} />
                <Row label="Total" value={aed(order.total_aed)} strong />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>{address.recipient_name ?? "—"}</p>
              <p>{[address.area, address.emirate].filter(Boolean).join(", ") || "—"}</p>
              <p>
                {[address.street, address.building, address.floor_apartment]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Controlled lifecycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!capabilityAvailable && (
                <p
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
                  role="status"
                >
                  Lifecycle mutation capability is unavailable. Controls are disabled.
                </p>
              )}

              <TransitionGroup
                title="Order status"
                current={order.status}
                next={orderTransitions}
                disabled={!capabilityAvailable || mutation.isPending}
                onSelect={(value) => applyTransition("order_status", order.status, value)}
              />

              <div className="border-t pt-5">
                <TransitionGroup
                  icon={<CreditCard className="h-4 w-4" />}
                  title={`COD payment status`}
                  current={order.payment_status}
                  next={paymentTransitions}
                  disabled={!capabilityAvailable || mutation.isPending}
                  onSelect={(value) =>
                    applyTransition("payment_status", order.payment_status, value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TransitionGroup({
  icon,
  title,
  current,
  next,
  disabled,
  onSelect,
}: {
  icon?: React.ReactNode;
  title: string;
  current: string;
  next: readonly string[];
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground">Current: {current}</p>
      {next.length === 0 ? (
        <p className="text-xs text-muted-foreground">No permitted next transition.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next.map((value) => (
            <Button
              key={value}
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onSelect(value)}
            >
              Set {value.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t pt-2 font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
