import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: (s) => z.object({ n: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Order confirmed — Corner Mex" }] }),
  component: OrderConfirmed,
});

function OrderConfirmed() {
  const { n } = Route.useSearch();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-4xl tracking-tight">Order confirmed</h1>
        <p className="mt-3 text-muted-foreground">
          Thank you. We've notified the sellers and will email you tracking details shortly.
        </p>
        {n && (
          <p className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm">
            Order # <span className="font-medium text-foreground">{n}</span>
          </p>
        )}
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/shop"><Button variant="outline" className="rounded-full">Continue shopping</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}