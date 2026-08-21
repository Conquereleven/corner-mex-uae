import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { DesertGlassDrawerShell } from "@/components/site/DesertGlass";
import { TrustBar } from "@/components/site/Trust";
import { cartTotals, groupBySeller, useCart } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Corner Mex" }, { name: "robots", content: "noindex" }] }),
  component: Cart,
});

function Cart() {
  const items = useCart((state) => state.items);
  const setQty = useCart((state) => state.setQty);
  const remove = useCart((state) => state.remove);
  const totals = cartTotals(items);
  const groups = groupBySeller(items);

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-display text-4xl tracking-tight">Your cart is empty</h1>
          <p className="mt-4 text-muted-foreground">
            Browse the shop and add products to your cart.
          </p>
          <Link to="/shop">
            <Button className="mt-8 rounded-full">Go to shop</Button>
          </Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl tracking-tight">Your cart</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prices are shown in AED. Current price, availability and shipping are verified at
          checkout.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.sellerId} className="rounded-3xl border border-border bg-card p-6">
                <div className="border-b border-border pb-4 text-sm font-medium">
                  {group.sellerName}
                </div>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => (
                    <li key={item.variantId} className="flex gap-4 py-5">
                      <Link
                        to="/product/$slug"
                        params={{ slug: item.slug }}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted"
                      >
                        {item.image && (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                          to="/product/$slug"
                          params={{ slug: item.slug }}
                          className="truncate text-sm font-medium hover:text-primary"
                        >
                          {item.name}
                        </Link>
                        {item.variantLabel && (
                          <span className="text-xs text-muted-foreground">{item.variantLabel}</span>
                        )}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                          <div className="inline-flex items-center rounded-full border border-border">
                            <button
                              type="button"
                              onClick={() => setQty(item.variantId, item.qty - 1)}
                              aria-label={`Decrease ${item.name} quantity`}
                              className="min-h-9 px-3"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-6 text-center text-xs font-medium">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQty(item.variantId, item.qty + 1)}
                              aria-label={`Increase ${item.name} quantity`}
                              className="min-h-9 px-3"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">
                              AED {(item.unitPrice * item.qty).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => remove(item.variantId)}
                              aria-label={`Remove ${item.name}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
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

          <DesertGlassDrawerShell className="h-fit rounded-3xl p-6">
            <h2 className="font-display text-2xl">Order summary</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>AED {totals.subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT (5%)</dt>
                <dd>AED {totals.tax.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>Pending destination check</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
                <dt>Total before shipping</dt>
                <dd>AED {totals.totalBeforeShipping.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Shipping is calculated only after a verified destination and shipping rate are
              available.
            </p>
            <Link to="/checkout">
              <Button className="mt-6 w-full rounded-full">Continue to checkout</Button>
            </Link>
            <TrustBar context="b2c" className="mt-6" />
          </DesertGlassDrawerShell>
        </div>
      </section>
    </SiteLayout>
  );
}
