import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { confirmBnplPayment } from "@/lib/payments.functions";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { Wallet, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/checkout/bnpl/$provider/$orderId")({
  head: () => ({ meta: [{ title: "BNPL Checkout — Corner Mex" }] }),
  component: BnplCheckout,
});

function BnplCheckout() {
  const { provider, orderId } = Route.useParams();
  const navigate = useNavigate();
  const clearCart = useCart((s) => s.clear);
  const fn = useServerFn(confirmBnplPayment);
  const [decided, setDecided] = useState<"idle" | "approving" | "approved" | "cancelled">("idle");

  const m = useMutation({
    mutationFn: () => fn({ data: { orderId, provider: provider as "tabby" | "tamara" } }),
    onSuccess: () => {
      setDecided("approved");
      clearCart();
      toast.success("Payment approved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (decided === "approved") {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl tracking-tight">Payment approved</h1>
          <p className="mt-3 text-muted-foreground">Your order has been confirmed. Sellers will be notified.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/shop"><Button variant="outline" className="rounded-full">Continue shopping</Button></Link>
            <Link to="/account"><Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">My orders</Button></Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (decided === "cancelled") {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-3xl tracking-tight">Payment cancelled</h1>
          <p className="mt-3 text-muted-foreground">You can return to checkout and try a different method.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/checkout"><Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">Back to checkout</Button></Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const isTabby = provider === "tabby";
  const brandColor = isTabby ? "bg-rose-500" : "bg-violet-600";
  const brandText = isTabby ? "Tabby" : "Tamara";

  return (
    <SiteLayout>
      <section className="mx-auto max-w-lg px-4 py-16">
        <div className={`mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white ${brandColor}`}>
          <Wallet className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-3xl tracking-tight">{brandText} · Sandbox</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          This is a simulated {brandText} checkout for demo purposes. In production, this would redirect to the real {brandText} flow.
        </p>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Payment plan</span>
            <span className="text-sm font-medium">{isTabby ? "4 payments · 0% interest" : "Split into 3 payments"}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">First payment</span>
            <span className="text-sm font-medium">Today</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subsequent payments</span>
            <span className="text-sm font-medium">{isTabby ? "Every 2 weeks" : "Every month"}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className={`w-full rounded-full text-white hover:opacity-90 ${brandColor}`}
          >
            {m.isPending ? "Processing…" : "Approve payment (demo)"}
          </Button>
          <Button
            onClick={() => setDecided("cancelled")}
            variant="outline"
            className="w-full rounded-full"
          >
            Cancel
          </Button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Demo mode. Connect your {brandText} merchant account and API keys to process real payments.
        </p>
      </section>
    </SiteLayout>
  );
}
