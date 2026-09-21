import { createFileRoute, Link } from "@tanstack/react-router";
import { TicketX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUPONS_ENABLED } from "@/lib/coupons.functions";

// Coupons are disabled until canonical coupon support ships
// (docs/cornermex-2/LAUNCH-READINESS-PLAN.md §3.2). The previous editor wrote
// legacy columns the canonical coupons table does not have, so it failed
// against production. The route stays so existing links land on an explanation
// instead of an error.
export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: CouponsUnavailable,
});

function CouponsUnavailable() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <TicketX className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 font-display text-3xl tracking-tight">Coupons are not available yet</h1>
      <p className="mt-3 text-muted-foreground">
        {COUPONS_ENABLED
          ? "Coupon management is being enabled."
          : "Checkout does not apply coupons yet, so coupon management is switched off. No coupon has been created or redeemed. Coupons will return once they are applied atomically inside the order transaction."}
      </p>
      <Link to="/admin">
        <Button variant="outline" className="mt-8 rounded-full">
          Back to admin
        </Button>
      </Link>
    </div>
  );
}
