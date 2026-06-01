import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/site/ProductCard";
import { listMyWishlist } from "@/lib/wishlist.functions";

export const Route = createFileRoute("/_authenticated/account/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Corner Mex" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const fn = useServerFn(listMyWishlist);
  const q = useQuery({ queryKey: ["my-wishlist"], queryFn: () => fn({}) });
  const items = (q.data ?? []) as any[];

  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">My wishlist</h1>
            <p className="mt-1 text-sm text-muted-foreground">Saved favorites for later.</p>
          </div>
          <Link to="/account"><Button variant="outline" className="rounded-full">← Account</Button></Link>
        </div>
        <div className="mt-8">
          {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
           items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">You haven't saved anything yet.</p>
              <Link to="/shop" className="mt-3 inline-block"><Button>Browse shop</Button></Link>
            </div>
           ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
           )}
        </div>
      </section>
    </SiteLayout>
  );
}
