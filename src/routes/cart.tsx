import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { useCart, cartTotals, groupBySeller } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Corner Mex" }] }),
  component: Cart,
});

function Cart() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const totals = cartTotals(items);
  const groups = groupBySeller(items);

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl tracking-tight">Your cart is empty</h1>
          <p className="mt-4 text-muted-foreground">Start browsing the catalogue to add Mexican goods.</p>
          <Link to="/shop"><Button className="mt-8 rounded-full bg-foreground text-background hover:bg-foreground/90">Go to shop</Button></Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl tracking-tight">Your cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">{totals.sellerCount} seller{totals.sellerCount > 1 ? "s" : ""} · {items.length} item{items.length > 1 ? "s" : ""}</p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            {groups.map((g) => (
              <div key={g.sellerId} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <Link to="/sellers/$slug" params={{ slug: g.sellerSlug }} className="text-sm font-medium text-foreground hover:text-primary">
                    {g.sellerName}
                  </Link>
                  <span className="text-xs text-muted-foreground">AED {g.subtotal.toFixed(2)}</span>
                </div>
                <ul className="divide-y divide-border">
                  {g.items.map((it) => (
                    <li key={it.variantId} className="flex gap-4 py-5">
                      <Link to="/product/$slug" params={{ slug: it.slug }} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {it.image && <img src={it.image} alt={it.name} className="h-full w-full object-cover" />}
                      </Link>
                      <div className="flex flex-1 flex-col">
                        <Link to="/product/$slug" params={{ slug: it.slug }} className="text-sm font-medium hover:text-primary">{it.name}</Link>
                        {it.variantLabel && <span className="text-xs text-muted-foreground">{it.variantLabel}</span>}
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
                            <button onClick={() => setQty(it.variantId, it.qty - 1)} aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                            <span className="min-w-5 text-center text-xs font-medium">{it.qty}</span>
                            <button onClick={() => setQty(it.variantId, it.qty + 1)} aria-label="Increase"><Plus className="h-3 w-3" /></button>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">AED {(it.unitPrice * it.qty).toFixed(2)}</span>
                            <button onClick={() => remove(it.variantId)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl">Order summary</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>AED {totals.subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{totals.shipping === 0 ? "Free" : `AED ${totals.shipping.toFixed(2)}`}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">VAT (5%)</dt><dd>AED {totals.tax.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Total</dt><dd>AED {totals.total.toFixed(2)}</dd></div>
            </dl>
            {totals.subtotal < 150 && (
              <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                Spend AED {(150 - totals.subtotal).toFixed(2)} more for free shipping.
              </p>
            )}
            <Link to="/checkout">
              <Button size="lg" className="mt-6 w-full rounded-full bg-foreground text-background hover:bg-foreground/90">
                Continue to checkout
              </Button>
            </Link>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Secure payments · Delivered across the UAE</p>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}