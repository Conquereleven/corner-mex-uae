import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Package, Clock, AlertCircle } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { getOrderForConfirmation } from "@/lib/payments.functions";
import { trackEvent } from "@/lib/track";
import { BANK_TRANSFER_DETAILS, BANK_TRANSFER_CONFIGURED } from "@/lib/payment-methods";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (s) => z.object({ order: z.string().optional(), n: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Order confirmed — Corner Mex" }] }),
  component: OrderConfirmed,
});

function OrderConfirmed() {
  const { order, n } = Route.useSearch();
  const fetchOrder = useServerFn(getOrderForConfirmation);
  const pollStartRef = useRef<number>(Date.now());

  const { data, isLoading } = useQuery({
    queryKey: ["order-confirmation", order],
    queryFn: () => (order ? fetchOrder({ data: { orderId: order! } }) : null),
    enabled: !!order,
    retry: 2,
    refetchInterval: (q) => {
      // If payment is still pending (Stripe redirected before the webhook landed),
      // poll every 3 seconds for up to 60s so the UI flips to "paid" automatically.
      const d = q.state.data as any;
      if (!d) return 3000;
      if (d.payment_status !== "pending") return false;
      if (Date.now() - pollStartRef.current > 60_000) return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (!data || !order) return;
    if (data.payment_status !== "paid") return;
    const key = `cmx-purchase-tracked:${order}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {}
    trackEvent("purchase_completed", {
      source: "order_confirmed",
      orderId: order,
      revenueAed: Number(data.total_aed ?? 0),
      metadata: { itemCount: (data.items as any[])?.length ?? 0 },
    });
  }, [data, order]);

  // Stripe may redirect here before webhook fires — show a "processing" state
  const isProcessing = data && data.payment_status === "pending";

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        {isProcessing ? (
          <>
            <div className="mx-auto inline-flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-display text-3xl tracking-tight">Payment processing</h1>
            <p className="mt-3 text-muted-foreground">
              We're confirming your payment with the bank. This usually takes a few seconds.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-display text-4xl tracking-tight">Order confirmed</h1>
            <p className="mt-3 text-muted-foreground">
              Thank you. We've notified the sellers and will email you tracking details shortly.
            </p>
          </>
        )}

        {n && !order && (
          <p className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm">
            Order # <span className="font-medium text-foreground">{n}</span>
          </p>
        )}

        {data && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-start">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Order number</span>
              <span className="font-medium">{data.order_number}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Package className="h-3 w-3" /> {data.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${data.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {data.payment_status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {data.payment_status}
              </span>
            </div>
            {data.payment_method === "bank_transfer" && data.payment_status !== "paid" && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">Bank transfer instructions</p>
                {BANK_TRANSFER_CONFIGURED ? (
                  <>
                    <p className="mt-1 text-amber-900/90">
                      Please transfer the total amount to our UAE bank account. Your order will be processed after payment confirmation.
                    </p>
                    <dl className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between gap-3"><dt className="text-amber-900/70">Account name</dt><dd className="font-medium">{BANK_TRANSFER_DETAILS.accountName}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-amber-900/70">Bank</dt><dd className="font-medium">{BANK_TRANSFER_DETAILS.bankName}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-amber-900/70">IBAN</dt><dd className="font-medium">{BANK_TRANSFER_DETAILS.iban}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-amber-900/70">Reference</dt><dd className="font-medium">Order #{data.order_number}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-amber-900/80">After transferring, please send your receipt by WhatsApp.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-amber-900/90">
                      Your order is reserved. Please contact us on WhatsApp with your order number and we'll share the UAE bank account details to complete your transfer.
                    </p>
                    <p className="mt-3 text-xs text-amber-900/80">Reference: Order #{data.order_number}</p>
                  </>
                )}
              </div>
            )}
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Items</h3>
              <ul className="mt-2 space-y-2">
                {(data.items as any[]).map((item: any, idx: number) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.qty}× {item.product_name} {item.variant_label ? `(${item.variant_label})` : ""}
                      <span className="ml-1 text-[11px] text-muted-foreground/70">· {item.seller?.store_name ?? "Seller"}</span>
                    </span>
                    <span className="font-medium">AED {Number(item.line_total_aed).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>AED {Number(data.subtotal_aed).toFixed(2)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{Number(data.shipping_aed) === 0 ? "Free" : `AED ${Number(data.shipping_aed).toFixed(2)}`}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">VAT (5%)</dt><dd>AED {Number(data.tax_aed).toFixed(2)}</dd></div>
                <div className="flex justify-between pt-2 text-base font-medium"><dt>Total</dt><dd>AED {Number(data.total_aed).toFixed(2)}</dd></div>
              </dl>
            </div>
          </div>
        )}

        <div className="mt-10 flex justify-center gap-3">
          <Link to="/shop"><Button variant="outline" className="rounded-full">Continue shopping</Button></Link>
          <Link to="/account"><Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">My orders</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}
